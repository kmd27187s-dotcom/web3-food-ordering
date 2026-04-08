// backend/repository/repository.go
package repository

import (
	"context"
	"errors"
	"time"

	"mealvoting/backend/internal/models"
)

// ErrAlreadyClaimed is returned by ClaimFaucet when the member has already claimed tokens.
var ErrAlreadyClaimed = errors.New("already claimed")

// ErrDuplicateVote is returned when a member tries to vote twice on the same proposal.
var ErrDuplicateVote = errors.New("you already voted on this proposal")

// ErrDuplicateOption is returned when a member tries to propose a second option on the same proposal.
var ErrDuplicateOption = errors.New("you already proposed an option for this proposal")

// ErrDuplicateProposalRound is returned when a group already has a proposal for the same meal period and date.
var ErrDuplicateProposalRound = errors.New("this group already has a proposal for this round")

// MemberReward carries points and token deltas to apply atomically in settlement.
type MemberReward struct {
	MemberID int64
	Points   int64
	Tokens   int64
}

// OptionRefund carries per-option refund values to store in settlement.
type OptionRefund struct {
	OptionID        int64
	PartialRefund   int64
	WinnerTokenBack int64
}

// MemberRepo handles member persistence with no business logic.
type MemberRepo interface {
	CreateMember(email, passwordHash, displayName string, isAdmin bool, tokenBalance int64, avatarURL string) (int64, error)
	MemberCount() (int64, error)
	MemberByEmail(email string) (*models.Member, error)
	MemberByWallet(wallet string) (*models.Member, error)
	MemberByRegistrationInviteCode(code string) (*models.Member, error)
	ListRegistrationInviteUsages(memberID int64) ([]*models.RegistrationInviteUsage, error)
	RecordRegistrationInviteUsage(inviteCode string, inviterMemberID, usedByMemberID int64) error
	MemberBySession(token string) (*models.Member, error)
	MemberByID(id int64) (*models.Member, error)
	ListMemberOrders(memberID int64) ([]*models.Order, error)
	MemberReviewCount(memberID int64) (int64, error)
	UpgradePasswordHash(memberID int64, hash string) error
	CreateSession(memberID int64, token string) error
	UpdateMemberWallet(memberID int64, wallet string) error
	SetSubscriptionExpiry(memberID int64, expiresAt time.Time) error
	AddClaimableTickets(memberID, proposalTickets int64) error
	AddTickets(memberID, ticketCount int64) error
	ClaimTickets(memberID int64) (proposalTickets int64, voteTickets int64, createOrderTickets int64, err error)
	GrantDailyLoginProposalTicket(memberID int64, now time.Time) (granted bool, err error)
	SaveWalletAuthChallenge(walletAddress, nonce, message string, expiresAt time.Time) error
	WalletAuthChallengeByWallet(walletAddress string) (*models.WalletAuthChallenge, error)
	DeleteWalletAuthChallenge(walletAddress string) error
	// RawLeaderboard returns all members for ranking without computing rank or building names.
	RawLeaderboard() ([]*models.LeaderboardEntry, error)
	// MemberStats returns activity counts for profile display.
	MemberStats(memberID int64) (proposalsCreated, ordersSubmitted, votesCast int64, err error)
}

// ProposalRepo handles proposal, option, and vote persistence.
type ProposalRepo interface {
	CreateProposal(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time, params *models.GovernanceParams) (*models.Proposal, error)
	CreateProposalWithCredit(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time, params *models.GovernanceParams, useTicket bool) (*models.Proposal, error)
	ListProposals() []*models.Proposal
	GetProposal(id int64) (*models.Proposal, error)
	DeleteProposalByCreator(proposalID, memberID int64) error
	// InsertProposalOption atomically deducts tokenCost from member and inserts the option row.
	InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, feeWei int64, useTicket bool) (*models.ProposalOption, error)
	// RecordVote atomically deducts tokenAmount from member, increments weighted_votes, and inserts a vote row.
	RecordVote(proposalID, memberID, optionID int64, voteCount, feeAmountWei int64, memberDisplayName string, useTicket bool) error
	// ApplySettlementRewards atomically applies member rewards, option refund values, and marks rewards_applied.
	ApplySettlementRewards(proposalID int64, rewards []MemberReward, optionRefunds []OptionRefund) error
}

// OrderRepo handles order persistence.
type OrderRepo interface {
	SaveOrder(proposalID, memberID int64, quote *models.OrderQuote, sig *models.OrderSignature, memberDisplayName string, escrowOrderID *int64) (*models.Order, error)
	UpdateOrderStatus(orderID int64, merchantID, status string) (*models.Order, error)
	UpdateMemberOrderStatus(orderID, memberID int64, status string) (*models.Order, error)
	UpdateAdminOrderStatus(orderID int64, status string) (*models.Order, error)
	UpdateAdminOrderStatuses(orderIDs []int64, status string) ([]*models.Order, error)
}

// MerchantRepo handles merchant lookup.
type MerchantRepo interface {
	GetMerchant(id string) (*models.Merchant, error)
	GetMerchantDetail(id string) (*models.MerchantDetail, error)
	GetMerchantByOwner(memberID int64, wallet string) (*models.Merchant, error)
	ListMerchants() ([]*models.Merchant, error)
	ListMerchantReviews(merchantID string) ([]*models.MerchantReview, error)
	CreateMerchantReview(review *models.MerchantReview) (*models.MerchantReview, error)
	ClaimMerchant(merchantID string, memberID int64, displayName, wallet string) (*models.Merchant, error)
	UpsertOwnedMerchantProfile(memberID int64, displayName, wallet string, merchant *models.Merchant) (*models.Merchant, error)
	UpdateOwnedMerchantWallet(memberID int64, wallet string) (*models.Merchant, error)
	UnlinkOwnedMerchant(memberID int64) error
	RequestMerchantDelist(memberID int64) (*models.Merchant, error)
	ListMerchantDelistRequests(pendingOnly bool) ([]*models.MerchantDelistRequest, error)
	ReviewMerchantDelist(merchantID string, approve bool) (*models.Merchant, error)
	UpsertMerchant(merchant *models.Merchant) (*models.Merchant, error)
	UpsertMenuItem(merchantID string, item *models.MenuItem) error
	ListMerchantOrders(merchantID string) ([]*models.Order, error)
	CreateMenuChangeRequest(req *models.MenuChangeRequest) (*models.MenuChangeRequest, error)
	ListMenuChangeRequests(merchantID string, status string) ([]*models.MenuChangeRequest, error)
	WithdrawMenuChangeRequest(requestID, requesterMemberID int64) (*models.MenuChangeRequest, error)
	ReviewMenuChangeRequest(requestID, reviewerMemberID int64, reviewerName string, approved bool, reviewNote string, effectiveAt time.Time) (*models.MenuChangeRequest, error)
	ApplyScheduledMenuChangeRequests(now time.Time) error
	CancelMerchantDelist(memberID int64) (*models.Merchant, error)
}

// ChainRepo handles blockchain event projection state.
type ChainRepo interface {
	ContractInfo() models.ContractInfo
	SetPlatformTreasury(address string) (models.ContractInfo, error)
	GovernanceParams() (*models.GovernanceParams, error)
	SetGovernanceParams(params *models.GovernanceParams) (*models.GovernanceParams, error)
	LinkProposalChain(localProposalID, chainProposalID int64) error
	LinkProposalOptionChain(localProposalID, localOptionID, chainOptionIndex int64) error
	StoreChainEvents(events []*models.ChainEvent, lastSeenBlock uint64, syncErr string) error
	ChainSyncStatus() (*models.ChainSyncStatus, error)
	ListChainEvents(limit int) ([]*models.ChainEvent, error)
}

// TransactionRepo tracks pending on-chain transactions.
type TransactionRepo interface {
	RegisterPendingTransaction(memberID, proposalID int64, action, txHash, walletAddress, relatedOrder string) (*models.PendingTransaction, error)
	GetPendingTransaction(memberID int64, txHash string) (*models.PendingTransaction, error)
	ListPendingTransactions(memberID int64, limit int) ([]*models.PendingTransaction, error)
	UpdatePendingTransaction(memberID int64, txHash, status string, proposalID int64, relatedEvent, relatedOrder, errorMessage string) (*models.PendingTransaction, error)
}

// UsageRepo tracks member token/native usage records.
type UsageRepo interface {
	LogUsage(memberID, proposalID int64, action, assetType, direction, amount, note, reference string) error
	ListUsage(memberID int64, limit int) ([]*models.UsageRecord, error)
}

// GroupRepo handles group CRUD and membership.
type GroupRepo interface {
	CreateGroup(ownerMemberID int64, name, description string) (*models.Group, error)
	GetGroup(id int64) (*models.Group, error)
	GetGroupByOwnerAndName(ownerMemberID int64, name string) (*models.Group, error)
	CreateInvite(groupID, createdBy int64, inviteCode string) (*models.GroupInvite, error)
	GetInviteByCode(code string) (*models.GroupInvite, error)
	ListGroupInviteUsages(groupID int64) ([]*models.GroupInviteUsage, error)
	AddMember(groupID, memberID int64) error
	AddMemberByInvite(groupID, memberID int64, inviteCode string) error
	RemoveMember(groupID, memberID int64) error
	UpdateGroup(groupID, ownerMemberID int64, name, description string) (*models.Group, error)
	RemoveGroupMember(groupID, ownerMemberID, targetMemberID int64) error
	DeleteGroup(groupID int64) error
	PruneInactiveGroups(ctx context.Context) error
	IsMember(groupID, memberID int64) (bool, error)
	ListMemberGroups(memberID int64) ([]*models.Group, error)
	GetGroupDetail(groupID, viewerMemberID int64) (*models.GroupDetail, error)
}

// FaucetRepo handles one-time token faucet claims.
type FaucetRepo interface {
	HasClaimed(memberID int64) (bool, error)
	RecordClaim(memberID int64, walletAddress string) error
	// ClaimFaucet atomically checks, inserts a claim, adds 100 tokens, and returns the new balance.
	ClaimFaucet(memberID int64, walletAddress string) (newBalance int64, err error)
	// DeductTokens atomically deducts tokens from member. Returns error if insufficient balance or member not found.
	DeductTokens(memberID int64, amount int64) error
	// DeductTokensAndSubscribe atomically deducts tokens and sets subscription expiry in a single transaction.
	DeductTokensAndSubscribe(memberID int64, amount int64, expiresAt time.Time) error
}

// AdminRepo handles admin/demo-only operations.
type AdminRepo interface {
	AdvanceProposalStage(proposalID int64, stage string) error
	// GetProposalIDByGroupAndTitle returns the proposal ID if a proposal with the given title exists in the group.
	// Returns sql.ErrNoRows if not found.
	GetProposalIDByGroupAndTitle(groupID int64, title string) (int64, error)
	// SetProposalGroupID links a proposal to a group after creation.
	SetProposalGroupID(proposalID, groupID int64) error
	PruneProposalRounds(groupID, keepProposalID int64) error
	AdminDashboard() (*models.AdminDashboard, error)
	AdminInsights() (*models.AdminInsights, error)
	AdminGroupDetail(groupID int64) (*models.GroupDetail, error)
}

// Store aggregates all repo interfaces — implemented by PostgresStore.
type Store interface {
	MemberRepo
	ProposalRepo
	OrderRepo
	MerchantRepo
	ChainRepo
	TransactionRepo
	UsageRepo
	GroupRepo
	FaucetRepo
	AdminRepo
}
