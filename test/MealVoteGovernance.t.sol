// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// 需要先執行：
// forge install foundry-rs/forge-std
import "forge-std/Test.sol";

import "../contract/MealVoteGovernance.sol";

contract MealVoteGovernanceTest is Test {
    MealVoteGovernance internal governance;

    address internal platform = address(0x1001);
    address internal alice = address(0x1002);
    address internal bob = address(0x1003);

    function setUp() public {
        MealVoteGovernance.GovernanceParams memory params = MealVoteGovernance.GovernanceParams({
            createFeeWei: 1 ether,
            proposalFeeWei: 0.5 ether,
            voteFeeWei: 0.2 ether,
            subscriptionFeeWei: 0.1 ether,
            winnerProposalRefundBps: 9000,
            loserProposalRefundBps: 8000,
            voteRefundBps: 5000,
            winnerBonusBps: 1000,
            loserBonusBps: 500,
            winnerProposalPoints: 5,
            winnerVotePointsPerVote: 2,
            proposalDurationMinutes: 10,
            voteDurationMinutes: 10,
            orderingDurationMinutes: 10,
            dailyCreateCouponCount: 1,
            dailyProposalCouponCount: 1,
            dailyVoteCouponCount: 1,
            governanceClaimTimeoutMins: 43200,
            subscriptionDurationDays: 30
        });
        governance = new MealVoteGovernance(platform, params);
        vm.deal(alice, 20 ether);
        vm.deal(bob, 20 ether);
    }

    function testCreateRoundWithInitialMerchant() public {
        bytes32[] memory merchants = new bytes32[](1);
        merchants[0] = keccak256("merchant:demo");
        bool[] memory useProposalCoupons = new bool[](1);
        useProposalCoupons[0] = false;

        vm.prank(alice);
        uint256 roundId = governance.createRound{value: 1.5 ether}(
            keccak256("group:demo"),
            keccak256("title:lunch"),
            merchants,
            false,
            useProposalCoupons
        );

        assertEq(roundId, 1);
        (address creator, , , , , , ) = governance.rounds(roundId);
        assertEq(creator, alice);
    }

    function testClaimDailyCouponsSetsBalances() public {
        vm.prank(alice);
        governance.claimDailyCoupons(20260407);

        (uint256 dayKey, uint256 createCoupons, uint256 proposalCoupons, uint256 voteCoupons, bool claimed) = governance.coupons(alice);
        assertEq(dayKey, 20260407);
        assertEq(createCoupons, 1);
        assertEq(proposalCoupons, 1);
        assertEq(voteCoupons, 1);
        assertTrue(claimed);
    }

    function testSubscribeMonthlyUpdatesExpiry() public {
        vm.prank(alice);
        uint256 expiresAt = governance.subscribeMonthly{value: 0.1 ether}();

        assertGt(expiresAt, block.timestamp);
        assertEq(governance.subscriptionExpiresAt(alice), expiresAt);
    }

    function testCastVoteWithCoupon() public {
        bytes32[] memory merchants = new bytes32[](1);
        merchants[0] = keccak256("merchant:demo");
        bool[] memory useProposalCoupons = new bool[](1);
        useProposalCoupons[0] = false;

        vm.prank(alice);
        uint256 roundId = governance.createRound{value: 1.5 ether}(
            keccak256("group:demo"),
            keccak256("title:lunch"),
            merchants,
            false,
            useProposalCoupons
        );

        vm.prank(bob);
        governance.claimDailyCoupons(20260408);

        vm.warp(block.timestamp + 11 minutes);

        vm.prank(bob);
        governance.castVote{value: 0.4 ether}(roundId, 1, 3, true);

        uint256 packedVote = governance.votes(roundId, bob);
        assertEq(packedVote & ((uint256(1) << 24) - 1), 1);
        assertEq((packedVote >> 24) & ((uint256(1) << 24) - 1), 3);
        assertEq((packedVote >> 48) & 1, 1);
    }
}
