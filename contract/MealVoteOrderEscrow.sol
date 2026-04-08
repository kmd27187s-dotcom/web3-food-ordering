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
        bytes32 orderDetailHash;
        address merchantWallet;
        uint64 roundId;
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
    mapping(uint256 => bool) public pausedEscrows;

    event EscrowParamsUpdated(address indexed updatedBy);
    event OrderEscrowOpened(
        uint256 indexed orderId,
        uint256 indexed roundId,
        bytes32 indexed winnerMerchantKey,
        address merchantWallet,
        bytes32 groupKey,
        bytes32 menuSnapshotHash,
        bytes32 orderDetailHash,
        bytes32 participantHash,
        uint256 totalParticipants,
        uint256 totalQuantity,
        uint256 totalOrderAmountWei
    );
    event OrderPaymentSubmitted(uint256 indexed orderId, address indexed payer, uint256 amountWei);
    event MerchantAccepted(uint256 indexed orderId, address indexed merchantWallet);
    event MerchantCompleted(uint256 indexed orderId, address indexed merchantWallet);
    event MemberConfirmed(uint256 indexed orderId, address indexed member);
    event MerchantPayoutPrepared(uint256 indexed orderId, uint256 merchantAmountWei, uint256 platformAmountWei);
    event PayoutReleased(uint256 indexed orderId, address indexed merchantWallet, uint256 merchantAmountWei, uint256 platformAmountWei);
    event EscrowPaused(address indexed operator, uint256 indexed orderId);
    event EscrowUnpaused(address indexed operator, uint256 indexed orderId);
    event EscrowEmergencyRescue(address indexed operator, uint256 indexed orderId, address indexed recipient, uint256 amountWei, bytes32 reason);
    event EscrowTimeoutRecovery(address indexed operator, uint256 indexed orderId, address indexed recipient, uint256 amountWei, bytes32 reason);

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
        bytes32 groupKey,
        bytes32 winnerMerchantKey,
        bytes32 menuSnapshotHash,
        bytes32 orderDetailHash,
        bytes32 participantHash,
        address merchantWallet,
        uint256 totalParticipants,
        uint256 totalQuantity,
        uint256 totalOrderAmountWei
    ) external onlyOwner returns (uint256 orderId) {
        require(merchantWallet != address(0), "zero merchant wallet");
        orderId = ++orderEscrowCount;

        OrderEscrow storage escrow = escrows[orderId];
        escrow.roundId = uint64(roundId);
        escrow.orderDetailHash = orderDetailHash;
        escrow.merchantWallet = merchantWallet;
        escrow.totalOrderAmountWei = uint128(totalOrderAmountWei);
        escrow.platformFeeBpsSnapshot = params.platformEscrowFeeBps;
        escrow.status = EscrowStatus.Open;

        emit OrderEscrowOpened(
            orderId,
            roundId,
            winnerMerchantKey,
            merchantWallet,
            groupKey,
            menuSnapshotHash,
            orderDetailHash,
            participantHash,
            totalParticipants,
            totalQuantity,
            totalOrderAmountWei
        );
    }

    function payForOrder(uint256 orderId) external payable {
        OrderEscrow storage escrow = escrows[orderId];
        require(escrow.merchantWallet != address(0), "escrow missing");
        require(!pausedEscrows[orderId], "escrow paused");
        require(escrow.status == EscrowStatus.Open, "escrow closed");
        require(msg.value > 0, "zero payment");

        memberPaidWei[orderId][msg.sender] += msg.value;
        emit OrderPaymentSubmitted(orderId, msg.sender, msg.value);
    }

    function merchantAccept(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(msg.sender == escrow.merchantWallet, "not merchant");
        require(!pausedEscrows[orderId], "escrow paused");
        require(escrow.status == EscrowStatus.Open, "status invalid");
        escrow.status = EscrowStatus.MerchantAccepted;
        emit MerchantAccepted(orderId, msg.sender);
    }

    function merchantComplete(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(msg.sender == escrow.merchantWallet, "not merchant");
        require(!pausedEscrows[orderId], "escrow paused");
        require(escrow.status == EscrowStatus.MerchantAccepted, "status invalid");
        escrow.status = EscrowStatus.MerchantCompleted;
        emit MerchantCompleted(orderId, msg.sender);
    }

    function memberConfirmReceived(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(!pausedEscrows[orderId], "escrow paused");
        require(escrow.status == EscrowStatus.MerchantCompleted, "status invalid");
        require(memberPaidWei[orderId][msg.sender] > 0, "not participant");

        escrow.status = EscrowStatus.MemberConfirmed;

        uint256 platformAmountWei = (uint256(escrow.totalOrderAmountWei) * escrow.platformFeeBpsSnapshot) / 10000;
        uint256 merchantAmountWei = uint256(escrow.totalOrderAmountWei) - platformAmountWei;

        emit MemberConfirmed(orderId, msg.sender);
        emit MerchantPayoutPrepared(orderId, merchantAmountWei, platformAmountWei);
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

        emit PayoutReleased(orderId, escrow.merchantWallet, merchantAmountWei, platformAmountWei);
    }

    function pauseEscrow(uint256 orderId) external onlyOwner {
        pausedEscrows[orderId] = true;
        escrows[orderId].status = EscrowStatus.Paused;
        emit EscrowPaused(msg.sender, orderId);
    }

    function unpauseEscrow(uint256 orderId, EscrowStatus resumeStatus) external onlyOwner {
        pausedEscrows[orderId] = false;
        escrows[orderId].status = resumeStatus;
        emit EscrowUnpaused(msg.sender, orderId);
    }

    function emergencyRescueEscrow(uint256 orderId, address payable recipient, uint256 amountWei, bytes32 reason) external onlyOwner {
        require(recipient != address(0), "zero recipient");
        recipient.transfer(amountWei);
        emit EscrowEmergencyRescue(msg.sender, orderId, recipient, amountWei, reason);
    }

    function timeoutRecoveryEscrow(uint256 orderId, address payable recipient, uint256 amountWei, bytes32 reason) external onlyOwner {
        require(recipient != address(0), "zero recipient");
        recipient.transfer(amountWei);
        emit EscrowTimeoutRecovery(msg.sender, orderId, recipient, amountWei, reason);
    }

    function _setEscrowParams(EscrowParams memory nextParams) internal {
        require(nextParams.platformEscrowFeeBps <= 10000, "escrow fee bps");
        params = nextParams;
        emit EscrowParamsUpdated(msg.sender);
    }
}
