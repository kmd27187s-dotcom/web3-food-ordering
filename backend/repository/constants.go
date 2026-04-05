package repository

const chainCursorKey = "voting_system_logs"

const (
	autoWinnerTokenReward    = int64(6)
	autoLoserPartialRefund   = int64(4)
	autoVoterPoints          = int64(25)
	autoWinnerProposerPoints = int64(120)
	proposalTokenCost        = int64(1)
)

const defaultInactiveGroupThresholdDays = 90
