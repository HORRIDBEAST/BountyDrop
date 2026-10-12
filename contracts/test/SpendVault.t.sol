// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SpendVault.sol";

contract SpendVaultTest is Test {
    SpendVault vault;

    address ownerAddr = address(this);
    address terminal = makeAddr("terminal");
    address merchant = makeAddr("merchant");
    address otherMerchant = makeAddr("otherMerchant");

    // Merchant at NYC-ish coordinates; metersPerDegreeLng precomputed
    // off-chain as 111320 * cos(lat) ~ 84,300 at lat ~40.7deg (E0 fixed point).
    int256 constant MERCHANT_LAT_E7 = 407128000;
    int256 constant MERCHANT_LNG_E7 = -740060000;
    uint32 constant MERCHANT_RADIUS = 100;
    uint256 constant METERS_PER_DEG_LNG = 84300;

    function setUp() public {
        vault = new SpendVault();
        vm.deal(ownerAddr, 10 ether);
        vault.topUp{value: 5 ether}();
    }

    // The test contract is the vault's owner (ownerAddr = address(this)), so
    // withdraw()/withdrawAll() send MON back here via a low-level call. A
    // contract with no receive()/fallback() can't accept plain value
    // transfers — without this, that call reverts and withdraw() bubbles up
    // TransferFailed() even though the vault logic itself is correct.
    receive() external payable {}

    function _allowlist() internal view returns (address[] memory list) {
        list = new address[](1);
        list[0] = merchant;
    }

    function testGrantAndSpendWithinLimit() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, false, false, 0, 0, 0, 0
        );

        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.4 ether, "food", "order-1", 0, 0);

        assertEq(vault.remainingAllowance(policyId), 0.6 ether);
        assertEq(merchant.balance, 0.4 ether);
    }

    function testSpendRevertsForNonAllowlistedMerchant() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, false, false, 0, 0, 0, 0
        );

        vm.expectRevert(SpendVault.MerchantNotAllowed.selector);
        vm.prank(terminal);
        vault.spend(policyId, otherMerchant, 0.1 ether, "food", "order-2", 0, 0);
    }

    function testSpendRevertsWhenCategoryMismatched() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, false, false, 0, 0, 0, 0
        );

        vm.expectRevert(SpendVault.CategoryNotAllowed.selector);
        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.1 ether, "transit", "order-3", 0, 0);
    }

    function testSpendRevertsWhenOverBudget() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, false, false, 0, 0, 0, 0
        );

        vm.expectRevert(SpendVault.AmountLimitExceeded.selector);
        vm.prank(terminal);
        vault.spend(policyId, merchant, 1.5 ether, "food", "order-4", 0, 0);
    }

    function testSingleUsePolicyCannotBeReused() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, true, false, 0, 0, 0, 0
        );

        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.1 ether, "food", "order-5", 0, 0);

        vm.expectRevert(SpendVault.PolicyInactive.selector);
        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.1 ether, "food", "order-6", 0, 0);
    }

    function testRevokedPolicyCannotSpend() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, false, false, 0, 0, 0, 0
        );
        vault.revokePermission(policyId);

        vm.expectRevert(SpendVault.PolicyInactive.selector);
        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.1 ether, "food", "order-7", 0, 0);
    }

    function testExpiredPolicyCannotSpend() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), block.timestamp + 1, false, false, 0, 0, 0, 0
        );

        vm.warp(block.timestamp + 2);

        vm.expectRevert(SpendVault.PolicyExpired.selector);
        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.1 ether, "food", "order-8", 0, 0);
    }

    function testGeofencedSpendWithinRadiusSucceeds() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, false, true,
            MERCHANT_LAT_E7, MERCHANT_LNG_E7, MERCHANT_RADIUS, METERS_PER_DEG_LNG
        );

        // ~10m north of the merchant — well within a 100m radius.
        int256 nearbyLat = MERCHANT_LAT_E7 + 900; // ~10m in E7 degree units

        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.1 ether, "food", "order-9", nearbyLat, MERCHANT_LNG_E7);

        assertEq(merchant.balance, 0.1 ether);
    }

    function testGeofencedSpendOutsideRadiusReverts() public {
        bytes32 policyId = vault.grantPermission(
            terminal, 1 ether, "food", _allowlist(), 0, false, true,
            MERCHANT_LAT_E7, MERCHANT_LNG_E7, MERCHANT_RADIUS, METERS_PER_DEG_LNG
        );

        // ~1.1km north of the merchant — well outside a 100m radius.
        int256 farLat = MERCHANT_LAT_E7 + 100_000;

        vm.expectRevert(SpendVault.OutsideMerchantGeofence.selector);
        vm.prank(terminal);
        vault.spend(policyId, merchant, 0.1 ether, "food", "order-10", farLat, MERCHANT_LNG_E7);
    }

    function testOwnerCanWithdraw() public {
        uint256 balanceBefore = ownerAddr.balance;
        vault.withdraw(1 ether);
        assertEq(ownerAddr.balance, balanceBefore + 1 ether);
    }

    function testNonOwnerCannotGrantPermission() public {
        vm.expectRevert(SpendVault.NotOwner.selector);
        vm.prank(terminal);
        vault.grantPermission(terminal, 1 ether, "food", _allowlist(), 0, false, false, 0, 0, 0, 0);
    }
}
