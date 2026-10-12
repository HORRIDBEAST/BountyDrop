// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SpendVault
/// @notice Per-owner MON vault for BountyDrop's Spend Terminal, adapted from
///         SattelR's AgentPayVault.sol (see BOUNTYDROP_MASTER_SPEC.md
///         Section 3). A business or worker (owner) tops up native MON and
///         grants a restricted spend policy to a specific vendor terminal
///         or redemption-agent wallet, capping total MON, a category, an
///         expiry, and — the two fixes called out in the spec — binding the
///         policy to actual on-chain merchant *addresses* instead of a
///         self-reported website string, and adding an optional on-chain
///         geofence check against the merchant's registered location.
///
///         Guardrail pattern reused wholesale from AgentPayVault: a
///         Policy-style struct granted by the vault owner and redeemed only
///         by the pre-designated spender (`msg.sender == p.agent`), with the
///         vault itself custodying funds and releasing them atomically
///         inside the same guarded call that checks every rule
///         (checks-effects-interactions + a hand-rolled reentrancy guard).
///
///         Geofence note: `merchantMetersPerDegreeLngE0` is supplied by the
///         POLICY GRANTOR (the vault owner) at grant time, precomputed
///         off-chain as `111320 * cos(latitudeRadians)` — see
///         lib/geo/metersPerDegreeLongitudeAt() — not by the untrusted
///         spender, so trusting it is no different from trusting any other
///         owner-supplied policy field. This avoids needing on-chain
///         trigonometry; distance is compared as squared meters (no sqrt
///         needed) using a flat-earth approximation that's accurate enough
///         at the tens-to-hundreds-of-meters radii this product uses. This
///         is a "raise the bar" anti-spoofing signal, not a security
///         guarantee — device GPS is still spoofable client-side.
contract SpendVault {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Policy {
        address agent; // vendor terminal / redemption-agent wallet
        uint256 amountLimit; // max total spend in wei (native MON)
        uint256 spent; // amount already spent in wei
        string category; // e.g. "food", "transit"
        address[] allowedMerchants; // fix: address-based, not free-text website
        uint256 expiry; // unix timestamp; 0 = no expiry
        bool singleUse;
        bool used;
        bool active;
        // --- Optional geofence, keyed to ONE merchant location for this policy ---
        bool geofenced;
        int256 merchantLatE7;
        int256 merchantLngE7;
        uint32 merchantRadiusMeters;
        uint256 merchantMetersPerDegreeLngE0; // precomputed off-chain, see note above
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable owner;

    mapping(bytes32 => Policy) private _policies;
    bytes32[] private _policyIds;

    uint256 private _locked;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotAgent();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientVaultBalance();
    error PolicyNotFound();
    error PolicyInactive();
    error PolicyExpired();
    error PolicyAlreadyUsed();
    error AmountLimitExceeded();
    error CategoryNotAllowed();
    error MerchantNotAllowed();
    error OutsideMerchantGeofence();
    error TransferFailed();
    error Reentrancy();
    error EmptyCategory();
    error EmptyAllowlist();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TopUp(address indexed from, uint256 amount, uint256 vaultBalance);
    event Withdrawn(address indexed to, uint256 amount);
    event PermissionGranted(
        bytes32 indexed policyId,
        address indexed agent,
        uint256 amountLimit,
        string category,
        uint256 expiry,
        bool singleUse,
        bool geofenced
    );
    event PermissionRevoked(bytes32 indexed policyId, address indexed agent);
    event PaymentAuthorized(
        bytes32 indexed policyId,
        address indexed agent,
        address indexed merchant,
        uint256 amount,
        string category,
        string orderId
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Funding (owner)
    // -------------------------------------------------------------------------

    function topUp() external payable onlyOwner {
        if (msg.value == 0) revert ZeroAmount();
        emit TopUp(msg.sender, msg.value, address(this).balance);
    }

    receive() external payable {
        if (msg.sender != owner) revert NotOwner();
        if (msg.value == 0) revert ZeroAmount();
        emit TopUp(msg.sender, msg.value, address(this).balance);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > address(this).balance) revert InsufficientVaultBalance();

        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(owner, amount);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert ZeroAmount();

        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(owner, amount);
    }

    // -------------------------------------------------------------------------
    // Permissions (owner -> agent)
    // -------------------------------------------------------------------------

    /// @notice Grant a vendor terminal / redemption-agent wallet a
    ///         restricted spend permission.
    /// @param agent Wallet that will call spend()
    /// @param amountLimit Max MON the agent may spend under this policy (wei)
    /// @param category Allowed category (exact match)
    /// @param allowedMerchants On-chain addresses the agent may pay
    /// @param expiry Unix expiry; pass 0 for no expiry
    /// @param singleUse If true, policy dies after one successful spend
    /// @param geofenced If true, spend() additionally requires the caller's
    ///        reported location to fall within merchantRadiusMeters of
    ///        (merchantLatE7, merchantLngE7)
    function grantPermission(
        address agent,
        uint256 amountLimit,
        string calldata category,
        address[] calldata allowedMerchants,
        uint256 expiry,
        bool singleUse,
        bool geofenced,
        int256 merchantLatE7,
        int256 merchantLngE7,
        uint32 merchantRadiusMeters,
        uint256 merchantMetersPerDegreeLngE0
    ) external onlyOwner returns (bytes32 policyId) {
        if (agent == address(0)) revert ZeroAddress();
        if (amountLimit == 0) revert ZeroAmount();
        if (bytes(category).length == 0) revert EmptyCategory();
        if (allowedMerchants.length == 0) revert EmptyAllowlist();

        policyId = keccak256(
            abi.encode(
                owner,
                agent,
                amountLimit,
                category,
                allowedMerchants,
                expiry,
                singleUse,
                block.timestamp,
                _policyIds.length
            )
        );

        Policy storage p = _policies[policyId];
        p.agent = agent;
        p.amountLimit = amountLimit;
        p.spent = 0;
        p.category = category;
        p.expiry = expiry;
        p.singleUse = singleUse;
        p.used = false;
        p.active = true;
        p.geofenced = geofenced;
        p.merchantLatE7 = merchantLatE7;
        p.merchantLngE7 = merchantLngE7;
        p.merchantRadiusMeters = merchantRadiusMeters;
        p.merchantMetersPerDegreeLngE0 = merchantMetersPerDegreeLngE0;

        for (uint256 i = 0; i < allowedMerchants.length; i++) {
            p.allowedMerchants.push(allowedMerchants[i]);
        }

        _policyIds.push(policyId);

        emit PermissionGranted(policyId, agent, amountLimit, category, expiry, singleUse, geofenced);
    }

    function revokePermission(bytes32 policyId) external onlyOwner {
        Policy storage p = _policies[policyId];
        if (p.agent == address(0)) revert PolicyNotFound();
        p.active = false;
        emit PermissionRevoked(policyId, p.agent);
    }

    // -------------------------------------------------------------------------
    // Spending (redemption agent / terminal)
    // -------------------------------------------------------------------------

    /// @notice Agent pays a merchant in native MON under a granted policy.
    /// @param policyId Permission granted by the owner
    /// @param merchant Recipient wallet — MUST be on the policy's allowlist
    /// @param amount MON to send (wei)
    /// @param category Category (must match policy)
    /// @param orderId Off-chain order reference stored in the event
    /// @param spendLatE7 Caller-reported latitude*1e7 (ignored unless the
    ///        policy is geofenced)
    /// @param spendLngE7 Caller-reported longitude*1e7 (ignored unless the
    ///        policy is geofenced)
    function spend(
        bytes32 policyId,
        address merchant,
        uint256 amount,
        string calldata category,
        string calldata orderId,
        int256 spendLatE7,
        int256 spendLngE7
    ) external nonReentrant {
        Policy storage p = _policies[policyId];

        if (p.agent == address(0)) revert PolicyNotFound();
        if (msg.sender != p.agent) revert NotAgent();
        if (!p.active) revert PolicyInactive();
        if (p.expiry != 0 && block.timestamp > p.expiry) revert PolicyExpired();
        if (p.singleUse && p.used) revert PolicyAlreadyUsed();
        if (merchant == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (p.spent + amount > p.amountLimit) revert AmountLimitExceeded();
        if (!_eq(p.category, category)) revert CategoryNotAllowed();
        if (!_merchantAllowed(p, merchant)) revert MerchantNotAllowed();
        if (amount > address(this).balance) revert InsufficientVaultBalance();

        if (p.geofenced) {
            if (!_withinMerchantGeofence(p, spendLatE7, spendLngE7)) {
                revert OutsideMerchantGeofence();
            }
        }

        // Effects before interaction
        p.spent += amount;
        if (p.singleUse) {
            p.used = true;
            p.active = false;
        }

        (bool ok, ) = merchant.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PaymentAuthorized(policyId, msg.sender, merchant, amount, category, orderId);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPolicy(bytes32 policyId)
        external
        view
        returns (
            address agent,
            uint256 amountLimit,
            uint256 spent,
            string memory category,
            address[] memory allowedMerchants,
            uint256 expiry,
            bool singleUse,
            bool used,
            bool active,
            bool geofenced
        )
    {
        Policy storage p = _policies[policyId];
        if (p.agent == address(0)) revert PolicyNotFound();
        return (
            p.agent,
            p.amountLimit,
            p.spent,
            p.category,
            p.allowedMerchants,
            p.expiry,
            p.singleUse,
            p.used,
            p.active,
            p.geofenced
        );
    }

    function remainingAllowance(bytes32 policyId) external view returns (uint256) {
        Policy storage p = _policies[policyId];
        if (p.agent == address(0)) revert PolicyNotFound();
        if (!p.active) return 0;
        if (p.expiry != 0 && block.timestamp > p.expiry) return 0;
        if (p.singleUse && p.used) return 0;
        return p.amountLimit - p.spent;
    }

    function policyCount() external view returns (uint256) {
        return _policyIds.length;
    }

    function policyIdAt(uint256 index) external view returns (bytes32) {
        return _policyIds[index];
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _merchantAllowed(Policy storage p, address merchant) private view returns (bool) {
        uint256 len = p.allowedMerchants.length;
        for (uint256 i = 0; i < len; i++) {
            if (p.allowedMerchants[i] == merchant) return true;
        }
        return false;
    }

    function _eq(string storage a, string calldata b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    /// @dev Flat-earth squared-distance geofence check — no sqrt, no
    ///      on-chain trig. See contract-level NatSpec for the precision
    ///      tradeoffs and where merchantMetersPerDegreeLngE0 comes from.
    function _withinMerchantGeofence(
        Policy storage p,
        int256 spendLatE7,
        int256 spendLngE7
    ) private view returns (bool) {
        int256 dLatE7 = spendLatE7 - p.merchantLatE7;
        int256 dLngE7 = spendLngE7 - p.merchantLngE7;

        // meters-per-degree-latitude is ~constant everywhere (111,320 m/deg)
        int256 dLatMeters = (dLatE7 * 111_320) / 1e7;
        int256 dLngMeters = (dLngE7 * int256(p.merchantMetersPerDegreeLngE0)) / 1e7;

        uint256 distanceSquared = uint256(dLatMeters * dLatMeters + dLngMeters * dLngMeters);
        uint256 radiusSquared = uint256(p.merchantRadiusMeters) * uint256(p.merchantRadiusMeters);

        return distanceSquared <= radiusSquared;
    }
}
