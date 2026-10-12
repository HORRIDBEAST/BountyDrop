// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title QuestEscrow
/// @notice Location-based micro-bounty escrow for BountyDrop, adapted from
///         MicroWorks' MicroTask.sol (see BOUNTYDROP_MASTER_SPEC.md Section 1).
///
///         Two verification tracks, per BOUNTYDROP_BUILD_PROMPT.md:
///
///         Track A (reused as-is): objective quests judged by the
///         "golden-key" pattern — a keccak256 answer hash is committed
///         on-chain at creation, and `submitAnswer` does a single
///         permissionless hash comparison with instant payout. Works only
///         for tasks with a deterministic, pre-known-correct answer
///         (labelling, yes/no, rating, normalized free text).
///
///         Track B (new): photo-proof quests ("photograph this shelf",
///         "confirm this venue is open") have no pre-known hash. A worker
///         registers a proof submission (`submitPhotoProof`, storing a
///         keccak256 reference to the uploaded photo for audit purposes —
///         the photo itself lives off-chain), and a designated oracle
///         address (the AI vision judge's server-side caller, see
///         app/api/verify-photo/route.ts) resolves the frame with a
///         pass/fail verdict and confidence score via `resolvePhotoTask`.
///         The verdict and confidence are logged on-chain alongside the
///         payout event, so a rejected worker can see why.
///
///         GPS check-in (lat/lng/radius fields on Task) is a UX gate, not a
///         security boundary: this contract does NOT re-verify GPS on-chain
///         before paying out — device location is trivially spoofable.
///         Geofencing here only records the quest's intended location for
///         the frontend's checkGeofence() pre-check (see lib/geo/haversine.ts)
///         and for the map UI. Never present "GPS verified" as a security
///         guarantee in product copy.
contract QuestEscrow {
    uint256 public constant MAX_FRAMES = 500;
    uint256 public constant XP_PER_CORRECT = 100;

    uint8 public constant KIND_OPTIONS = 0;
    uint8 public constant KIND_YESNO = 1;
    uint8 public constant KIND_RATING = 2;
    uint8 public constant KIND_TEXT = 3;
    uint8 public constant KIND_PHOTO = 4; // Track B

    uint256 public protocolFee; // basis points, 200 == 2%

    address public immutable owner;
    /// @dev Address authorized to resolve Track B photo tasks (the server
    ///      that calls the AI vision judge). Owner-settable, revocable.
    address public photoOracle;

    uint256 public taskCount;

    struct Task {
        uint256 id;
        address creator;
        string title;
        string description;
        string category;
        uint8 kind;
        uint8 optionCount;
        string[] options;
        uint256 reward; // wei paid per correct/approved frame (pre-fee)
        uint256 bounty; // MON still locked in escrow
        uint256 completed;
        uint256 rejected;
        uint256 frameCount;
        bool active;
        // --- Geofencing (Section 4 of the spec) ---
        int256 latE7; // latitude * 1e7
        int256 lngE7; // longitude * 1e7
        uint32 radiusMeters;
    }

    mapping(uint256 => Task) public tasks;

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /// @dev taskId => frameId => golden answer hash (Track A only)
    mapping(uint256 => mapping(uint256 => bytes32)) private _golden;
    /// @dev taskId => frameId => frame already paid to a worker
    mapping(uint256 => mapping(uint256 => bool)) private _framePaid;

    /// @dev Track B: taskId => frameId => worker currently awaiting resolution
    mapping(uint256 => mapping(uint256 => address)) public photoSubmitter;
    /// @dev Track B: taskId => frameId => keccak256 reference to the
    ///      off-chain photo (e.g. hash of its storage URL or content hash),
    ///      kept on-chain purely as an audit trail.
    mapping(uint256 => mapping(uint256 => bytes32)) public photoProofRef;

    uint256 public accumulatedFees;

    // --- Gamification (carried forward from MicroTask.sol) ---
    mapping(address => uint256) public points;
    mapping(address => uint32) public winStreak;
    mapping(address => uint32) public dayStreak;
    mapping(address => uint48) public lastCorrectDay;

    address[] private _workers;
    mapping(address => bool) private _isWorker;

    // --- Errors ---
    error TaskClosed();
    error FrameOutOfRange();
    error NoAnswerKey();
    error FrameAlreadyClaimed();
    error NotAuthorized();
    error NotAPhotoTask();
    error NoSubmissionForFrame();
    error BadFrameCount();
    error AnswerKeyMismatch();
    error BadKind();
    error BadOptionCount();
    error EscrowTooSmall();
    error RewardMustBePositive();
    error BadRadius();

    event TaskCreated(
        uint256 indexed id,
        address creator,
        string category,
        uint256 reward,
        uint8 kind,
        int256 latE7,
        int256 lngE7,
        uint32 radiusMeters
    );
    event AnswerAccepted(uint256 indexed taskId, uint256 frameId, address worker, uint256 amount);
    event AnswerRejected(uint256 indexed taskId, uint256 frameId, address worker, uint8 option);
    event TaskClosedEv(uint256 indexed taskId);
    event XpEarned(address indexed worker, uint256 points, uint32 winStreak, uint32 dayStreak);

    event PhotoProofSubmitted(uint256 indexed taskId, uint256 frameId, address indexed worker, bytes32 proofRef);
    event PhotoTaskResolved(
        uint256 indexed taskId,
        uint256 frameId,
        address indexed worker,
        bool approved,
        uint16 confidenceBps,
        uint256 amount
    );
    event PhotoOracleUpdated(address indexed oracle);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor(address initialPhotoOracle) {
        owner = msg.sender;
        protocolFee = 200;
        photoOracle = initialPhotoOracle;
    }

    function setPhotoOracle(address oracle) external onlyOwner {
        photoOracle = oracle;
        emit PhotoOracleUpdated(oracle);
    }

    /// @notice Create a quest. Track A (`kind` 0-3) requires `goldenAnswers`
    ///         to cover every frame. Track B (`kind` == KIND_PHOTO) requires
    ///         an empty `goldenAnswers` array — verdicts come from the
    ///         photo oracle instead of an on-chain hash comparison.
    function createTask(
        string calldata title,
        string calldata description,
        string calldata category,
        uint8 kind,
        uint8 optionCount,
        string[] calldata options,
        uint256 rewardPerFrame,
        uint256 frameCount,
        bytes32[] calldata goldenAnswers,
        int256 latE7,
        int256 lngE7,
        uint32 radiusMeters
    ) external payable returns (uint256 id) {
        if (rewardPerFrame == 0) revert RewardMustBePositive();
        if (frameCount == 0 || frameCount > MAX_FRAMES) revert BadFrameCount();
        if (kind > KIND_PHOTO) revert BadKind();
        if (radiusMeters == 0) revert BadRadius();

        if (kind == KIND_PHOTO) {
            if (goldenAnswers.length != 0) revert AnswerKeyMismatch();
        } else {
            if (goldenAnswers.length != frameCount) revert AnswerKeyMismatch();
            if (kind == KIND_OPTIONS) {
                if (optionCount < 2) revert BadOptionCount();
                if (options.length != optionCount) revert BadOptionCount();
            }
        }

        if (msg.value < rewardPerFrame * frameCount) revert EscrowTooSmall();

        id = taskCount++;
        Task storage t = tasks[id];
        t.id = id;
        t.creator = msg.sender;
        t.title = title;
        t.description = description;
        t.category = category;
        t.kind = kind;
        t.optionCount = kind == KIND_OPTIONS
            ? optionCount
            : (kind == KIND_YESNO ? 2 : (kind == KIND_RATING ? 5 : 0));
        for (uint256 i = 0; i < options.length; i++) {
            t.options.push(options[i]);
        }
        t.reward = rewardPerFrame;
        t.bounty = msg.value;
        t.frameCount = frameCount;
        t.active = true;
        t.latE7 = latE7;
        t.lngE7 = lngE7;
        t.radiusMeters = radiusMeters;

        for (uint256 i = 0; i < goldenAnswers.length; i++) {
            _golden[id][i] = goldenAnswers[i];
        }

        emit TaskCreated(id, msg.sender, category, rewardPerFrame, kind, latE7, lngE7, radiusMeters);
    }

    // --- Track A: golden-key judging (unchanged from MicroTask.sol) ---

    function submitAnswer(uint256 taskId, uint256 frameId, bytes32 answer) external {
        Task storage t = tasks[taskId];
        if (!t.active) revert TaskClosed();
        if (frameId >= t.frameCount) revert FrameOutOfRange();
        if (t.kind == KIND_PHOTO) revert NotAPhotoTask();

        bytes32 golden = _golden[taskId][frameId];
        if (golden == bytes32(0)) revert NoAnswerKey();

        if (answer == golden) {
            if (_framePaid[taskId][frameId]) revert FrameAlreadyClaimed();
            _framePaid[taskId][frameId] = true;

            uint256 fee = (t.reward * protocolFee) / 10000;
            uint256 payout = t.reward - fee;
            accumulatedFees += fee;
            t.bounty -= t.reward;
            t.completed += 1;

            _grantPoints(msg.sender);

            emit AnswerAccepted(taskId, frameId, msg.sender, payout);

            (bool ok, ) = msg.sender.call{value: payout}("");
            require(ok, "payout failed");

            if (t.bounty == 0) t.active = false;
        } else {
            t.rejected += 1;
            winStreak[msg.sender] = 0;
            emit AnswerRejected(taskId, frameId, msg.sender, uint8(answer[0]));
        }
    }

    // --- Track B: photo-proof judging (new) ---

    /// @notice Worker registers a photo submission for a frame. `proofRef`
    ///         is a keccak256 reference to the uploaded photo (its storage
    ///         URL or content hash) kept on-chain as an audit trail; the
    ///         photo bytes themselves are never stored on-chain.
    function submitPhotoProof(uint256 taskId, uint256 frameId, bytes32 proofRef) external {
        Task storage t = tasks[taskId];
        if (!t.active) revert TaskClosed();
        if (t.kind != KIND_PHOTO) revert NotAPhotoTask();
        if (frameId >= t.frameCount) revert FrameOutOfRange();
        if (_framePaid[taskId][frameId]) revert FrameAlreadyClaimed();

        photoSubmitter[taskId][frameId] = msg.sender;
        photoProofRef[taskId][frameId] = proofRef;

        emit PhotoProofSubmitted(taskId, frameId, msg.sender, proofRef);
    }

    /// @notice Oracle-only: resolve a photo submission with the AI vision
    ///         judge's verdict. On approval, pays the submitting worker
    ///         instantly, exactly like Track A's instant payout. On
    ///         rejection, clears the pending submission so the same or a
    ///         different worker can retry the frame; no funds move.
    function resolvePhotoTask(
        uint256 taskId,
        uint256 frameId,
        bool approved,
        uint16 confidenceBps
    ) external {
        if (msg.sender != owner && msg.sender != photoOracle) revert NotAuthorized();

        Task storage t = tasks[taskId];
        if (t.kind != KIND_PHOTO) revert NotAPhotoTask();
        if (frameId >= t.frameCount) revert FrameOutOfRange();

        address worker = photoSubmitter[taskId][frameId];
        if (worker == address(0)) revert NoSubmissionForFrame();
        if (_framePaid[taskId][frameId]) revert FrameAlreadyClaimed();

        if (approved) {
            _framePaid[taskId][frameId] = true;

            uint256 fee = (t.reward * protocolFee) / 10000;
            uint256 payout = t.reward - fee;
            accumulatedFees += fee;
            t.bounty -= t.reward;
            t.completed += 1;

            _grantPoints(worker);

            emit PhotoTaskResolved(taskId, frameId, worker, true, confidenceBps, payout);

            (bool ok, ) = worker.call{value: payout}("");
            require(ok, "payout failed");

            if (t.bounty == 0) t.active = false;
        } else {
            t.rejected += 1;
            winStreak[worker] = 0;
            photoSubmitter[taskId][frameId] = address(0);
            emit PhotoTaskResolved(taskId, frameId, worker, false, confidenceBps, 0);
        }
    }

    function closeTask(uint256 taskId) external {
        Task storage t = tasks[taskId];
        if (!t.active) revert TaskClosed();
        if (msg.sender != t.creator && msg.sender != owner) revert NotAuthorized();
        uint256 refund = t.bounty;
        t.bounty = 0;
        t.active = false;
        if (refund > 0) {
            (bool ok, ) = t.creator.call{value: refund}("");
            require(ok, "withdraw failed");
        }
        emit TaskClosedEv(taskId);
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        (bool ok, ) = owner.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function _grantPoints(address worker) internal {
        points[worker] += XP_PER_CORRECT;
        uint32 win = winStreak[worker] + 1;
        winStreak[worker] = win;

        uint48 today = uint48(block.timestamp / 86400) + 1;
        uint48 last = lastCorrectDay[worker];
        if (last == 0 || last < today - 1) {
            dayStreak[worker] = 1;
        } else if (last == today - 1) {
            dayStreak[worker] += 1;
        }
        lastCorrectDay[worker] = today;

        if (!_isWorker[worker]) {
            _isWorker[worker] = true;
            _workers.push(worker);
        }

        emit XpEarned(worker, points[worker], win, dayStreak[worker]);
    }

    function getLeaderboard(uint256 limit)
        external
        view
        returns (address[] memory addrs, uint256[] memory pts, uint32[] memory wins, uint32[] memory streakDays)
    {
        uint256 total = _workers.length;
        uint256 n = total < limit ? total : limit;

        address[] memory all = new address[](total);
        uint256[] memory allPts = new uint256[](total);
        uint32[] memory allWins = new uint32[](total);
        uint32[] memory allDays = new uint32[](total);

        for (uint256 i = 0; i < total; i++) {
            address w = _workers[i];
            all[i] = w;
            allPts[i] = points[w];
            allWins[i] = winStreak[w];
            allDays[i] = dayStreak[w];
        }

        for (uint256 i = 1; i < total; i++) {
            uint256 j = i;
            while (j > 0 && allPts[j] > allPts[j - 1]) {
                (all[j], all[j - 1]) = (all[j - 1], all[j]);
                (allPts[j], allPts[j - 1]) = (allPts[j - 1], allPts[j]);
                (allWins[j], allWins[j - 1]) = (allWins[j - 1], allWins[j]);
                (allDays[j], allDays[j - 1]) = (allDays[j - 1], allDays[j]);
                j--;
            }
        }

        addrs = new address[](n);
        pts = new uint256[](n);
        wins = new uint32[](n);
        streakDays = new uint32[](n);

        for (uint256 i = 0; i < n; i++) {
            addrs[i] = all[i];
            pts[i] = allPts[i];
            wins[i] = allWins[i];
            streakDays[i] = allDays[i];
        }
    }
}
