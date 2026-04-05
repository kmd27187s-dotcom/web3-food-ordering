package models

import "time"

type ContractInfo struct {
	ChainID          int64  `json:"chainId"`
	OrderContract    string `json:"orderContract"`
	TokenContract    string `json:"tokenContract"`
	PlatformTreasury string `json:"platformTreasury"`
	SignerAddress    string `json:"signerAddress"`
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
	ClaimableProposalTickets int64     `json:"claimableProposalTickets"`
	SubscriptionExpiresAt    time.Time `json:"subscriptionExpiresAt,omitempty"`
	SubscriptionActive       bool      `json:"subscriptionActive"`
	CreatedAt                time.Time `json:"createdAt"`
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
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Group         string      `json:"group"`
	PayoutAddress string      `json:"payoutAddress"`
	Menu          []*MenuItem `json:"menu"`
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
	OrderTotalWei          string            `json:"orderTotalWei"`
	OrderMemberCount       int64             `json:"orderMemberCount"`
	CurrentVoteOptionID    int64             `json:"currentVoteOptionId"`
	CurrentVoteTokenAmount int64             `json:"currentVoteTokenAmount"`
	CurrentVoteWeight      int64             `json:"currentVoteWeight"`
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
	PartialRefund    int64  `json:"partialRefund"`
	WinnerTokenBack  int64  `json:"winnerTokenBack"`
}

type VoteRecord struct {
	MemberID     int64  `json:"memberId"`
	MemberName   string `json:"memberName"`
	OptionID     int64  `json:"optionId"`
	TokenAmount  int64  `json:"tokenAmount"`
	VoteWeight   int64  `json:"voteWeight"`
	SubmittedAt  string `json:"submittedAt"`
	WalletHidden bool   `json:"walletHidden"`
}

type Order struct {
	ID         int64           `json:"id"`
	ProposalID int64           `json:"proposalId"`
	MemberID   int64           `json:"memberId"`
	MemberName string          `json:"memberName"`
	MerchantID string          `json:"merchantId"`
	OrderHash  string          `json:"orderHash"`
	AmountWei  string          `json:"amountWei"`
	Status     string          `json:"status"`
	Items      []*OrderItem    `json:"items"`
	Signature  *OrderSignature `json:"signature,omitempty"`
	CreatedAt  time.Time       `json:"createdAt"`
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
	MemberID    int64  `json:"memberId"`
	DisplayName string `json:"displayName"`
	JoinedAt    string `json:"joinedAt"`
}

type GroupInvite struct {
	ID         int64  `json:"id"`
	GroupID    int64  `json:"groupId"`
	InviteCode string `json:"inviteCode"`
	CreatedBy  int64  `json:"createdBy"`
	CreatedAt  string `json:"createdAt"`
}

type WalletAuthChallenge struct {
	WalletAddress string    `json:"walletAddress"`
	Nonce         string    `json:"nonce"`
	Message       string    `json:"message"`
	ExpiresAt     time.Time `json:"expiresAt"`
}
