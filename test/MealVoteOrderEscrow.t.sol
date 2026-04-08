// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// 需要先執行：
// forge install foundry-rs/forge-std
import "forge-std/Test.sol";

import "../contract/MealVoteOrderEscrow.sol";

contract MealVoteOrderEscrowTest is Test {
    MealVoteOrderEscrow internal escrow;

    address internal platform = address(0x2001);
    address internal merchant = address(0x2002);
    address internal alice = address(0x2003);

    function setUp() public {
        MealVoteOrderEscrow.EscrowParams memory params = MealVoteOrderEscrow.EscrowParams({
            platformEscrowFeeBps: 0,
            merchantAcceptTimeoutMins: 1440,
            merchantCompleteTimeoutMins: 10080,
            memberConfirmTimeoutMins: 10080,
            escrowClaimTimeoutMins: 43200
        });
        escrow = new MealVoteOrderEscrow(platform, params);
        vm.deal(alice, 20 ether);
    }

    function testOpenEscrowAndPay() public {
        uint256 orderId = escrow.openEscrow(
            1,
            keccak256("group:demo"),
            keccak256("merchant:winner"),
            keccak256("menu:snapshot"),
            keccak256("order:detail"),
            keccak256("participants:alice"),
            merchant,
            1,
            2,
            1 ether
        );

        vm.prank(alice);
        escrow.payForOrder{value: 1 ether}(orderId);

        assertEq(escrow.memberPaidWei(orderId, alice), 1 ether);
    }

    function testReleasePayoutAfterMemberConfirm() public {
        uint256 orderId = escrow.openEscrow(
            1,
            keccak256("group:demo"),
            keccak256("merchant:winner"),
            keccak256("menu:snapshot"),
            keccak256("order:detail"),
            keccak256("participants:alice"),
            merchant,
            1,
            2,
            1 ether
        );

        vm.prank(alice);
        escrow.payForOrder{value: 1 ether}(orderId);

        vm.prank(merchant);
        escrow.merchantAccept(orderId);

        vm.prank(merchant);
        escrow.merchantComplete(orderId);

        vm.prank(alice);
        escrow.memberConfirmReceived(orderId);

        uint256 merchantBalanceBefore = merchant.balance;
        uint256 platformBalanceBefore = platform.balance;

        escrow.releasePayout(orderId);

        assertEq(merchant.balance, merchantBalanceBefore + 1 ether);
        assertEq(platform.balance, platformBalanceBefore);
    }
}
