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
        address creator;
        RoundStatus status;
        uint40 proposalDeadline;
        uint40 voteDeadline;
        uint40 orderingDeadline;
        uint32 winnerCandidateId;
        bool settled;
    }

    struct Candidate {
        bytes32 merchantKey;
        uint40 firstProposedAt;
        uint24 voteCount;
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
    mapping(uint256 => uint16) public externalProposalCountByRound;
    mapping(uint256 => mapping(bytes32 => bool)) public merchantAlreadyProposed;
    mapping(uint256 => mapping(address => uint256)) public votes;
    mapping(address => CouponState) public coupons;
    mapping(address => uint40) public subscriptionExpiresAt;

    event GovernanceParamsUpdated(address indexed updatedBy);
    event DailyCouponsClaimed(address indexed member, uint256 indexed dayKey, uint256 createCoupons, uint256 proposalCoupons, uint256 voteCoupons);
    event RoundCreated(uint256 indexed roundId, uint256 proposalDeadline, uint256 voteDeadline, uint256 orderingDeadline);
    event MerchantProposed(uint256 indexed roundId, uint256 indexed candidateId, bytes32 indexed merchantKey);
    event VoteCast(uint256 indexed roundId, uint256 indexed candidateId, address indexed voter, uint256 voteCount, bool usedCoupon);
    event RoundCancelled(uint256 indexed roundId);
    event RoundSettled(uint256 indexed roundId, uint256 indexed winnerCandidateId, uint256 totalVotes, bool failed);
    event SubscriptionPaid(address indexed member, uint256 expiresAt);
    event SubscriptionCancelled(address indexed member);

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
        emit SubscriptionPaid(msg.sender, nextExpiry);
        return nextExpiry;
    }

    function cancelSubscription() external {
        subscriptionExpiresAt[msg.sender] = 0;
        emit SubscriptionCancelled(msg.sender);
    }

    function createRound(
        bytes32 /* groupKey */,
        bytes32 /* titleHash */,
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
        round.creator = msg.sender;
        round.status = RoundStatus.ProposalOpen;
        round.proposalDeadline = uint40(block.timestamp + (params.proposalDurationMinutes * 1 minutes));
        round.voteDeadline = uint40(uint256(round.proposalDeadline) + (params.voteDurationMinutes * 1 minutes));
        round.orderingDeadline = uint40(uint256(round.voteDeadline) + (params.orderingDurationMinutes * 1 minutes));

        if (useCreateCoupon) {
            _consumeCoupon(msg.sender, 0);
        }
        for (uint256 i = 0; i < initialMerchantKeys.length; i++) {
            _propose(roundId, initialMerchantKeys[i], msg.sender, useProposalCoupons[i], false);
        }

        emit RoundCreated(roundId, round.proposalDeadline, round.voteDeadline, round.orderingDeadline);
    }

    function proposeMerchant(uint256 roundId, bytes32 merchantKey, bool useCoupon) external payable {
        _propose(roundId, merchantKey, msg.sender, useCoupon, true);
    }

    function castVote(uint256 roundId, uint256 candidateId, uint256 voteCount, bool useCoupon) external payable {
        require(voteCount > 0, "vote count");
        Round storage round = rounds[roundId];
        require(round.creator != address(0), "round missing");
        require(round.status == RoundStatus.ProposalOpen || round.status == RoundStatus.VotingOpen, "round closed");
        require(block.timestamp > round.proposalDeadline, "proposal active");
        require(block.timestamp <= round.voteDeadline, "vote closed");
        require(votes[roundId][msg.sender] == 0, "vote locked");
        require(candidateId > 0 && candidateId <= candidateCountByRound[roundId], "candidate missing");

        uint256 requiredValue = params.voteFeeWei * voteCount;
        if (useCoupon) {
            _consumeCoupon(msg.sender, 2);
            requiredValue -= params.voteFeeWei;
        }
        require(msg.value == requiredValue, "invalid vote fee");

        votes[roundId][msg.sender] = _encodeVoteRecord(candidateId, voteCount, useCoupon);

        Candidate storage candidate = candidates[roundId][candidateId];
        require(voteCount <= type(uint24).max, "vote overflow");
        require(uint256(candidate.voteCount) + voteCount <= type(uint24).max, "candidate vote overflow");
        candidate.voteCount += uint24(voteCount);

        emit VoteCast(roundId, candidateId, msg.sender, voteCount, useCoupon);
    }

    function cancelRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(round.creator == msg.sender, "not creator");
        require(block.timestamp <= round.proposalDeadline, "proposal closed");
        require(round.status == RoundStatus.ProposalOpen, "round not cancellable");
        require(externalProposalCountByRound[roundId] == 0, "external proposals exist");

        round.status = RoundStatus.Cancelled;
        emit RoundCancelled(roundId);
    }

    function settleRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(round.creator != address(0), "round missing");
        require(block.timestamp > round.voteDeadline, "vote still active");
        require(!round.settled, "already settled");

        round.settled = true;
        uint256 totalVotes = _countTotalVotes(roundId);
        if (totalVotes == 0) {
            round.status = RoundStatus.VotingClosedFailed;
            emit RoundSettled(roundId, 0, 0, true);
            return;
        }

        uint256 winnerCandidateId = _findWinner(roundId);
        round.winnerCandidateId = uint32(winnerCandidateId);
        round.status = RoundStatus.VotingClosedSuccess;
        emit RoundSettled(roundId, winnerCandidateId, totalVotes, false);
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

        uint32 nextCandidateId = candidateCountByRound[roundId] + 1;
        candidateCountByRound[roundId] = nextCandidateId;
        candidates[roundId][nextCandidateId] = Candidate({
            merchantKey: merchantKey,
            firstProposedAt: uint40(block.timestamp),
            voteCount: 0
        });
        merchantAlreadyProposed[roundId][merchantKey] = true;
        memberProposalCount[roundId][proposer] += 1;
        if (proposer != round.creator) {
            externalProposalCountByRound[roundId] += 1;
        }

        emit MerchantProposed(roundId, nextCandidateId, merchantKey);
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

    function _countTotalVotes(uint256 roundId) internal view returns (uint256 totalVotes) {
        uint32 candidateCount = candidateCountByRound[roundId];
        for (uint32 candidateId = 1; candidateId <= candidateCount; candidateId++) {
            totalVotes += candidates[roundId][candidateId].voteCount;
        }
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

    function _encodeVoteRecord(uint256 candidateId, uint256 voteCount, bool usedCoupon) internal pure returns (uint256) {
        uint256 encoded = candidateId;
        encoded |= voteCount << 24;
        if (usedCoupon) {
            encoded |= uint256(1) << 48;
        }
        return encoded;
    }

    function _decodeVoteRecord(uint256 encoded) internal pure returns (uint256 candidateId, uint256 voteCount, bool usedCoupon) {
        candidateId = encoded & ((uint256(1) << 24) - 1);
        voteCount = (encoded >> 24) & ((uint256(1) << 24) - 1);
        usedCoupon = ((encoded >> 48) & 1) == 1;
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
