package repository

const chainCursorKey = "voting_system_logs"

const (
	defaultCreateFeeWei                = int64(1000000000000000) // 0.001 ETH
	defaultProposalFeeWei              = int64(500000000000000)  // 0.0005 ETH
	defaultVoteFeeWei                  = int64(300000000000000)  // 0.0003 ETH
	defaultSubscriptionFeeWei          = int64(990000000000000)  // 0.00099 ETH
	defaultSubscriptionDurationDays    = int64(30)
	defaultWinnerProposalRefundBps     = int64(9000)
	defaultLoserProposalRefundBps      = int64(8000)
	defaultVoteRefundBps               = int64(5000)
	defaultWinnerBonusBps              = int64(1000)
	defaultLoserBonusBps               = int64(500)
	defaultWinnerProposalPoints        = int64(5)
	defaultWinnerVotePointsPerVote     = int64(2)
	defaultProposalDurationMinutes     = int64(10)
	defaultVoteDurationMinutes         = int64(10)
	defaultOrderingDurationMinutes     = int64(10)
	defaultDailyCreateCouponCount      = int64(1)
	defaultDailyProposalCouponCount    = int64(1)
	defaultDailyVoteCouponCount        = int64(1)
	defaultAutoPayoutEnabled           = false
	defaultAutoPayoutDelayDays         = int64(2)
	defaultPlatformEscrowFeeBps        = int64(0)
	defaultMerchantAcceptTimeoutMins   = int64(24 * 60)
	defaultMerchantCompleteTimeoutMins = int64(7 * 24 * 60)
	defaultMemberConfirmTimeoutMins    = int64(7 * 24 * 60)
	defaultGovernanceClaimTimeoutMins  = int64(30 * 24 * 60)
	defaultEscrowClaimTimeoutMins      = int64(30 * 24 * 60)
)

const defaultInactiveGroupThresholdDays = 90
