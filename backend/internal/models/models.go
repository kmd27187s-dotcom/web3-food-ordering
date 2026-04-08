package models

import "time"

type ContractInfo struct {
	ChainID            int64  `json:"chainId"`
	GovernanceContract string `json:"governanceContract"`
	OrderEscrowContract string `json:"orderEscrowContract"`
	OrderContract      string `json:"orderContract"`
	TokenContract      string `json:"tokenContract"`
	PlatformTreasury   string `json:"platformTreasury"`
	SignerAddress      string `json:"signerAddress"`
}

type Member struct {
	ID                       int64     `json:"id"`
	Email                    string    `json:"-"`
	PasswordHash             string    `json:"-"`
	DisplayName              string    `json:"displayName"`
	AvatarURL                string    `json:"avatarUrl"`
	WalletAddress            string    `json:"walletAddress,omitempty"`
	RegistrationInviteCode   string    `json:"registrationInviteCode,omitempty"`
	IsAdmin                  bool      `json:"isAdmin"`
	Points                   int64     `json:"points"`
	TokenBalance             int64     `json:"tokenBalance"`
	ProposalTicketCount      int64     `json:"proposalTicketCount"`
	VoteTicketCount          int64     `json:"voteTicketCount"`
	CreateOrderTicketCount   int64     `json:"createOrderTicketCount"`
	ProposalCouponCount      int64     `json:"proposalCouponCount"`
	VoteCouponCount          int64     `json:"voteCouponCount"`
	CreateOrderCouponCount   int64     `json:"createOrderCouponCount"`
	ClaimableProposalTickets int64     `json:"claimableProposalTickets"`
	ClaimableVoteTickets     int64     `json:"claimableVoteTickets"`
	ClaimableCreateOrderTickets int64  `json:"claimableCreateOrderTickets"`
	ClaimableProposalCoupons int64     `json:"claimableProposalCoupons"`
	ClaimableVoteCoupons     int64     `json:"claimableVoteCoupons"`
	ClaimableCreateOrderCoupons int64  `json:"claimableCreateOrderCoupons"`
	SubscriptionExpiresAt    time.Time `json:"subscriptionExpiresAt,omitempty"`
	SubscriptionActive       bool      `json:"subscriptionActive"`
	CreatedAt                time.Time `json:"createdAt"`
}

type GovernanceParams struct {
	CreateFeeWei              int64 `json:"createFeeWei"`
	ProposalFeeWei            int64 `json:"proposalFeeWei"`
	VoteFeeWei                int64 `json:"voteFeeWei"`
	SubscriptionFeeWei        int64 `json:"subscriptionFeeWei"`
	SubscriptionDurationDays  int64 `json:"subscriptionDurationDays"`
	WinnerProposalRefundBps   int64 `json:"winnerProposalRefundBps"`
	LoserProposalRefundBps    int64 `json:"loserProposalRefundBps"`
	VoteRefundBps             int64 `json:"voteRefundBps"`
	WinnerBonusBps            int64 `json:"winnerBonusBps"`
	LoserBonusBps             int64 `json:"loserBonusBps"`
	WinnerProposalPoints      int64 `json:"winnerProposalPoints"`
	WinnerVotePointsPerVote   int64 `json:"winnerVotePointsPerVote"`
	ProposalDurationMinutes   int64 `json:"proposalDurationMinutes"`
	VoteDurationMinutes       int64 `json:"voteDurationMinutes"`
	OrderingDurationMinutes   int64 `json:"orderingDurationMinutes"`
	DailyCreateCouponCount    int64 `json:"dailyCreateCouponCount"`
	DailyProposalCouponCount  int64 `json:"dailyProposalCouponCount"`
	DailyVoteCouponCount      int64 `json:"dailyVoteCouponCount"`
	PlatformEscrowFeeBps      int64 `json:"platformEscrowFeeBps"`
	MerchantAcceptTimeoutMins int64 `json:"merchantAcceptTimeoutMins"`
	MerchantCompleteTimeoutMins int64 `json:"merchantCompleteTimeoutMins"`
	MemberConfirmTimeoutMins  int64 `json:"memberConfirmTimeoutMins"`
	GovernanceClaimTimeoutMins int64 `json:"governanceClaimTimeoutMins"`
	EscrowClaimTimeoutMins    int64 `json:"escrowClaimTimeoutMins"`
}

type AchievementBuilding struct {
	Level int    `json:"level"`
	Name  string `json:"name"`
	Skin  string `json:"skin"`
}

type MemberProfile struct {
	Member       *Member               `json:"member"`
	Rank         int                   `json:"rank"`
	Buildings    []AchievementBuilding `json:"buildings"`
	RecentBadges []string              `json:"recentBadges"`
	History      map[string]int64      `json:"history"`
	Stats        map[string]int64      `json:"stats"`
}

type Merchant struct {
	ID                string      `json:"id"`
	Name              string      `json:"name"`
	Group             string      `json:"group"`
	Address           string      `json:"address"`
	Description       string      `json:"description"`
	PayoutAddress     string      `json:"payoutAddress"`
	AverageRating     float64     `json:"averageRating,omitempty"`
	ReviewCount       int64       `json:"reviewCount,omitempty"`
	DelistRequestedAt time.Time   `json:"delistRequestedAt,omitempty"`
	DelistedAt        time.Time   `json:"delistedAt,omitempty"`
	OwnerMemberID     int64       `json:"ownerMemberId,omitempty"`
	OwnerDisplayName  string      `json:"ownerDisplayName,omitempty"`
	Menu              []*MenuItem `json:"menu"`
}

type MenuItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	PriceWei    int64  `json:"priceWei"`
	Description string `json:"description"`
}

type Proposal struct {
	ID                     int64             `json:"id"`
	ChainProposalID        *int64            `json:"chainProposalId"`
	Title                  string            `json:"title"`
	Description            string            `json:"description"`
	MerchantGroup          string            `json:"merchantGroup"`
	MealPeriod             string            `json:"mealPeriod"`
	ProposalDate           string            `json:"proposalDate"`
	MaxOptions             int64             `json:"maxOptions"`
	CreatedBy              int64             `json:"createdBy"`
	CreatedByName          string            `json:"createdByName"`
	ProposalDeadline       time.Time         `json:"proposalDeadline"`
	VoteDeadline           time.Time         `json:"voteDeadline"`
	OrderDeadline          time.Time         `json:"orderDeadline"`
	Status                 string            `json:"status"`
	WinnerOptionID         int64             `json:"winnerOptionId"`
	RewardsApplied         bool              `json:"rewardsApplied"`
	GroupID                int64             `json:"groupId"`
	CreatedAt              time.Time         `json:"createdAt"`
	SettledAt              *time.Time        `json:"settledAt,omitempty"`
	OrderTotalWei          string            `json:"orderTotalWei"`
	OrderMemberCount       int64             `json:"orderMemberCount"`
	TotalVoteCount         int64             `json:"totalVoteCount"`
	CreateFeeWei           int64             `json:"createFeeWei"`
	CreateFeeRefundWei     int64             `json:"createFeeRefundWei"`
	CreateFeePlatformWei   int64             `json:"createFeePlatformWei"`
	ProposalFeeWei         int64             `json:"proposalFeeWei"`
	VoteFeeWei             int64             `json:"voteFeeWei"`
	WinnerProposalRefundBps int64            `json:"winnerProposalRefundBps"`
	LoserProposalRefundBps int64             `json:"loserProposalRefundBps"`
	VoteRefundBps          int64             `json:"voteRefundBps"`
	WinnerBonusBps         int64             `json:"winnerBonusBps"`
	LoserBonusBps          int64             `json:"loserBonusBps"`
	WinnerProposalPoints   int64             `json:"winnerProposalPoints"`
	WinnerVotePointsPerVote int64            `json:"winnerVotePointsPerVote"`
	UsedCreateOrderCoupon  bool              `json:"usedCreateOrderCoupon"`
	CurrentVoteOptionID    int64             `json:"currentVoteOptionId"`
	CurrentVoteTokenAmount int64             `json:"currentVoteTokenAmount"`
	CurrentVoteWeight      int64             `json:"currentVoteWeight"`
	FailedReason           string            `json:"failedReason,omitempty"`
	Options                []*ProposalOption `json:"options"`
	Votes                  []*VoteRecord     `json:"votes"`
	Orders                 []*Order          `json:"orders"`
}

type ProposalOption struct {
	ID               int64  `json:"id"`
	ChainOptionIndex *int64 `json:"chainOptionIndex"`
	MerchantID       string `json:"merchantId"`
	MerchantName     string `json:"merchantName"`
	ProposerMember   int64  `json:"proposerMemberId"`
	ProposerName     string `json:"proposerName"`
	WeightedVotes    int64  `json:"weightedVotes"`
	TokenStake       int64  `json:"tokenStake"`
	ProposalFeePaidWei int64 `json:"proposalFeePaidWei"`
	VoteFeeCollectedWei int64 `json:"voteFeeCollectedWei"`
	VoteRefundWei    int64  `json:"voteRefundWei"`
	ProposerRefundWei int64 `json:"proposerRefundWei"`
	ProposerRewardWei int64 `json:"proposerRewardWei"`
	FirstProposedAt  string `json:"firstProposedAt"`
	IsWinner         bool   `json:"isWinner"`
	UsedProposalCoupon bool `json:"usedProposalCoupon"`
	PartialRefund    int64  `json:"partialRefund"`
	WinnerTokenBack  int64  `json:"winnerTokenBack"`
}

type VoteRecord struct {
	MemberID     int64  `json:"memberId"`
	MemberName   string `json:"memberName"`
	OptionID     int64  `json:"optionId"`
	TokenAmount  int64  `json:"tokenAmount"`
	FeeAmountWei int64  `json:"feeAmountWei"`
	VoteWeight   int64  `json:"voteWeight"`
	VoteCount    int64  `json:"voteCount"`
	RefundWei    int64  `json:"refundWei"`
	SubmittedAt  string `json:"submittedAt"`
	WalletHidden bool   `json:"walletHidden"`
	UseVoteTicket bool  `json:"useVoteTicket"`
	UseVoteCoupon bool  `json:"useVoteCoupon"`
}

type Order struct {
	ID                    int64           `json:"id"`
	ProposalID            int64           `json:"proposalId"`
	EscrowOrderID         *int64          `json:"escrowOrderId,omitempty"`
	Title                 string          `json:"title"`
	MemberID              int64           `json:"memberId"`
	MemberName            string          `json:"memberName"`
	MerchantID            string          `json:"merchantId"`
	MerchantName          string          `json:"merchantName,omitempty"`
	MerchantPayoutAddress string          `json:"merchantPayoutAddress,omitempty"`
	OrderHash             string          `json:"orderHash"`
	AmountWei             string          `json:"amountWei"`
	Status                string          `json:"status"`
	Items                 []*OrderItem    `json:"items"`
	Signature             *OrderSignature `json:"signature,omitempty"`
	CreatedAt             time.Time       `json:"createdAt"`
	AcceptedAt            *time.Time      `json:"acceptedAt,omitempty"`
	CompletedAt           *time.Time      `json:"completedAt,omitempty"`
	ConfirmedAt           *time.Time      `json:"confirmedAt,omitempty"`
	PaidOutAt             *time.Time      `json:"paidOutAt,omitempty"`
}

type OrderItem struct {
	MenuItemID string `json:"menuItemId"`
	Name       string `json:"name"`
	Quantity   int64  `json:"quantity"`
	PriceWei   int64  `json:"priceWei"`
}

type OrderQuote struct {
	ProposalID         int64        `json:"proposalId"`
	MerchantID         string       `json:"merchantId"`
	MerchantName       string       `json:"merchantName"`
	Items              []*OrderItem `json:"items"`
	SubtotalWei        string       `json:"subtotalWei"`
	EstimatedGasWei    string       `json:"estimatedGasWei"`
	RequiredBalanceWei string       `json:"requiredBalanceWei"`
}

type OrderSignature struct {
	AmountWei       string `json:"amountWei"`
	Expiry          int64  `json:"expiry"`
	OrderHash       string `json:"orderHash"`
	Signature       string `json:"signature"`
	Digest          string `json:"digest"`
	SignerAddress   string `json:"signerAddress"`
	ContractAddress string `json:"contractAddress"`
	TokenAddress    string `json:"tokenAddress"`
}

type LeaderboardEntry struct {
	Rank         int    `json:"rank"`
	MemberID     int64  `json:"memberId"`
	DisplayName  string `json:"displayName"`
	AvatarURL    string `json:"avatarUrl"`
	Points       int64  `json:"points"`
	TokenBalance int64  `json:"tokenBalance"`
	BuildingName string `json:"buildingName"`
}

type ChainEvent struct {
	ID          int64  `json:"id"`
	BlockNumber uint64 `json:"blockNumber"`
	BlockHash   string `json:"blockHash"`
	TxHash      string `json:"txHash"`
	LogIndex    uint   `json:"logIndex"`
	EventName   string `json:"eventName"`
	ProposalID  int64  `json:"proposalId,omitempty"`
	PayloadJSON string `json:"payloadJson"`
	CreatedAt   string `json:"createdAt"`
}

type ChainSyncStatus struct {
	CursorKey         string `json:"cursorKey"`
	LastSyncedBlock   uint64 `json:"lastSyncedBlock"`
	LastSyncedAt      string `json:"lastSyncedAt"`
	LastSeenBlock     uint64 `json:"lastSeenBlock"`
	LastSyncError     string `json:"lastSyncError,omitempty"`
	IndexedEventCount int64  `json:"indexedEventCount"`
}

type ChainSyncResult struct {
	FromBlock    uint64        `json:"fromBlock"`
	ToBlock      uint64        `json:"toBlock"`
	IndexedCount int           `json:"indexedCount"`
	Events       []*ChainEvent `json:"events"`
}

type PendingTransaction struct {
	ID             int64  `json:"id"`
	MemberID       int64  `json:"memberId"`
	ProposalID     int64  `json:"proposalId,omitempty"`
	Action         string `json:"action"`
	TxHash         string `json:"txHash"`
	WalletAddress  string `json:"walletAddress"`
	Status         string `json:"status"`
	RelatedEvent   string `json:"relatedEvent,omitempty"`
	RelatedOrder   string `json:"relatedOrder,omitempty"`
	ErrorMessage   string `json:"errorMessage,omitempty"`
	ConfirmedBlock uint64 `json:"confirmedBlock,omitempty"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

type UsageRecord struct {
	ID         int64  `json:"id"`
	MemberID   int64  `json:"memberId"`
	ProposalID int64  `json:"proposalId,omitempty"`
	Action     string `json:"action"`
	AssetType  string `json:"assetType"`
	Direction  string `json:"direction"`
	Amount     string `json:"amount"`
	Note       string `json:"note,omitempty"`
	Reference  string `json:"reference,omitempty"`
	CreatedAt  string `json:"createdAt"`
}

type Group struct {
	ID            int64          `json:"id"`
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	OwnerMemberID int64          `json:"ownerMemberId"`
	CreatedAt     string         `json:"createdAt"`
	Members       []*GroupMember `json:"members,omitempty"`
	InviteCode    string         `json:"inviteCode,omitempty"`
}

type GroupMember struct {
	MemberID      int64  `json:"memberId"`
	DisplayName   string `json:"displayName"`
	WalletAddress string `json:"walletAddress,omitempty"`
	Points        int64  `json:"points,omitempty"`
	JoinedAt      string `json:"joinedAt"`
}

type GroupInvite struct {
	ID         int64  `json:"id"`
	GroupID    int64  `json:"groupId"`
	InviteCode string `json:"inviteCode"`
	CreatedBy  int64  `json:"createdBy"`
	CreatedAt  string `json:"createdAt"`
	UsageCount int64  `json:"usageCount"`
}

type RegistrationInviteUsage struct {
	ID              int64  `json:"id"`
	InviteCode      string `json:"inviteCode"`
	InviterMemberID int64  `json:"inviterMemberId"`
	InviterName     string `json:"inviterName"`
	UsedByMemberID  int64  `json:"usedByMemberId"`
	UsedByName      string `json:"usedByName"`
	UsedAt          string `json:"usedAt"`
}

type GroupInviteUsage struct {
	ID            int64  `json:"id"`
	GroupID       int64  `json:"groupId"`
	InviteCode    string `json:"inviteCode"`
	UsedByMemberID int64 `json:"usedByMemberId"`
	UsedByName    string `json:"usedByName"`
	UsedAt        string `json:"usedAt"`
}

type GroupMemberDetail struct {
	MemberID            int64                 `json:"memberId"`
	DisplayName         string                `json:"displayName"`
	WalletAddress       string                `json:"walletAddress,omitempty"`
	Points              int64                 `json:"points"`
	TokenBalance        int64                 `json:"tokenBalance"`
	JoinedAt            string                `json:"joinedAt"`
	OrdersSubmitted     int64                 `json:"ordersSubmitted"`
	VotesCast           int64                 `json:"votesCast"`
	ProposalsCreated    int64                 `json:"proposalsCreated"`
	MerchantReviews     int64                 `json:"merchantReviews"`
	RecentOrders        []*Order              `json:"recentOrders"`
	Profile             *MemberProfile        `json:"profile,omitempty"`
}

type GroupDetail struct {
	Group             *Group               `json:"group"`
	MemberCount       int64                `json:"memberCount"`
	Members           []*GroupMemberDetail `json:"members"`
	CanManage         bool                 `json:"canManage"`
	InviteUsages      []*GroupInviteUsage  `json:"inviteUsages,omitempty"`
}

type MerchantReview struct {
	ID               int64     `json:"id"`
	MerchantID       string    `json:"merchantId"`
	MemberID         int64     `json:"memberId"`
	MemberName       string    `json:"memberName"`
	Rating           int64     `json:"rating"`
	Comment          string    `json:"comment"`
	CreatedAt        time.Time `json:"createdAt"`
}

type MerchantDetail struct {
	Merchant *Merchant         `json:"merchant"`
	Reviews  []*MerchantReview `json:"reviews"`
}

type MemberOrderHistory struct {
	Orders []*Order `json:"orders"`
}

type WalletAuthChallenge struct {
	WalletAddress string    `json:"walletAddress"`
	Nonce         string    `json:"nonce"`
	Message       string    `json:"message"`
	ExpiresAt     time.Time `json:"expiresAt"`
}

type MenuChangeRequest struct {
	ID                int64     `json:"id"`
	MerchantID        string    `json:"merchantId"`
	MenuItemID        string    `json:"menuItemId"`
	Action            string    `json:"action"`
	Status            string    `json:"status"`
	ItemName          string    `json:"itemName"`
	PriceWei          int64     `json:"priceWei"`
	Description       string    `json:"description"`
	RequestedByMember int64     `json:"requestedByMember"`
	RequestedByName   string    `json:"requestedByName"`
	ReviewedByMember  int64     `json:"reviewedByMember,omitempty"`
	ReviewedByName    string    `json:"reviewedByName,omitempty"`
	ReviewNote        string    `json:"reviewNote,omitempty"`
	EffectiveAt       time.Time `json:"effectiveAt,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	ReviewedAt        time.Time `json:"reviewedAt,omitempty"`
}

type MerchantDelistRequest struct {
	MerchantID        string    `json:"merchantId"`
	MerchantName      string    `json:"merchantName"`
	OwnerMemberID     int64     `json:"ownerMemberId"`
	OwnerDisplayName  string    `json:"ownerDisplayName"`
	PayoutAddress     string    `json:"payoutAddress"`
	RequestedAt       time.Time `json:"requestedAt"`
	ReviewedAt        time.Time `json:"reviewedAt,omitempty"`
	Decision          string    `json:"decision,omitempty"`
	CurrentlyDelisted bool      `json:"currentlyDelisted"`
}

type MerchantDashboard struct {
	Merchant            *Merchant            `json:"merchant"`
	Orders              []*Order             `json:"orders"`
	MenuChangeRequests  []*MenuChangeRequest `json:"menuChangeRequests"`
	AcceptedOrderCount  int64                `json:"acceptedOrderCount"`
	PendingOrderCount   int64                `json:"pendingOrderCount"`
	CompletedOrderCount int64                `json:"completedOrderCount"`
	TotalOrderCount     int64                `json:"totalOrderCount"`
	TotalRevenueWei     string               `json:"totalRevenueWei"`
}

type ReadyPayoutOrder struct {
	OrderID               int64     `json:"orderId"`
	ProposalID            int64     `json:"proposalId"`
	EscrowOrderID         *int64    `json:"escrowOrderId,omitempty"`
	Title                 string    `json:"title"`
	MemberName            string    `json:"memberName"`
	MerchantID            string    `json:"merchantId"`
	MerchantName          string    `json:"merchantName"`
	MerchantPayoutAddress string    `json:"merchantPayoutAddress"`
	AmountWei             string    `json:"amountWei"`
	Status                string    `json:"status"`
	CreatedAt             time.Time `json:"createdAt"`
}

type AdminDashboard struct {
	MemberCount            int64                    `json:"memberCount"`
	GroupCount             int64                    `json:"groupCount"`
	MerchantCount          int64                    `json:"merchantCount"`
	OrderCount             int64                    `json:"orderCount"`
	DinerCount             int64                    `json:"dinerCount"`
	TotalServings          int64                    `json:"totalServings"`
	PendingMenuReviews     int64                    `json:"pendingMenuReviews"`
	PendingMerchantDelists int64                    `json:"pendingMerchantDelists"`
	PlatformTreasury       string                   `json:"platformTreasury"`
	GovernanceParams       *GovernanceParams        `json:"governanceParams,omitempty"`
	MenuChangeRequests     []*MenuChangeRequest     `json:"menuChangeRequests"`
	MerchantDelistRequests []*MerchantDelistRequest `json:"merchantDelistRequests"`
	ReadyPayoutOrders      []*ReadyPayoutOrder      `json:"readyPayoutOrders"`
}

type AdminMemberSummary struct {
	ID                 int64     `json:"id"`
	DisplayName        string    `json:"displayName"`
	Email              string    `json:"email"`
	WalletAddress      string    `json:"walletAddress,omitempty"`
	IsAdmin            bool      `json:"isAdmin"`
	SubscriptionActive bool      `json:"subscriptionActive"`
	TokenBalance       int64     `json:"tokenBalance"`
	Points             int64     `json:"points"`
	CreatedAt          time.Time `json:"createdAt"`
}

type AdminGroupSummary struct {
	ID               int64     `json:"id"`
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	OwnerMemberID    int64     `json:"ownerMemberId"`
	OwnerDisplayName string    `json:"ownerDisplayName"`
	MemberCount      int64     `json:"memberCount"`
	CreatedAt        time.Time `json:"createdAt"`
}

type AdminInsights struct {
	Groups    []*AdminGroupSummary  `json:"groups"`
	Members   []*AdminMemberSummary `json:"members"`
	Merchants []*Merchant           `json:"merchants"`
	Orders    []*Order              `json:"orders"`
}
