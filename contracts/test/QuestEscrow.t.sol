// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/QuestEscrow.sol";

contract QuestEscrowTest is Test {
    QuestEscrow escrow;

    address creator = makeAddr("creator");
    address worker = makeAddr("worker");
    address otherWorker = makeAddr("otherWorker");
    address oracle = makeAddr("oracle");

    // NYC-ish coordinates for test geofence fields (not enforced on-chain,
    // just stored/emitted — see contract NatSpec on GPS being a UX gate).
    int256 constant LAT_E7 = 407128000;
    int256 constant LNG_E7 = -740060000;
    uint32 constant RADIUS = 50;

    function setUp() public {
        escrow = new QuestEscrow(oracle);
        vm.deal(creator, 100 ether);
        vm.deal(worker, 1 ether);
        vm.deal(otherWorker, 1 ether);
    }

    // --- Track A: golden-key ---

    function testCreateAndSolveYesNoTask() public {
        bytes32[] memory answers = new bytes32[](1);
        bytes32 golden = keccak256(abi.encodePacked(uint8(1))); // "yes"
        answers[0] = golden;

        string[] memory noOptions = new string[](0);

        // KIND_YESNO() must be read BEFORE vm.prank — vm.prank only overrides
        // msg.sender for the very next external call, and an inline
        // `escrow.KIND_YESNO()` argument is itself a call that would consume
        // the prank before createTask ever runs.
        uint8 kind = escrow.KIND_YESNO();

        vm.prank(creator);
        uint256 taskId = escrow.createTask{value: 1 ether}(
            "Is the cafe open?",
            "Confirm signage says open",
            "venue-open",
            kind,
            0,
            noOptions,
            1 ether,
            1,
            answers,
            LAT_E7,
            LNG_E7,
            RADIUS
        );

        QuestEscrow.Task memory created = escrow.getTask(taskId);
        assertEq(created.creator, creator);

        uint256 balanceBefore = worker.balance;

        vm.prank(worker);
        escrow.submitAnswer(taskId, 0, golden);

        // 2% protocol fee taken out of the 1 ether reward.
        assertEq(worker.balance, balanceBefore + 0.98 ether);
        assertEq(escrow.points(worker), 100);

        QuestEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(t.completed, 1);
        assertFalse(t.active); // bounty fully drained after 1 frame
    }

    function testWrongAnswerDoesNotPay() public {
        bytes32[] memory answers = new bytes32[](1);
        answers[0] = keccak256(abi.encodePacked(uint8(1)));
        string[] memory noOptions = new string[](0);

        uint8 kind = escrow.KIND_YESNO();

        vm.prank(creator);
        uint256 taskId = escrow.createTask{value: 1 ether}(
            "Is the cafe open?", "", "venue-open", kind, 0, noOptions,
            1 ether, 1, answers, LAT_E7, LNG_E7, RADIUS
        );

        uint256 balanceBefore = worker.balance;
        vm.prank(worker);
        escrow.submitAnswer(taskId, 0, keccak256(abi.encodePacked(uint8(0))));

        assertEq(worker.balance, balanceBefore);
        assertEq(escrow.winStreak(worker), 0);
    }

    function testCannotClaimFrameTwice() public {
        bytes32[] memory answers = new bytes32[](2);
        answers[0] = keccak256("a");
        answers[1] = keccak256("b");
        string[] memory noOptions = new string[](0);

        uint8 kind = escrow.KIND_TEXT();

        vm.prank(creator);
        uint256 taskId = escrow.createTask{value: 2 ether}(
            "t", "", "other", kind, 0, noOptions,
            1 ether, 2, answers, LAT_E7, LNG_E7, RADIUS
        );

        vm.prank(worker);
        escrow.submitAnswer(taskId, 0, keccak256("a"));

        // _golden[taskId][0] is never cleared after a successful claim, so a
        // second correct submission passes the NoAnswerKey check and instead
        // trips the _framePaid guard.
        vm.expectRevert(QuestEscrow.FrameAlreadyClaimed.selector);
        vm.prank(otherWorker);
        escrow.submitAnswer(taskId, 0, keccak256("a"));
    }

    // --- Track B: photo-proof ---

    function testPhotoTaskRequiresEmptyGoldenAnswers() public {
        bytes32[] memory answers = new bytes32[](1);
        answers[0] = keccak256("nonempty");
        string[] memory noOptions = new string[](0);

        // KIND_PHOTO() must be read BEFORE vm.expectRevert/vm.prank — an
        // inline `escrow.KIND_PHOTO()` argument is itself a call, and it
        // would be the "next call" that expectRevert checks instead of
        // createTask (that staticcall doesn't revert, so expectRevert fails
        // before createTask is ever invoked).
        uint8 kind = escrow.KIND_PHOTO();

        vm.expectRevert(QuestEscrow.AnswerKeyMismatch.selector);
        vm.prank(creator);
        escrow.createTask{value: 1 ether}(
            "Photo of shelf", "", "shelf-check", kind, 0, noOptions,
            1 ether, 1, answers, LAT_E7, LNG_E7, RADIUS
        );
    }

    function testPhotoTaskApprovedFlow() public {
        bytes32[] memory answers = new bytes32[](0);
        string[] memory noOptions = new string[](0);

        uint8 kind = escrow.KIND_PHOTO();

        vm.prank(creator);
        uint256 taskId = escrow.createTask{value: 1 ether}(
            "Photo of shelf", "Show the endcap display", "shelf-check",
            kind, 0, noOptions, 1 ether, 1, answers, LAT_E7, LNG_E7, RADIUS
        );

        bytes32 proofRef = keccak256("ipfs://proof-cid");
        vm.prank(worker);
        escrow.submitPhotoProof(taskId, 0, proofRef);

        assertEq(escrow.photoSubmitter(taskId, 0), worker);

        uint256 balanceBefore = worker.balance;
        vm.prank(oracle);
        escrow.resolvePhotoTask(taskId, 0, true, 9500);

        assertEq(worker.balance, balanceBefore + 0.98 ether);
        assertEq(escrow.points(worker), 100);
    }

    function testPhotoTaskRejectedAllowsResubmission() public {
        bytes32[] memory answers = new bytes32[](0);
        string[] memory noOptions = new string[](0);

        uint8 kind = escrow.KIND_PHOTO();

        vm.prank(creator);
        uint256 taskId = escrow.createTask{value: 1 ether}(
            "Photo of shelf", "", "shelf-check", kind, 0, noOptions,
            1 ether, 1, answers, LAT_E7, LNG_E7, RADIUS
        );

        vm.prank(worker);
        escrow.submitPhotoProof(taskId, 0, keccak256("bad-photo"));

        vm.prank(oracle);
        escrow.resolvePhotoTask(taskId, 0, false, 2000);

        assertEq(escrow.photoSubmitter(taskId, 0), address(0));

        // A different worker can now try the same frame.
        vm.prank(otherWorker);
        escrow.submitPhotoProof(taskId, 0, keccak256("better-photo"));
        assertEq(escrow.photoSubmitter(taskId, 0), otherWorker);
    }

    function testOnlyOracleOrOwnerCanResolvePhotoTask() public {
        bytes32[] memory answers = new bytes32[](0);
        string[] memory noOptions = new string[](0);

        uint8 kind = escrow.KIND_PHOTO();

        vm.prank(creator);
        uint256 taskId = escrow.createTask{value: 1 ether}(
            "Photo of shelf", "", "shelf-check", kind, 0, noOptions,
            1 ether, 1, answers, LAT_E7, LNG_E7, RADIUS
        );

        vm.prank(worker);
        escrow.submitPhotoProof(taskId, 0, keccak256("proof"));

        vm.expectRevert(QuestEscrow.NotAuthorized.selector);
        vm.prank(worker);
        escrow.resolvePhotoTask(taskId, 0, true, 9000);
    }

    function testCloseTaskRefundsCreator() public {
        bytes32[] memory answers = new bytes32[](2);
        answers[0] = keccak256("a");
        answers[1] = keccak256("b");
        string[] memory noOptions = new string[](0);

        uint8 kind = escrow.KIND_TEXT();

        vm.prank(creator);
        uint256 taskId = escrow.createTask{value: 2 ether}(
            "t", "", "other", kind, 0, noOptions,
            1 ether, 2, answers, LAT_E7, LNG_E7, RADIUS
        );

        uint256 balanceBefore = creator.balance;
        vm.prank(creator);
        escrow.closeTask(taskId);

        assertEq(creator.balance, balanceBefore + 2 ether);
    }
}
