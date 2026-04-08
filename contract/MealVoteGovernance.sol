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
        uint256 subscriptionFeeWei;
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
        uint16 subscriptionDurationDays;
    }

    struct Round {
        bytes32 groupKey;
        bytes32 titleHash;
        address creator;
        RoundStatus status;
        uint40 createdAt;
        uint40 proposalDeadline;
        uint40 voteDeadline;
        uint40 orderingDeadline;
        uint128 createFeeSnapshot;
        uint128 proposalFeeSnapshot;
        uint128 voteFeeSnapshot;
        uint32 totalVotes;
        uint32 winnerCandidateId;
        bool settled;
    }

    struct Candidate {
        bytes32 merchantKey;
        address proposer;
        uint40 firstProposedAt;
        uint128 proposalFeePaidWei;
        uint128 voteFeeCollectedWei;
        uint32 voteCount;
    }

    struct VoteRecord {
        uint32 candidateId;
        uint32 voteCount;
        uint128 feeAmountWei;
        bool exists;
    }

    struct CouponState {
        uint32 dayKey;
        uint16 createCoupons;
        uint16 proposalCoupons;
        uint16 voteCoupons;
        bool claimed;
    }

    address public owner;
    address public platformWallet;
    GovernanceParams public params;
    uint256 public roundCount;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => uint32) public candidateCountByRound;
    mapping(uint256 => mapping(address => uint8)) public memberProposalCount;
    mapping(uint256 => mapping(bytes32 => bool)) public merchantAlreadyProposed;
    mapping(uint256 => mapping(address => VoteRecord)) public votes;
    mapping(address => CouponState) public coupons;
    mapping(address => uint256) public pointsBalance;
    mapping(address => uint40) public subscriptionExpiresAt;
    mapping(uint256 => mapping(address => bool)) public roundClaimed;
    mapping(uint256 => bool) public platformRoundClaimed;
    mapping(uint256 => bool) public pausedRounds;

    event GovernanceParamsUpdated(address indexed updatedBy);
    event DailyCouponsClaimed(address indexed member, uint256 indexed dayKey, uint256 createCoupons, uint256 proposalCoupons, uint256 voteCoupons);
    event RoundCreated(uint256 indexed roundId, address indexed creator, bytes32 indexed groupKey, uint256 proposalDeadline, uint256 voteDeadline, uint256 orderingDeadline);
    event MerchantProposed(uint256 indexed roundId, uint256 indexed candidateId, bytes32 indexed merchantKey, address proposer, bool usedCoupon);
    event VoteCast(uint256 indexed roundId, uint256 indexed candidateId, address indexed voter, uint256 voteCount, uint256 feeAmountWei, bool usedCoupon);
    event RoundCancelled(uint256 indexed roundId, address indexed creator, uint256 refundWei, uint256 platformWei);
    event RoundSettled(uint256 indexed roundId, uint256 indexed winnerCandidateId, uint256 totalVotes, bool failed);
    event RoundClaimed(uint256 indexed roundId, address indexed claimant, uint256 amountWei);
    event PlatformShareClaimed(address indexed platformWallet, uint256 indexed roundId, uint256 amountWei);
    event PointsGranted(address indexed member, uint256 indexed roundId, uint256 amount, bytes32 reason);
    event SubscriptionPaid(address indexed member, uint256 amountWei, uint256 expiresAt);
    event SubscriptionCancelled(address indexed member, uint256 cancelledAt);
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
        state.dayKey = uint32(dayKey);
        state.createCoupons = params.dailyCreateCouponCount;
        state.proposalCoupons = params.dailyProposalCouponCount;
        state.voteCoupons = params.dailyVoteCouponCount;
        state.claimed = true;
        emit DailyCouponsClaimed(msg.sender, dayKey, state.createCoupons, state.proposalCoupons, state.voteCoupons);
    }

    function subscribeMonthly() external payable returns (uint256 expiresAt) {
        require(msg.value == params.subscriptionFeeWei, "invalid subscription fee");
        uint40 currentExpiry = subscriptionExpiresAt[msg.sender];
        uint40 base = currentExpiry > block.timestamp ? currentExpiry : uint40(block.timestamp);
        uint40 nextExpiry = base + uint40(params.subscriptionDurationDays * 1 days);
        subscriptionExpiresAt[msg.sender] = nextExpiry;
        emit SubscriptionPaid(msg.sender, msg.value, nextExpiry);
        return nextExpiry;
    }

    function cancelSubscription() external {
        subscriptionExpiresAt[msg.sender] = uint40(block.timestamp);
        emit SubscriptionCancelled(msg.sender, block.timestamp);
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
        round.createdAt = uint40(block.timestamp);
        round.proposalDeadline = uint40(block.timestamp + (params.proposalDurationMinutes * 1 minutes));
        round.voteDeadline = uint40(uint256(round.proposalDeadline) + (params.voteDurationMinutes * 1 minutes));
        round.orderingDeadline = uint40(uint256(round.voteDeadline) + (params.orderingDurationMinutes * 1 minutes));
        round.createFeeSnapshot = uint128(params.createFeeWei);
        round.proposalFeeSnapshot = uint128(params.proposalFeeWei);
        round.voteFeeSnapshot = uint128(params.voteFeeWei);

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
        require(round.creator != address(0), "round missing");
        require(!pausedRounds[roundId], "round paused");
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
            candidateId: uint32(candidateId),
            voteCount: uint32(voteCount),
            feeAmountWei: uint128(requiredValue),
            exists: true
        });

        Candidate storage candidate = candidates[roundId][candidateId];
        candidate.voteFeeCollectedWei += uint128(requiredValue);
        candidate.voteCount += uint32(voteCount);
        round.totalVotes += uint32(voteCount);

        emit VoteCast(roundId, candidateId, msg.sender, voteCount, requiredValue, useCoupon);
    }

    function cancelRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(round.creator == msg.sender, "not creator");
        require(block.timestamp <= round.proposalDeadline, "proposal closed");
        require(round.status == RoundStatus.ProposalOpen, "round not cancellable");
        require(_hasOnlyCreatorProposals(roundId, msg.sender), "external proposals exist");

        round.status = RoundStatus.Cancelled;
        emit RoundCancelled(roundId, msg.sender, _creatorCancelledRefund(round), _platformShareForCancelledRound(roundId, round));
    }

    function settleRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(round.creator != address(0), "round missing");
        require(block.timestamp > round.voteDeadline, "vote still active");
        require(!round.settled, "already settled");

        round.settled = true;
        if (round.totalVotes == 0) {
            round.status = RoundStatus.VotingClosedFailed;
            emit RoundSettled(roundId, 0, 0, true);
            return;
        }

        uint256 winnerCandidateId = _findWinner(roundId);
        round.winnerCandidateId = uint32(winnerCandidateId);
        round.status = RoundStatus.VotingClosedSuccess;
        emit RoundSettled(roundId, winnerCandidateId, round.totalVotes, false);
    }

    function claimRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(_isClaimableStatus(round.status), "round not claimable");
        require(!roundClaimed[roundId][msg.sender], "already claimed");

        uint256 amountWei;
        uint256 totalPointsToGrant;

        if (round.status == RoundStatus.Cancelled) {
            if (msg.sender == round.creator) {
                amountWei += _creatorCancelledRefund(round);
            }
        } else if (round.status == RoundStatus.VotingClosedSuccess) {
            if (msg.sender == round.creator) {
                amountWei += round.createFeeSnapshot;
            }

            VoteRecord memory vote = votes[roundId][msg.sender];
            if (vote.exists) {
                amountWei += _voteRefund(vote);
                if (vote.candidateId == round.winnerCandidateId) {
                    uint256 votePoints = params.winnerVotePointsPerVote * vote.voteCount;
                    totalPointsToGrant += votePoints;
                    emit PointsGranted(msg.sender, roundId, votePoints, keccak256("winner_vote"));
                }
            }

            uint32 claimCandidateCount = candidateCountByRound[roundId];
            for (uint32 candidateId = 1; candidateId <= claimCandidateCount; candidateId++) {
                Candidate memory candidate = candidates[roundId][candidateId];
                if (candidate.proposer != msg.sender) {
                    continue;
                }
                amountWei += _proposalRefund(candidate, candidateId == round.winnerCandidateId);
                amountWei += _proposalReward(candidate, candidateId == round.winnerCandidateId);
                if (candidateId == round.winnerCandidateId) {
                    totalPointsToGrant += params.winnerProposalPoints;
                    emit PointsGranted(msg.sender, roundId, params.winnerProposalPoints, keccak256("winner_proposal"));
                }
            }
        }

        require(amountWei > 0 || totalPointsToGrant > 0, "nothing to claim");
        roundClaimed[roundId][msg.sender] = true;
        if (totalPointsToGrant > 0) {
            pointsBalance[msg.sender] += totalPointsToGrant;
        }
        if (amountWei > 0) {
            payable(msg.sender).transfer(amountWei);
        }
        emit RoundClaimed(roundId, msg.sender, amountWei);
    }

    function claimPlatformShare(uint256 roundId) external onlyOwner {
        Round storage round = rounds[roundId];
        require(_isClaimableStatus(round.status), "round not claimable");
        require(!platformRoundClaimed[roundId], "platform already claimed");

        uint256 amountWei = _platformShareForRound(roundId);
        require(amountWei > 0, "no platform share");
        platformRoundClaimed[roundId] = true;
        payable(platformWallet).transfer(amountWei);
        emit PlatformShareClaimed(platformWallet, roundId, amountWei);
    }

    function pauseRound(uint256 roundId) external onlyOwner {
        pausedRounds[roundId] = true;
        emit ContractPaused(msg.sender, roundId);
    }

    function unpauseRound(uint256 roundId) external onlyOwner {
        pausedRounds[roundId] = false;
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
        require(!pausedRounds[roundId], "round paused");
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

        uint32 nextCandidateId = candidateCountByRound[roundId] + 1;
        candidateCountByRound[roundId] = nextCandidateId;
        candidates[roundId][nextCandidateId] = Candidate({
            merchantKey: merchantKey,
            proposer: proposer,
            firstProposedAt: uint40(block.timestamp),
            proposalFeePaidWei: uint128(requiredValue),
            voteFeeCollectedWei: 0,
            voteCount: 0
        });
        merchantAlreadyProposed[roundId][merchantKey] = true;
        memberProposalCount[roundId][proposer] += 1;

        emit MerchantProposed(roundId, nextCandidateId, merchantKey, proposer, useCoupon);
    }

    function _findWinner(uint256 roundId) internal view returns (uint256 winnerCandidateId) {
        uint256 winnerVotes = 0;
        uint256 earliestProposalTime = type(uint256).max;
        uint32 candidateCount = candidateCountByRound[roundId];
        for (uint32 candidateId = 1; candidateId <= candidateCount; candidateId++) {
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
        uint32 candidateCount = candidateCountByRound[roundId];
        for (uint32 candidateId = 1; candidateId <= candidateCount; candidateId++) {
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

    function _proposalRefund(Candidate memory candidate, bool isWinner) internal view returns (uint256) {
        if (candidate.proposalFeePaidWei == 0) {
            return 0;
        }
        uint256 refundBps = isWinner ? params.winnerProposalRefundBps : params.loserProposalRefundBps;
        return (candidate.proposalFeePaidWei * refundBps) / 10000;
    }

    function _proposalReward(Candidate memory candidate, bool isWinner) internal view returns (uint256) {
        uint256 postVoteRefundRemainder = _postVoteRefundRemainder(candidate.voteFeeCollectedWei);
        uint256 rewardBps = isWinner ? params.winnerBonusBps : params.loserBonusBps;
        return (postVoteRefundRemainder * rewardBps) / 10000;
    }

    function _voteRefund(VoteRecord memory vote) internal view returns (uint256) {
        if (!vote.exists || vote.feeAmountWei == 0) {
            return 0;
        }
        return (uint256(vote.feeAmountWei) * params.voteRefundBps) / 10000;
    }

    function _postVoteRefundRemainder(uint256 voteFeeCollectedWei) internal view returns (uint256) {
        uint256 voteRefundWei = (voteFeeCollectedWei * params.voteRefundBps) / 10000;
        return voteFeeCollectedWei - voteRefundWei;
    }

    function _creatorCancelledRefund(Round storage round) internal view returns (uint256) {
        return (uint256(round.createFeeSnapshot) * 5000) / 10000;
    }

    function _platformShareForRound(uint256 roundId) internal view returns (uint256) {
        Round storage round = rounds[roundId];
        if (round.status == RoundStatus.Cancelled) {
            return _platformShareForCancelledRound(roundId, round);
        }
        if (round.status == RoundStatus.VotingClosedFailed) {
            uint256 amountWei = uint256(round.createFeeSnapshot);
            uint32 failedCandidateCount = candidateCountByRound[roundId];
            for (uint32 candidateId = 1; candidateId <= failedCandidateCount; candidateId++) {
                Candidate storage candidate = candidates[roundId][candidateId];
                amountWei += candidate.proposalFeePaidWei;
                amountWei += candidate.voteFeeCollectedWei;
            }
            return amountWei;
        }
        if (round.status != RoundStatus.VotingClosedSuccess) {
            return 0;
        }

        uint256 amount;
        uint32 candidateCount = candidateCountByRound[roundId];
        for (uint32 candidateId = 1; candidateId <= candidateCount; candidateId++) {
            Candidate storage candidate = candidates[roundId][candidateId];
            uint256 proposalRefundWei = _proposalRefund(candidate, candidateId == round.winnerCandidateId);
            uint256 proposalRewardWei = _proposalReward(candidate, candidateId == round.winnerCandidateId);
            uint256 postVoteRefundRemainder = _postVoteRefundRemainder(candidate.voteFeeCollectedWei);
            amount += candidate.proposalFeePaidWei - proposalRefundWei;
            amount += postVoteRefundRemainder - proposalRewardWei;
        }
        return amount;
    }

    function _platformShareForCancelledRound(uint256 roundId, Round storage round) internal view returns (uint256) {
        uint256 amountWei = uint256(round.createFeeSnapshot) - _creatorCancelledRefund(round);
        uint32 candidateCount = candidateCountByRound[roundId];
        for (uint32 candidateId = 1; candidateId <= candidateCount; candidateId++) {
            amountWei += candidates[roundId][candidateId].proposalFeePaidWei;
        }
        return amountWei;
    }

    function _isClaimableStatus(RoundStatus status) internal pure returns (bool) {
        return status == RoundStatus.Cancelled || status == RoundStatus.VotingClosedSuccess || status == RoundStatus.VotingClosedFailed;
    }

    function _setGovernanceParams(GovernanceParams memory nextParams) internal {
        require(nextParams.subscriptionDurationDays > 0, "subscription days");
        require(nextParams.proposalDurationMinutes > 0, "proposal mins");
        require(nextParams.voteDurationMinutes > 0, "vote mins");
        require(nextParams.orderingDurationMinutes > 0, "ordering mins");
        require(nextParams.winnerProposalRefundBps <= 10000, "winner refund bps");
        require(nextParams.loserProposalRefundBps <= 10000, "loser refund bps");
        require(nextParams.voteRefundBps <= 10000, "vote refund bps");
        require(nextParams.winnerBonusBps <= 10000, "winner bonus bps");
        require(nextParams.loserBonusBps <= 10000, "loser bonus bps");
        params = nextParams;
        emit GovernanceParamsUpdated(msg.sender);
    }
}
