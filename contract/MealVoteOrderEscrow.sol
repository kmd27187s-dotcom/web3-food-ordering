// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MealVoteOrderEscrow {
    enum EscrowStatus {
        Open,
        MerchantAccepted,
        MerchantCompleted,
        MemberConfirmed,
        PaidOut,
        Refunded,
        Disputed,
        Paused
    }

    struct EscrowParams {
        uint16 platformEscrowFeeBps;
        uint32 merchantAcceptTimeoutMins;
        uint32 merchantCompleteTimeoutMins;
        uint32 memberConfirmTimeoutMins;
        uint32 escrowClaimTimeoutMins;
    }

    struct OrderEscrow {
        address merchantWallet;
        uint16 platformFeeBpsSnapshot;
        uint128 totalOrderAmountWei;
        EscrowStatus status;
    }

    address public owner;
    address public platformWallet;
    EscrowParams public params;
    uint256 public orderEscrowCount;

    mapping(uint256 => OrderEscrow) public escrows;
    mapping(uint256 => mapping(address => uint256)) public memberPaidWei;

    event EscrowParamsUpdated(address indexed updatedBy);
    event OrderEscrowOpened(uint256 indexed orderId, uint256 indexed roundId, bytes32 orderDetailHash);
    event OrderPaymentSubmitted(uint256 indexed orderId, address indexed payer, uint256 amountWei);
    event MerchantAccepted(uint256 indexed orderId);
    event MerchantCompleted(uint256 indexed orderId);
    event MemberConfirmed(uint256 indexed orderId, address indexed member);
    event PayoutReleased(uint256 indexed orderId, uint256 merchantAmountWei, uint256 platformAmountWei);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address platformWallet_, EscrowParams memory initialParams) {
        require(platformWallet_ != address(0), "zero wallet");
        owner = msg.sender;
        platformWallet = platformWallet_;
        _setEscrowParams(initialParams);
    }

    function setEscrowParams(EscrowParams calldata nextParams) external onlyOwner {
        _setEscrowParams(nextParams);
    }

    function openEscrow(
        uint256 roundId,
        bytes32 /* groupKey */,
        bytes32 /* winnerMerchantKey */,
        bytes32 /* menuSnapshotHash */,
        bytes32 orderDetailHash,
        bytes32 /* participantHash */,
        address merchantWallet,
        uint256 /* totalParticipants */,
        uint256 /* totalQuantity */,
        uint256 totalOrderAmountWei
    ) external onlyOwner returns (uint256 orderId) {
        require(merchantWallet != address(0), "zero merchant wallet");
        orderId = ++orderEscrowCount;

        OrderEscrow storage escrow = escrows[orderId];
        escrow.merchantWallet = merchantWallet;
        escrow.totalOrderAmountWei = uint128(totalOrderAmountWei);
        escrow.platformFeeBpsSnapshot = params.platformEscrowFeeBps;
        escrow.status = EscrowStatus.Open;

        emit OrderEscrowOpened(orderId, roundId, orderDetailHash);
    }

    function payForOrder(uint256 orderId) external payable {
        OrderEscrow storage escrow = escrows[orderId];
        require(escrow.merchantWallet != address(0), "escrow missing");
        require(escrow.status == EscrowStatus.Open, "escrow closed");
        require(msg.value > 0, "zero payment");

        memberPaidWei[orderId][msg.sender] += msg.value;
        emit OrderPaymentSubmitted(orderId, msg.sender, msg.value);
    }

    function merchantAccept(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(msg.sender == escrow.merchantWallet, "not merchant");
        require(escrow.status == EscrowStatus.Open, "status invalid");
        escrow.status = EscrowStatus.MerchantAccepted;
        emit MerchantAccepted(orderId);
    }

    function merchantComplete(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(msg.sender == escrow.merchantWallet, "not merchant");
        require(escrow.status == EscrowStatus.MerchantAccepted, "status invalid");
        escrow.status = EscrowStatus.MerchantCompleted;
        emit MerchantCompleted(orderId);
    }

    function memberConfirmReceived(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(escrow.status == EscrowStatus.MerchantCompleted, "status invalid");
        require(memberPaidWei[orderId][msg.sender] > 0, "not participant");

        escrow.status = EscrowStatus.MemberConfirmed;

        emit MemberConfirmed(orderId, msg.sender);
    }

    function releasePayout(uint256 orderId) external onlyOwner {
        OrderEscrow storage escrow = escrows[orderId];
        require(escrow.merchantWallet != address(0), "escrow missing");
        require(escrow.status == EscrowStatus.MemberConfirmed, "status invalid");

        escrow.status = EscrowStatus.PaidOut;

        uint256 platformAmountWei = (uint256(escrow.totalOrderAmountWei) * escrow.platformFeeBpsSnapshot) / 10000;
        uint256 merchantAmountWei = uint256(escrow.totalOrderAmountWei) - platformAmountWei;

        if (merchantAmountWei > 0) {
            payable(escrow.merchantWallet).transfer(merchantAmountWei);
        }
        if (platformAmountWei > 0) {
            payable(platformWallet).transfer(platformAmountWei);
        }

        emit PayoutReleased(orderId, merchantAmountWei, platformAmountWei);
    }

    function _setEscrowParams(EscrowParams memory nextParams) internal {
        require(nextParams.platformEscrowFeeBps <= 10000, "escrow fee bps");
        params = nextParams;
        emit EscrowParamsUpdated(msg.sender);
    }
}
