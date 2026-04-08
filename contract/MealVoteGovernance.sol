// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MealVoteGovernance {
    enum RoundStatus {
        Created,
        ProposalOpen,
        VotingOpen,
        VotingClosedSuccess,
        VotingClosedFailed,
        Cancelled,
        OrderingOpen
    }

    struct GovernanceParams {
        uint256 createFeeWei;
        uint256 proposalFeeWei;
        uint256 voteFeeWei;
        uint16 winnerProposalRefundBps;
        uint16 loserProposalRefundBps;
        uint16 voteRefundBps;
        uint16 winnerBonusBps;
        uint16 loserBonusBps;
        uint16 winnerProposalPoints;
        uint16 winnerVotePointsPerVote;
        uint32 proposalDurationMinutes;
        uint32 voteDurationMinutes;
        uint32 orderingDurationMinutes;
        uint16 dailyCreateCouponCount;
        uint16 dailyProposalCouponCount;
        uint16 dailyVoteCouponCount;
        uint32 governanceClaimTimeoutMins;
    }

    struct Round {
        bytes32 groupKey;
        bytes32 titleHash;
        address creator;
        RoundStatus status;
        uint256 createdAt;
        uint256 proposalDeadline;
        uint256 voteDeadline;
        uint256 orderingDeadline;
        uint256 createFeeSnapshot;
        uint256 proposalFeeSnapshot;
        uint256 voteFeeSnapshot;
        uint256 createFeeRefundableWei;
        uint256 createFeePlatformWei;
        uint256 totalVotes;
        uint256 winnerCandidateId;
        bool settled;
        bool paused;
    }

    struct Candidate {
        bytes32 merchantKey;
        address proposer;
        uint256 firstProposedAt;
        uint256 proposalFeePaidWei;
        uint256 voteFeeCollectedWei;
        uint256 voteRefundWei;
        uint256 proposerRefundWei;
        uint256 proposerRewardWei;
        uint256 voteCount;
        bool isWinner;
        bool usedProposalCoupon;
    }

    struct VoteRecord {
        uint256 candidateId;
        uint256 voteCount;
        uint256 feeAmountWei;
        uint256 refundWei;
        bool usedVoteCoupon;
        bool exists;
    }

    struct CouponState {
        uint256 dayKey;
        uint256 createCoupons;
        uint256 proposalCoupons;
        uint256 voteCoupons;
        bool claimed;
    }

    address public owner;
    address public platformWallet;
    GovernanceParams public params;
    uint256 public roundCount;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => uint256) public candidateCountByRound;
    mapping(uint256 => mapping(address => uint256)) public memberProposalCount;
    mapping(uint256 => mapping(bytes32 => bool)) public merchantAlreadyProposed;
    mapping(uint256 => mapping(address => VoteRecord)) public votes;
    mapping(address => CouponState) public coupons;
    mapping(address => uint256) public pointsBalance;
    mapping(address => uint256) public claimableGovernanceRefundWei;
    mapping(address => uint256) public claimableGovernanceRewardWei;
    mapping(address => uint256) public claimablePlatformShareWei;

    event GovernanceParamsUpdated(address indexed updatedBy);
    event DailyCouponsClaimed(address indexed member, uint256 indexed dayKey, uint256 createCoupons, uint256 proposalCoupons, uint256 voteCoupons);
    event RoundCreated(uint256 indexed roundId, address indexed creator, bytes32 indexed groupKey, uint256 proposalDeadline, uint256 voteDeadline, uint256 orderingDeadline);
    event MerchantProposed(uint256 indexed roundId, uint256 indexed candidateId, bytes32 indexed merchantKey, address proposer, bool usedCoupon);
    event VoteCast(uint256 indexed roundId, uint256 indexed candidateId, address indexed voter, uint256 voteCount, uint256 feeAmountWei, bool usedCoupon);
    event RoundCancelled(uint256 indexed roundId, address indexed creator, uint256 refundWei, uint256 platformWei);
    event RoundSettled(uint256 indexed roundId, uint256 indexed winnerCandidateId, uint256 totalVotes, bool failed);
    event GovernanceRefundClaimed(address indexed member, uint256 amountWei);
    event GovernanceRewardClaimed(address indexed member, uint256 amountWei);
    event PlatformShareClaimed(address indexed platformWallet, uint256 amountWei);
    event PointsGranted(address indexed member, uint256 indexed roundId, uint256 amount, bytes32 reason);
    event ContractPaused(address indexed operator, uint256 indexed roundId);
    event ContractUnpaused(address indexed operator, uint256 indexed roundId);
    event EmergencyRescue(address indexed operator, uint256 indexed roundId, address indexed recipient, uint256 amountWei, bytes32 reason);
    event TimeoutRecovery(address indexed operator, uint256 indexed roundId, address indexed recipient, uint256 amountWei, bytes32 reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address platformWallet_, GovernanceParams memory initialParams) {
        require(platformWallet_ != address(0), "zero wallet");
        owner = msg.sender;
        platformWallet = platformWallet_;
        _setGovernanceParams(initialParams);
    }

    function setGovernanceParams(GovernanceParams calldata nextParams) external onlyOwner {
        _setGovernanceParams(nextParams);
    }

    function claimDailyCoupons(uint256 dayKey) external {
        CouponState storage state = coupons[msg.sender];
        require(state.dayKey != dayKey || !state.claimed, "already claimed");
        state.dayKey = dayKey;
        state.createCoupons = params.dailyCreateCouponCount;
        state.proposalCoupons = params.dailyProposalCouponCount;
        state.voteCoupons = params.dailyVoteCouponCount;
        state.claimed = true;
        emit DailyCouponsClaimed(msg.sender, dayKey, state.createCoupons, state.proposalCoupons, state.voteCoupons);
    }

    function createRound(
        bytes32 groupKey,
        bytes32 titleHash,
        bytes32[] calldata initialMerchantKeys,
        bool useCreateCoupon,
        bool[] calldata useProposalCoupons
    ) external payable returns (uint256 roundId) {
        require(initialMerchantKeys.length >= 1 && initialMerchantKeys.length <= 2, "invalid initial merchants");
        require(useProposalCoupons.length == initialMerchantKeys.length, "coupon length mismatch");

        uint256 requiredValue = useCreateCoupon ? 0 : params.createFeeWei;
        for (uint256 i = 0; i < initialMerchantKeys.length; i++) {
            if (!useProposalCoupons[i]) {
                requiredValue += params.proposalFeeWei;
            }
        }
        require(msg.value == requiredValue, "invalid create fee");

        roundId = ++roundCount;
        Round storage round = rounds[roundId];
        round.groupKey = groupKey;
        round.titleHash = titleHash;
        round.creator = msg.sender;
        round.status = RoundStatus.ProposalOpen;
        round.createdAt = block.timestamp;
        round.proposalDeadline = block.timestamp + (params.proposalDurationMinutes * 1 minutes);
        round.voteDeadline = round.proposalDeadline + (params.voteDurationMinutes * 1 minutes);
        round.orderingDeadline = round.voteDeadline + (params.orderingDurationMinutes * 1 minutes);
        round.createFeeSnapshot = params.createFeeWei;
        round.proposalFeeSnapshot = params.proposalFeeWei;
        round.voteFeeSnapshot = params.voteFeeWei;

        if (useCreateCoupon) {
            _consumeCoupon(msg.sender, 0);
        }
        for (uint256 i = 0; i < initialMerchantKeys.length; i++) {
            _propose(roundId, initialMerchantKeys[i], msg.sender, useProposalCoupons[i], false);
        }

        emit RoundCreated(roundId, msg.sender, groupKey, round.proposalDeadline, round.voteDeadline, round.orderingDeadline);
    }

    function proposeMerchant(uint256 roundId, bytes32 merchantKey, bool useCoupon) external payable {
        _propose(roundId, merchantKey, msg.sender, useCoupon, true);
    }

    function castVote(uint256 roundId, uint256 candidateId, uint256 voteCount, bool useCoupon) external payable {
        require(voteCount > 0, "vote count");
        Round storage round = rounds[roundId];
        require(round.status == RoundStatus.ProposalOpen || round.status == RoundStatus.VotingOpen, "round closed");
        require(block.timestamp > round.proposalDeadline, "proposal active");
        require(block.timestamp <= round.voteDeadline, "vote closed");
        require(!votes[roundId][msg.sender].exists, "vote locked");
        require(candidateId > 0 && candidateId <= candidateCountByRound[roundId], "candidate missing");

        if (round.status != RoundStatus.VotingOpen) {
            round.status = RoundStatus.VotingOpen;
        }

        uint256 requiredValue = params.voteFeeWei * voteCount;
        if (useCoupon) {
            _consumeCoupon(msg.sender, 2);
            requiredValue -= params.voteFeeWei;
        }
        require(msg.value == requiredValue, "invalid vote fee");

        votes[roundId][msg.sender] = VoteRecord({
            candidateId: candidateId,
            voteCount: voteCount,
            feeAmountWei: requiredValue,
            refundWei: 0,
            usedVoteCoupon: useCoupon,
            exists: true
        });

        Candidate storage candidate = candidates[roundId][candidateId];
        candidate.voteFeeCollectedWei += requiredValue;
        candidate.voteCount += voteCount;
        rounds[roundId].totalVotes += voteCount;

        emit VoteCast(roundId, candidateId, msg.sender, voteCount, requiredValue, useCoupon);
    }

    function cancelRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(round.creator == msg.sender, "not creator");
        require(block.timestamp <= round.proposalDeadline, "proposal closed");
        require(round.status == RoundStatus.ProposalOpen, "round not cancellable");
        require(_hasOnlyCreatorProposals(roundId, msg.sender), "external proposals exist");

        uint256 refundWei = (round.createFeeSnapshot * 5000) / 10000;
        round.createFeeRefundableWei = refundWei;
        round.createFeePlatformWei = round.createFeeSnapshot - refundWei;
        round.status = RoundStatus.Cancelled;

        claimableGovernanceRefundWei[msg.sender] += refundWei;
        claimablePlatformShareWei[platformWallet] += round.createFeePlatformWei;
        emit RoundCancelled(roundId, msg.sender, refundWei, round.createFeePlatformWei);
    }

    function settleRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(block.timestamp > round.voteDeadline, "vote still active");
        require(!round.settled, "already settled");

        round.settled = true;
        if (round.totalVotes == 0) {
            round.status = RoundStatus.VotingClosedFailed;
            round.createFeePlatformWei = round.createFeeSnapshot;
            claimablePlatformShareWei[platformWallet] += round.createFeeSnapshot;
            emit RoundSettled(roundId, 0, 0, true);
            return;
        }

        uint256 winnerCandidateId = _findWinner(roundId);
        round.winnerCandidateId = winnerCandidateId;
        round.status = RoundStatus.VotingClosedSuccess;
        round.createFeeRefundableWei = round.createFeeSnapshot;
        claimableGovernanceRefundWei[round.creator] += round.createFeeSnapshot;

        for (uint256 candidateId = 1; candidateId <= candidateCountByRound[roundId]; candidateId++) {
            Candidate storage candidate = candidates[roundId][candidateId];
            uint256 voteRefundWei = (candidate.voteFeeCollectedWei * params.voteRefundBps) / 10000;
            uint256 proposerRefundWei = candidateId == winnerCandidateId
                ? (candidate.proposalFeePaidWei * params.winnerProposalRefundBps) / 10000
                : (candidate.proposalFeePaidWei * params.loserProposalRefundBps) / 10000;
            uint256 postVoteRefundRemainder = candidate.voteFeeCollectedWei - voteRefundWei;
            uint256 proposerRewardWei = candidateId == winnerCandidateId
                ? (postVoteRefundRemainder * params.winnerBonusBps) / 10000
                : (postVoteRefundRemainder * params.loserBonusBps) / 10000;

            candidate.voteRefundWei = voteRefundWei;
            candidate.proposerRefundWei = proposerRefundWei;
            candidate.proposerRewardWei = proposerRewardWei;
            candidate.isWinner = candidateId == winnerCandidateId;

            if (!candidate.usedProposalCoupon && proposerRefundWei > 0) {
                claimableGovernanceRefundWei[candidate.proposer] += proposerRefundWei;
            }
            if (proposerRewardWei > 0) {
                claimableGovernanceRewardWei[candidate.proposer] += proposerRewardWei;
            }

            uint256 platformShare = candidate.proposalFeePaidWei - proposerRefundWei + postVoteRefundRemainder - proposerRewardWei;
            claimablePlatformShareWei[platformWallet] += platformShare;

            if (candidateId == winnerCandidateId) {
                pointsBalance[candidate.proposer] += params.winnerProposalPoints;
                emit PointsGranted(candidate.proposer, roundId, params.winnerProposalPoints, keccak256("winner_proposal"));
            }
        }

        emit RoundSettled(roundId, winnerCandidateId, round.totalVotes, false);
    }

    function claimGovernanceRefund() external {
        uint256 amount = claimableGovernanceRefundWei[msg.sender];
        require(amount > 0, "no refund");
        claimableGovernanceRefundWei[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit GovernanceRefundClaimed(msg.sender, amount);
    }

    function claimGovernanceReward() external {
        uint256 amount = claimableGovernanceRewardWei[msg.sender];
        require(amount > 0, "no reward");
        claimableGovernanceRewardWei[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit GovernanceRewardClaimed(msg.sender, amount);
    }

    function claimPlatformShare() external onlyOwner {
        uint256 amount = claimablePlatformShareWei[platformWallet];
        require(amount > 0, "no platform share");
        claimablePlatformShareWei[platformWallet] = 0;
        payable(platformWallet).transfer(amount);
        emit PlatformShareClaimed(platformWallet, amount);
    }

    function pauseRound(uint256 roundId) external onlyOwner {
        rounds[roundId].paused = true;
        emit ContractPaused(msg.sender, roundId);
    }

    function unpauseRound(uint256 roundId) external onlyOwner {
        rounds[roundId].paused = false;
        emit ContractUnpaused(msg.sender, roundId);
    }

    function emergencyRescue(uint256 roundId, address payable recipient, uint256 amountWei, bytes32 reason) external onlyOwner {
        require(recipient != address(0), "zero recipient");
        recipient.transfer(amountWei);
        emit EmergencyRescue(msg.sender, roundId, recipient, amountWei, reason);
    }

    function timeoutRecovery(uint256 roundId, address payable recipient, uint256 amountWei, bytes32 reason) external onlyOwner {
        require(recipient != address(0), "zero recipient");
        recipient.transfer(amountWei);
        emit TimeoutRecovery(msg.sender, roundId, recipient, amountWei, reason);
    }

    function _propose(uint256 roundId, bytes32 merchantKey, address proposer, bool useCoupon, bool expectPayment) internal {
        Round storage round = rounds[roundId];
        require(round.creator != address(0), "round missing");
        require(block.timestamp <= round.proposalDeadline, "proposal closed");
        require(!merchantAlreadyProposed[roundId][merchantKey], "merchant already proposed");
        require(memberProposalCount[roundId][proposer] < 2, "proposal limit");

        uint256 requiredValue = useCoupon ? 0 : params.proposalFeeWei;
        if (expectPayment) {
            require(msg.value == requiredValue, "invalid proposal fee");
        }
        if (useCoupon) {
            _consumeCoupon(proposer, 1);
        }

        uint256 nextCandidateId = ++candidateCountByRound[roundId];
        candidates[roundId][nextCandidateId] = Candidate({
            merchantKey: merchantKey,
            proposer: proposer,
            firstProposedAt: block.timestamp,
            proposalFeePaidWei: requiredValue,
            voteFeeCollectedWei: 0,
            voteRefundWei: 0,
            proposerRefundWei: 0,
            proposerRewardWei: 0,
            voteCount: 0,
            isWinner: false,
            usedProposalCoupon: useCoupon
        });
        merchantAlreadyProposed[roundId][merchantKey] = true;
        memberProposalCount[roundId][proposer] += 1;

        emit MerchantProposed(roundId, nextCandidateId, merchantKey, proposer, useCoupon);
    }

    function _findWinner(uint256 roundId) internal view returns (uint256 winnerCandidateId) {
        uint256 winnerVotes = 0;
        uint256 earliestProposalTime = type(uint256).max;
        for (uint256 candidateId = 1; candidateId <= candidateCountByRound[roundId]; candidateId++) {
            Candidate storage candidate = candidates[roundId][candidateId];
            if (
                candidate.voteCount > winnerVotes ||
                (candidate.voteCount == winnerVotes && candidate.firstProposedAt < earliestProposalTime)
            ) {
                winnerVotes = candidate.voteCount;
                earliestProposalTime = candidate.firstProposedAt;
                winnerCandidateId = candidateId;
            }
        }
    }

    function _hasOnlyCreatorProposals(uint256 roundId, address creator) internal view returns (bool) {
        for (uint256 candidateId = 1; candidateId <= candidateCountByRound[roundId]; candidateId++) {
            if (candidates[roundId][candidateId].proposer != creator) {
                return false;
            }
        }
        return true;
    }

    function _consumeCoupon(address member, uint8 couponType) internal {
        CouponState storage state = coupons[member];
        if (couponType == 0) {
            require(state.createCoupons > 0, "no create coupon");
            state.createCoupons -= 1;
        } else if (couponType == 1) {
            require(state.proposalCoupons > 0, "no proposal coupon");
            state.proposalCoupons -= 1;
        } else {
            require(state.voteCoupons > 0, "no vote coupon");
            state.voteCoupons -= 1;
        }
    }

    function _setGovernanceParams(GovernanceParams memory nextParams) internal {
        require(nextParams.winnerProposalRefundBps <= 10000, "winner refund bps");
        require(nextParams.loserProposalRefundBps <= 10000, "loser refund bps");
        require(nextParams.voteRefundBps <= 10000, "vote refund bps");
        require(nextParams.winnerBonusBps <= 10000, "winner bonus bps");
        require(nextParams.loserBonusBps <= 10000, "loser bonus bps");
        params = nextParams;
        emit GovernanceParamsUpdated(msg.sender);
    }
}
