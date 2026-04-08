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
        uint256 roundId;
        bytes32 groupKey;
        bytes32 winnerMerchantKey;
        bytes32 menuSnapshotHash;
        bytes32 orderDetailHash;
        address merchantWallet;
        address payer;
        address[] participantAddresses;
        uint256 totalParticipants;
        uint256 totalQuantity;
        uint256 totalOrderAmountWei;
        uint256 submittedAt;
        uint256 merchantAcceptedAt;
        uint256 merchantCompletedAt;
        uint256 memberConfirmedAt;
        uint256 paidOutAt;
        uint256 merchantAmountWei;
        uint256 platformAmountWei;
        EscrowStatus status;
        bool payoutReleased;
        bool paused;
    }

    address public owner;
    address public platformWallet;
    EscrowParams public params;
    uint256 public orderEscrowCount;

    mapping(uint256 => OrderEscrow) public escrows;
    mapping(uint256 => mapping(address => uint256)) public memberPaidWei;

    event EscrowParamsUpdated(address indexed updatedBy);
    event OrderEscrowOpened(uint256 indexed orderId, uint256 indexed roundId, bytes32 indexed winnerMerchantKey, address merchantWallet);
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
        address merchantWallet,
        address[] calldata participantAddresses,
        uint256 totalQuantity,
        uint256 totalOrderAmountWei
    ) external onlyOwner returns (uint256 orderId) {
        require(merchantWallet != address(0), "zero merchant wallet");
        orderId = ++orderEscrowCount;

        OrderEscrow storage escrow = escrows[orderId];
        escrow.roundId = roundId;
        escrow.groupKey = groupKey;
        escrow.winnerMerchantKey = winnerMerchantKey;
        escrow.menuSnapshotHash = menuSnapshotHash;
        escrow.orderDetailHash = orderDetailHash;
        escrow.merchantWallet = merchantWallet;
        escrow.participantAddresses = participantAddresses;
        escrow.totalParticipants = participantAddresses.length;
        escrow.totalQuantity = totalQuantity;
        escrow.totalOrderAmountWei = totalOrderAmountWei;
        escrow.submittedAt = block.timestamp;
        escrow.status = EscrowStatus.Open;

        emit OrderEscrowOpened(orderId, roundId, winnerMerchantKey, merchantWallet);
    }

    function payForOrder(uint256 orderId) external payable {
        OrderEscrow storage escrow = escrows[orderId];
        require(escrow.submittedAt > 0, "escrow missing");
        require(escrow.status == EscrowStatus.Open, "escrow closed");
        require(msg.value > 0, "zero payment");

        memberPaidWei[orderId][msg.sender] += msg.value;
        escrow.payer = msg.sender;
        emit OrderPaymentSubmitted(orderId, msg.sender, msg.value);
    }

    function merchantAccept(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(msg.sender == escrow.merchantWallet, "not merchant");
        require(escrow.status == EscrowStatus.Open, "status invalid");
        escrow.status = EscrowStatus.MerchantAccepted;
        escrow.merchantAcceptedAt = block.timestamp;
        emit MerchantAccepted(orderId, msg.sender);
    }

    function merchantComplete(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(msg.sender == escrow.merchantWallet, "not merchant");
        require(escrow.status == EscrowStatus.MerchantAccepted, "status invalid");
        escrow.status = EscrowStatus.MerchantCompleted;
        escrow.merchantCompletedAt = block.timestamp;
        emit MerchantCompleted(orderId, msg.sender);
    }

    function memberConfirmReceived(uint256 orderId) external {
        OrderEscrow storage escrow = escrows[orderId];
        require(escrow.status == EscrowStatus.MerchantCompleted, "status invalid");
        require(memberPaidWei[orderId][msg.sender] > 0, "not participant");

        escrow.status = EscrowStatus.MemberConfirmed;
        escrow.memberConfirmedAt = block.timestamp;

        uint256 platformAmountWei = (escrow.totalOrderAmountWei * params.platformEscrowFeeBps) / 10000;
        uint256 merchantAmountWei = escrow.totalOrderAmountWei - platformAmountWei;
        escrow.merchantAmountWei = merchantAmountWei;
        escrow.platformAmountWei = platformAmountWei;

        emit MemberConfirmed(orderId, msg.sender);
        emit MerchantPayoutPrepared(orderId, merchantAmountWei, platformAmountWei);
    }

    function releasePayout(uint256 orderId) external onlyOwner {
        OrderEscrow storage escrow = escrows[orderId];
        require(escrow.submittedAt > 0, "escrow missing");
        require(escrow.status == EscrowStatus.MemberConfirmed, "status invalid");
        require(!escrow.payoutReleased, "already released");

        escrow.payoutReleased = true;
        escrow.status = EscrowStatus.PaidOut;
        escrow.paidOutAt = block.timestamp;

        if (escrow.merchantAmountWei > 0) {
            payable(escrow.merchantWallet).transfer(escrow.merchantAmountWei);
        }
        if (escrow.platformAmountWei > 0) {
            payable(platformWallet).transfer(escrow.platformAmountWei);
        }

        emit PayoutReleased(orderId, escrow.merchantWallet, escrow.merchantAmountWei, escrow.platformAmountWei);
    }

    function pauseEscrow(uint256 orderId) external onlyOwner {
        escrows[orderId].paused = true;
        escrows[orderId].status = EscrowStatus.Paused;
        emit EscrowPaused(msg.sender, orderId);
    }

    function unpauseEscrow(uint256 orderId, EscrowStatus resumeStatus) external onlyOwner {
        escrows[orderId].paused = false;
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
