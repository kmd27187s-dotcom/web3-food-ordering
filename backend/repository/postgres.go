package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"

	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PostgresStore struct {
	db                         *gorm.DB
	contractInfo               models.ContractInfo
	inactiveGroupThresholdDays int64
}

type postgresMemberModel struct {
	ID                       int64 `gorm:"primaryKey"`
	Email                    string
	PasswordHash             string
	DisplayName              string `gorm:"not null"`
	AvatarURL                string
	WalletAddress            *string `gorm:"uniqueIndex"`
	RegistrationInviteCode   *string `gorm:"uniqueIndex"`
	IsAdmin                  bool    `gorm:"not null;default:false"`
	Points                   int64   `gorm:"not null;default:0"`
	TokenBalance             int64   `gorm:"not null;default:0"`
	ProposalTicketCount      int64   `gorm:"not null;default:0"`
	VoteTicketCount          int64   `gorm:"not null;default:0"`
	CreateOrderTicketCount   int64   `gorm:"not null;default:0"`
	ClaimableProposalTickets int64   `gorm:"not null;default:0"`
	ClaimableVoteTickets     int64   `gorm:"not null;default:0"`
	ClaimableCreateOrderTickets int64 `gorm:"not null;default:0"`
	SubscriptionExpiresAt    *time.Time
	LastDailyLoginRewardAt   *time.Time
	CreatedAt                time.Time `gorm:"not null"`
}

func (postgresMemberModel) TableName() string { return "members" }

type postgresSessionModel struct {
	Token     string    `gorm:"primaryKey"`
	MemberID  int64     `gorm:"not null;index"`
	CreatedAt time.Time `gorm:"not null"`
}

func (postgresSessionModel) TableName() string { return "sessions" }

type postgresWalletAuthChallengeModel struct {
	WalletAddress string    `gorm:"primaryKey"`
	Nonce         string    `gorm:"not null"`
	Message       string    `gorm:"not null"`
	ExpiresAt     time.Time `gorm:"not null"`
	CreatedAt     time.Time `gorm:"not null"`
}

func (postgresWalletAuthChallengeModel) TableName() string { return "wallet_auth_challenges" }

type postgresGroupModel struct {
	ID            int64  `gorm:"primaryKey"`
	Name          string `gorm:"not null"`
	Description   string
	OwnerMemberID int64     `gorm:"not null;index"`
	CreatedAt     time.Time `gorm:"not null"`
}

func (postgresGroupModel) TableName() string { return "groups" }

type postgresGroupMembershipModel struct {
	GroupID  int64     `gorm:"primaryKey"`
	MemberID int64     `gorm:"primaryKey"`
	JoinedAt time.Time `gorm:"not null"`
}

func (postgresGroupMembershipModel) TableName() string { return "group_memberships" }

type postgresGroupInviteModel struct {
	ID         int64     `gorm:"primaryKey"`
	GroupID    int64     `gorm:"not null;index"`
	InviteCode string    `gorm:"not null;uniqueIndex"`
	CreatedBy  int64     `gorm:"not null"`
	CreatedAt  time.Time `gorm:"not null"`
}

func (postgresGroupInviteModel) TableName() string { return "group_invites" }

type postgresRegistrationInviteUsageModel struct {
	ID              int64     `gorm:"primaryKey"`
	InviteCode      string    `gorm:"not null;index"`
	InviterMemberID int64     `gorm:"not null;index"`
	UsedByMemberID  int64     `gorm:"not null;index"`
	UsedAt          time.Time `gorm:"not null"`
}

func (postgresRegistrationInviteUsageModel) TableName() string { return "registration_invite_usages" }

type postgresGroupInviteUsageModel struct {
	ID           int64     `gorm:"primaryKey"`
	GroupID       int64    `gorm:"not null;index"`
	InviteCode   string    `gorm:"not null;index"`
	UsedByMemberID int64   `gorm:"not null;index"`
	UsedAt       time.Time `gorm:"not null"`
}

func (postgresGroupInviteUsageModel) TableName() string { return "group_invite_usages" }

type postgresFaucetClaimModel struct {
	ID            int64     `gorm:"primaryKey"`
	MemberID      int64     `gorm:"not null;uniqueIndex"`
	WalletAddress *string   `gorm:"index"`
	ClaimedAt     time.Time `gorm:"not null"`
}

func (postgresFaucetClaimModel) TableName() string { return "faucet_claims" }

type postgresMerchantModel struct {
	ID                string `gorm:"primaryKey"`
	Name              string `gorm:"not null"`
	MerchantGroup     string `gorm:"not null;index"`
	Address           string
	Description       string
	PayoutAddress     string `gorm:"not null"`
	DelistRequestedAt *time.Time
	DelistedAt        *time.Time
	OwnerMemberID     *int64 `gorm:"index"`
}

func (postgresMerchantModel) TableName() string { return "merchants" }

type postgresMenuItemModel struct {
	ID          int64  `gorm:"primaryKey"`
	MerchantID  string `gorm:"not null;index"`
	ItemID      string `gorm:"not null"`
	Name        string `gorm:"not null"`
	PriceWei    int64  `gorm:"not null"`
	Description string `gorm:"not null"`
}

func (postgresMenuItemModel) TableName() string { return "menu_items" }

type postgresMerchantReviewModel struct {
	ID         int64     `gorm:"primaryKey"`
	MerchantID string    `gorm:"not null;index"`
	MemberID   int64     `gorm:"not null;index"`
	MemberName string    `gorm:"not null"`
	Rating     int64     `gorm:"not null"`
	Comment    string    `gorm:"not null"`
	CreatedAt  time.Time `gorm:"not null"`
}

func (postgresMerchantReviewModel) TableName() string { return "merchant_reviews" }

type postgresMenuChangeRequestModel struct {
	ID                int64  `gorm:"primaryKey"`
	MerchantID        string `gorm:"not null;index"`
	MenuItemID        string `gorm:"not null"`
	Action            string `gorm:"not null"`
	Status            string `gorm:"not null;index"`
	ItemName          string `gorm:"not null"`
	PriceWei          int64  `gorm:"not null"`
	Description       string `gorm:"not null"`
	RequestedByMember int64  `gorm:"not null;index"`
	RequestedByName   string `gorm:"not null"`
	ReviewedByMember  *int64 `gorm:"index"`
	ReviewedByName    string
	ReviewNote        string
	EffectiveAt       *time.Time
	CreatedAt         time.Time `gorm:"not null"`
	ReviewedAt        *time.Time
}

func (postgresMenuChangeRequestModel) TableName() string { return "menu_change_requests" }

type postgresProposalModel struct {
	ID               int64     `gorm:"primaryKey"`
	Title            string    `gorm:"not null"`
	Description      string    `gorm:"not null"`
	MerchantGroup    string    `gorm:"not null"`
	MealPeriod       string    `gorm:"not null;default:lunch"`
	ProposalDate     string    `gorm:"not null"`
	MaxOptions       int64     `gorm:"not null;default:5"`
	CreatedBy        int64     `gorm:"not null;index"`
	CreatedByName    string    `gorm:"not null"`
	UsedCreateOrderTicket bool `gorm:"not null;default:false"`
	ProposalDeadline time.Time `gorm:"not null"`
	VoteDeadline     time.Time `gorm:"not null"`
	OrderDeadline    time.Time `gorm:"not null"`
	WinnerOptionID   int64     `gorm:"not null;default:0"`
	RewardsApplied   bool      `gorm:"not null;default:false"`
	GroupID          *int64
	CreatedAt        time.Time `gorm:"not null"`
}

func (postgresProposalModel) TableName() string { return "proposals" }

type postgresProposalOptionModel struct {
	ID               int64     `gorm:"primaryKey"`
	ProposalID       int64     `gorm:"not null;index;uniqueIndex:idx_proposal_options_proposal_proposer_unique"`
	MerchantID       string    `gorm:"not null"`
	MerchantName     string    `gorm:"not null"`
	ProposerMemberID int64     `gorm:"not null;index;uniqueIndex:idx_proposal_options_proposal_proposer_unique"`
	ProposerName     string    `gorm:"not null"`
	UsedProposalTicket bool    `gorm:"not null;default:false"`
	WeightedVotes    int64     `gorm:"not null;default:0"`
	TokenStake       int64     `gorm:"not null;default:0"`
	PartialRefund    int64     `gorm:"not null;default:0"`
	WinnerTokenBack  int64     `gorm:"not null;default:0"`
	CreatedAt        time.Time `gorm:"not null"`
}

func (postgresProposalOptionModel) TableName() string { return "proposal_options" }

type postgresVoteModel struct {
	ID           int64     `gorm:"primaryKey"`
	ProposalID   int64     `gorm:"not null;uniqueIndex:idx_votes_proposal_member_unique"`
	MemberID     int64     `gorm:"not null;uniqueIndex:idx_votes_proposal_member_unique"`
	MemberName   string    `gorm:"not null"`
	OptionID     int64     `gorm:"not null;index"`
	TokenAmount  int64     `gorm:"not null"`
	VoteWeight   int64     `gorm:"not null"`
	UseVoteTicket bool     `gorm:"not null;default:false"`
	SubmittedAt  time.Time `gorm:"not null"`
	WalletHidden bool      `gorm:"not null;default:true"`
}

func (postgresVoteModel) TableName() string { return "votes" }

type postgresOrderModel struct {
	ID                 int64     `gorm:"primaryKey"`
	ProposalID         int64     `gorm:"not null;index"`
	MemberID           int64     `gorm:"not null;index"`
	MemberName         string    `gorm:"not null"`
	MerchantID         string    `gorm:"not null"`
	OrderHash          string    `gorm:"not null"`
	AmountWei          string    `gorm:"not null"`
	Status             string    `gorm:"not null"`
	SignatureAmountWei string    `gorm:"not null"`
	SignatureExpiry    int64     `gorm:"not null"`
	SignatureValue     string    `gorm:"not null"`
	SignatureDigest    string    `gorm:"not null"`
	SignerAddress      string    `gorm:"not null"`
	ContractAddress    string    `gorm:"not null"`
	TokenAddress       string    `gorm:"not null"`
	CreatedAt          time.Time `gorm:"not null"`
	AcceptedAt         *time.Time
	CompletedAt        *time.Time
	ConfirmedAt        *time.Time
	PaidOutAt          *time.Time
}

func (postgresOrderModel) TableName() string { return "orders" }

func (s *PostgresStore) proposalTitleByID(ctx context.Context, proposalID int64) string {
	if proposalID == 0 {
		return ""
	}
	var proposal postgresProposalModel
	if err := s.db.WithContext(ctx).Select("title").First(&proposal, "id = ?", proposalID).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(proposal.Title)
}

type postgresOrderItemModel struct {
	ID         int64  `gorm:"primaryKey"`
	OrderID    int64  `gorm:"not null;index"`
	MenuItemID string `gorm:"not null"`
	Name       string `gorm:"not null"`
	Quantity   int64  `gorm:"not null"`
	PriceWei   int64  `gorm:"not null"`
}

func (postgresOrderItemModel) TableName() string { return "order_items" }

type postgresUsageRecordModel struct {
	ID         int64  `gorm:"primaryKey"`
	MemberID   int64  `gorm:"not null;index"`
	ProposalID int64  `gorm:"index"`
	Action     string `gorm:"not null"`
	AssetType  string `gorm:"not null"`
	Direction  string `gorm:"not null"`
	Amount     string `gorm:"not null"`
	Note       string
	Reference  string
	CreatedAt  time.Time `gorm:"not null"`
}

func (postgresUsageRecordModel) TableName() string { return "usage_records" }

type postgresPendingTransactionModel struct {
	ID             int64  `gorm:"primaryKey"`
	MemberID       int64  `gorm:"not null;index"`
	ProposalID     int64  `gorm:"index"`
	Action         string `gorm:"not null"`
	TxHash         string `gorm:"not null;uniqueIndex"`
	WalletAddress  string `gorm:"not null"`
	Status         string `gorm:"not null"`
	RelatedEvent   string
	RelatedOrder   string
	ErrorMessage   string
	ConfirmedBlock uint64
	CreatedAt      time.Time `gorm:"not null"`
	UpdatedAt      time.Time `gorm:"not null"`
}

func (postgresPendingTransactionModel) TableName() string { return "pending_transactions" }

type postgresChainEventModel struct {
	ID          int64     `gorm:"primaryKey"`
	BlockNumber uint64    `gorm:"not null;index"`
	BlockHash   string    `gorm:"not null"`
	TxHash      string    `gorm:"not null;uniqueIndex:idx_chain_event_unique"`
	LogIndex    uint      `gorm:"not null;uniqueIndex:idx_chain_event_unique"`
	EventName   string    `gorm:"not null"`
	ProposalID  int64     `gorm:"index"`
	PayloadJSON string    `gorm:"not null"`
	CreatedAt   time.Time `gorm:"not null"`
}

func (postgresChainEventModel) TableName() string { return "chain_events" }

type postgresProposalChainMapModel struct {
	LocalProposalID int64 `gorm:"primaryKey"`
	ChainProposalID int64 `gorm:"not null;uniqueIndex"`
}

func (postgresProposalChainMapModel) TableName() string { return "proposal_chain_map" }

type postgresProposalOptionChainMapModel struct {
	LocalOptionID    int64 `gorm:"primaryKey"`
	LocalProposalID  int64 `gorm:"not null;uniqueIndex:idx_postgres_option_chain_map"`
	ChainOptionIndex int64 `gorm:"not null;uniqueIndex:idx_postgres_option_chain_map"`
}

func (postgresProposalOptionChainMapModel) TableName() string { return "proposal_option_chain_map" }

type postgresAppliedChainEventModel struct {
	TxHash    string    `gorm:"primaryKey"`
	LogIndex  uint      `gorm:"primaryKey"`
	AppliedAt time.Time `gorm:"not null"`
}

func (postgresAppliedChainEventModel) TableName() string { return "applied_chain_events" }

type postgresSyncStateModel struct {
	CursorKey       string    `gorm:"primaryKey"`
	LastSyncedBlock uint64    `gorm:"not null;default:0"`
	LastSyncedAt    string    `gorm:"not null;default:''"`
	LastSeenBlock   uint64    `gorm:"not null;default:0"`
	LastSyncError   string    `gorm:"not null;default:''"`
	UpdatedAt       time.Time `gorm:"not null"`
}

func (postgresSyncStateModel) TableName() string { return "sync_state" }

type postgresSystemSettingModel struct {
	Key       string    `gorm:"primaryKey"`
	Value     string    `gorm:"not null"`
	UpdatedAt time.Time `gorm:"not null"`
}

func (postgresSystemSettingModel) TableName() string { return "system_settings" }

func NewPostgresStore(cfg config.StorageConfig, info models.ContractInfo) (*PostgresStore, error) {
	if cfg.PostgresDSN == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	db, err := gorm.Open(gormpostgres.Open(cfg.PostgresDSN), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	store := &PostgresStore{
		db:                         db,
		contractInfo:               info,
		inactiveGroupThresholdDays: 90,
	}

	if cfg.AutoMigrate {
		if err := store.autoMigrate(); err != nil {
			return nil, err
		}
		if err := store.seedMerchants(); err != nil {
			return nil, err
		}
		var memberCount int64
		if err := store.db.Model(&postgresMemberModel{}).Count(&memberCount).Error; err != nil {
			return nil, err
		}
		if memberCount == 0 {
			if err := store.seedDemoData(); err != nil {
				return nil, err
			}
		}
	}

	return store, nil
}

// TestGorm 供 repository 套件測試與 internal/testpg 取得 *gorm.DB（例如關閉連線）；正式業務請用 Store 介面方法。
func (s *PostgresStore) TestGorm() *gorm.DB {
	return s.db
}

func (s *PostgresStore) autoMigrate() error {
	if err := s.db.AutoMigrate(
		&postgresMemberModel{},
		&postgresSessionModel{},
		&postgresWalletAuthChallengeModel{},
		&postgresGroupModel{},
		&postgresGroupMembershipModel{},
		&postgresGroupInviteModel{},
		&postgresRegistrationInviteUsageModel{},
		&postgresGroupInviteUsageModel{},
		&postgresFaucetClaimModel{},
		&postgresMerchantModel{},
		&postgresMenuItemModel{},
		&postgresMerchantReviewModel{},
		&postgresMenuChangeRequestModel{},
		&postgresProposalModel{},
		&postgresProposalOptionModel{},
		&postgresVoteModel{},
		&postgresOrderModel{},
		&postgresOrderItemModel{},
		&postgresUsageRecordModel{},
		&postgresPendingTransactionModel{},
		&postgresChainEventModel{},
		&postgresProposalChainMapModel{},
		&postgresProposalOptionChainMapModel{},
		&postgresAppliedChainEventModel{},
		&postgresSyncStateModel{},
		&postgresSystemSettingModel{},
	); err != nil {
		return err
	}
	if err := s.db.Exec("DROP INDEX IF EXISTS idx_proposals_group_period_date_unique").Error; err != nil {
		return err
	}
	return s.backfillLegacyOrders()
}

func (s *PostgresStore) SetInactiveGroupThresholdDays(days int64) {
	if days > 0 {
		s.inactiveGroupThresholdDays = days
	}
}

func (s *PostgresStore) ContractInfo() models.ContractInfo {
	ctx := context.Background()
	var setting postgresSystemSettingModel
	if err := s.db.WithContext(ctx).First(&setting, "key = ?", "platform_treasury").Error; err == nil && strings.TrimSpace(setting.Value) != "" {
		info := s.contractInfo
		info.PlatformTreasury = setting.Value
		return info
	}
	return s.contractInfo
}

func (s *PostgresStore) SetPlatformTreasury(address string) (models.ContractInfo, error) {
	ctx := context.Background()
	address = strings.TrimSpace(address)
	if address == "" {
		address = "0x0000000000000000000000000000000000000000"
	}
	if err := s.db.WithContext(ctx).Save(&postgresSystemSettingModel{
		Key:       "platform_treasury",
		Value:     address,
		UpdatedAt: time.Now().UTC(),
	}).Error; err != nil {
		return models.ContractInfo{}, err
	}
	s.contractInfo.PlatformTreasury = address
	return s.contractInfo, nil
}

func (s *PostgresStore) PruneInactiveGroups(ctx context.Context) error {
	type activityRow struct {
		GroupID      int64
		GroupCreated time.Time
		ProposalAt   *time.Time
		VoteAt       *time.Time
		OrderAt      *time.Time
	}
	var rows []activityRow
	if err := s.db.WithContext(ctx).Table("groups g").
		Select(`
			g.id AS group_id,
			g.created_at AS group_created,
			(SELECT MAX(p.created_at) FROM proposals p WHERE COALESCE(p.group_id, 0) = g.id) AS proposal_at,
			(SELECT MAX(v.submitted_at) FROM votes v JOIN proposals p ON p.id = v.proposal_id WHERE COALESCE(p.group_id, 0) = g.id) AS vote_at,
			(SELECT MAX(o.created_at) FROM orders o JOIN proposals p ON p.id = o.proposal_id WHERE COALESCE(p.group_id, 0) = g.id) AS order_at`).
		Scan(&rows).Error; err != nil {
		return err
	}
	thresholdDays := s.inactiveGroupThresholdDays
	if thresholdDays <= 0 {
		thresholdDays = defaultInactiveGroupThresholdDays
	}
	cutoff := time.Now().UTC().Add(-time.Duration(thresholdDays) * 24 * time.Hour)
	for _, row := range rows {
		lastActivity := row.GroupCreated
		for _, candidate := range []*time.Time{row.ProposalAt, row.VoteAt, row.OrderAt} {
			if candidate != nil && candidate.After(lastActivity) {
				lastActivity = *candidate
			}
		}
		if !lastActivity.IsZero() && lastActivity.Before(cutoff) {
			if err := s.DeleteGroup(row.GroupID); err != nil {
				return err
			}
		}
	}
	return nil
}

func postgresNotImplemented(method string) error {
	return fmt.Errorf("postgres store: %s not implemented yet", method)
}

func (s *PostgresStore) CreateMember(email, passwordHash, displayName string, isAdmin bool, tokenBalance int64, avatarURL string) (int64, error) {
	ctx := context.Background()
	var member postgresMemberModel
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		member = postgresMemberModel{
			Email:                    email,
			PasswordHash:             passwordHash,
			DisplayName:              displayName,
			AvatarURL:                avatarURL,
			IsAdmin:                  isAdmin,
			TokenBalance:             tokenBalance,
			CreatedAt:                now,
			ProposalTicketCount:         0,
			VoteTicketCount:             0,
			CreateOrderTicketCount:      0,
			ClaimableProposalTickets:    0,
			ClaimableVoteTickets:        0,
			ClaimableCreateOrderTickets: 0,
		}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}
		inviteCode, err := assignRandomRegistrationInviteCode(tx, member.ID)
		if err != nil {
			return err
		}
		code := inviteCode
		member.RegistrationInviteCode = &code
		return nil
	})
	if err != nil {
		return 0, err
	}
	return member.ID, nil
}

func (s *PostgresStore) MemberCount() (int64, error) {
	ctx := context.Background()
	var count int64
	return count, s.db.WithContext(ctx).Model(&postgresMemberModel{}).Count(&count).Error
}

func (s *PostgresStore) MemberByEmail(email string) (*models.Member, error) {
	return s.memberByQuery(func(db *gorm.DB) *gorm.DB { return db.Where("email = ?", email) })
}

func (s *PostgresStore) MemberByWallet(wallet string) (*models.Member, error) {
	return s.memberByQuery(func(db *gorm.DB) *gorm.DB { return db.Where("LOWER(wallet_address) = LOWER(?)", wallet) })
}

func (s *PostgresStore) MemberByRegistrationInviteCode(code string) (*models.Member, error) {
	code = strings.TrimSpace(code)
	return s.memberByQuery(func(db *gorm.DB) *gorm.DB { return db.Where("LOWER(registration_invite_code) = LOWER(?)", code) })
}

func (s *PostgresStore) ListRegistrationInviteUsages(memberID int64) ([]*models.RegistrationInviteUsage, error) {
	ctx := context.Background()
	type usageRow struct {
		ID              int64
		InviteCode      string
		InviterMemberID int64
		InviterName     string
		UsedByMemberID  int64
		UsedByName      string
		UsedAt          time.Time
	}
	var rows []usageRow
	if err := s.db.WithContext(ctx).
		Table("registration_invite_usages AS u").
		Select("u.id, u.invite_code, u.inviter_member_id, inviter.display_name AS inviter_name, u.used_by_member_id, used.display_name AS used_by_name, u.used_at").
		Joins("JOIN members AS inviter ON inviter.id = u.inviter_member_id").
		Joins("JOIN members AS used ON used.id = u.used_by_member_id").
		Where("u.inviter_member_id = ?", memberID).
		Order("u.used_at DESC, u.id DESC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.RegistrationInviteUsage, 0, len(rows))
	for _, row := range rows {
		items = append(items, &models.RegistrationInviteUsage{
			ID:              row.ID,
			InviteCode:      row.InviteCode,
			InviterMemberID: row.InviterMemberID,
			InviterName:     row.InviterName,
			UsedByMemberID:  row.UsedByMemberID,
			UsedByName:      row.UsedByName,
			UsedAt:          row.UsedAt.UTC().Format(time.RFC3339),
		})
	}
	return items, nil
}

func (s *PostgresStore) RecordRegistrationInviteUsage(inviteCode string, inviterMemberID, usedByMemberID int64) error {
	ctx := context.Background()
	var existing int64
	if err := s.db.WithContext(ctx).Model(&postgresRegistrationInviteUsageModel{}).
		Where("inviter_member_id = ? AND used_by_member_id = ?", inviterMemberID, usedByMemberID).
		Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}
	return s.db.WithContext(ctx).Create(&postgresRegistrationInviteUsageModel{
		InviteCode:      strings.TrimSpace(inviteCode),
		InviterMemberID: inviterMemberID,
		UsedByMemberID:  usedByMemberID,
		UsedAt:          time.Now().UTC(),
	}).Error
}

func (s *PostgresStore) MemberBySession(token string) (*models.Member, error) {
	ctx := context.Background()
	var session postgresSessionModel
	if err := s.db.WithContext(ctx).First(&session, "token = ?", token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid session")
		}
		return nil, err
	}
	return s.MemberByID(session.MemberID)
}

func (s *PostgresStore) MemberByID(id int64) (*models.Member, error) {
	return s.memberByQuery(func(db *gorm.DB) *gorm.DB { return db.Where("id = ?", id) })
}

func (s *PostgresStore) UpgradePasswordHash(memberID int64, hash string) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("password_hash", hash).Error
}

func (s *PostgresStore) CreateSession(memberID int64, token string) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Create(&postgresSessionModel{Token: token, MemberID: memberID, CreatedAt: time.Now().UTC()}).Error
}

func (s *PostgresStore) UpdateMemberWallet(memberID int64, wallet string) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("wallet_address", wallet).Error
}

func (s *PostgresStore) SetSubscriptionExpiry(memberID int64, expiresAt time.Time) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("subscription_expires_at", expiresAt.UTC()).Error
}

func (s *PostgresStore) AddClaimableTickets(memberID, proposalTickets int64) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("claimable_proposal_tickets", gorm.Expr("claimable_proposal_tickets + ?", proposalTickets)).Error
}

func (s *PostgresStore) ClaimTickets(memberID int64) (proposalTickets int64, voteTickets int64, createOrderTickets int64, err error) {
	ctx := context.Background()
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var member postgresMemberModel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&member, "id = ?", memberID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("member not found")
			}
			return err
		}
		proposalTickets = member.ClaimableProposalTickets
		voteTickets = member.ClaimableVoteTickets
		createOrderTickets = member.ClaimableCreateOrderTickets
		// Backfill same-day login rewards created before vote tickets were granted.
		// If a member still has claimable proposal tickets but no matching claimable
		// create-order tickets, treat the missing side as the same amount so the
		// daily pair stays consistent.
		if proposalTickets > 0 && voteTickets == 0 {
			voteTickets = proposalTickets
		}
		if proposalTickets > 0 && createOrderTickets == 0 {
			createOrderTickets = proposalTickets
		}
		if proposalTickets == 0 && voteTickets == 0 && createOrderTickets == 0 {
			return errors.New("no claimable tickets")
		}
		return tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Updates(map[string]any{
			"proposal_ticket_count":         gorm.Expr("proposal_ticket_count + ?", proposalTickets),
			"vote_ticket_count":             gorm.Expr("vote_ticket_count + ?", voteTickets),
			"create_order_ticket_count":     gorm.Expr("create_order_ticket_count + ?", createOrderTickets),
			"claimable_proposal_tickets":    0,
			"claimable_vote_tickets":        0,
			"claimable_create_order_tickets": 0,
		}).Error
	})
	return proposalTickets, voteTickets, createOrderTickets, err
}

func (s *PostgresStore) GrantDailyLoginProposalTicket(memberID int64, now time.Time) (bool, error) {
	ctx := context.Background()
	granted := false
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var member postgresMemberModel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&member, "id = ?", memberID).Error; err != nil {
			return err
		}
		location := repositoryBusinessLocation()
		today := now.In(location).Format("2006-01-02")
		if member.LastDailyLoginRewardAt != nil && member.LastDailyLoginRewardAt.In(location).Format("2006-01-02") == today {
			return nil
		}
		if err := tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Updates(map[string]any{
			"claimable_proposal_tickets": gorm.Expr("claimable_proposal_tickets + 1"),
			"claimable_vote_tickets":     gorm.Expr("claimable_vote_tickets + 1"),
			"claimable_create_order_tickets": gorm.Expr("claimable_create_order_tickets + 1"),
			"last_daily_login_reward_at": now.UTC(),
		}).Error; err != nil {
			return err
		}
		granted = true
		return nil
	})
	return granted, err
}

func (s *PostgresStore) SaveWalletAuthChallenge(walletAddress, nonce, message string, expiresAt time.Time) error {
	ctx := context.Background()
	now := time.Now().UTC()
	challenge := postgresWalletAuthChallengeModel{WalletAddress: walletAddress, Nonce: nonce, Message: message, ExpiresAt: expiresAt.UTC(), CreatedAt: now}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "wallet_address"}},
		DoUpdates: clause.Assignments(map[string]any{"nonce": nonce, "message": message, "expires_at": expiresAt.UTC(), "created_at": now}),
	}).Create(&challenge).Error
}

func (s *PostgresStore) WalletAuthChallengeByWallet(walletAddress string) (*models.WalletAuthChallenge, error) {
	ctx := context.Background()
	var challenge postgresWalletAuthChallengeModel
	if err := s.db.WithContext(ctx).Where("LOWER(wallet_address) = LOWER(?)", walletAddress).First(&challenge).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("wallet auth challenge not found")
		}
		return nil, err
	}
	return &models.WalletAuthChallenge{WalletAddress: challenge.WalletAddress, Nonce: challenge.Nonce, Message: challenge.Message, ExpiresAt: challenge.ExpiresAt}, nil
}

func (s *PostgresStore) DeleteWalletAuthChallenge(walletAddress string) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Where("LOWER(wallet_address) = LOWER(?)", walletAddress).Delete(&postgresWalletAuthChallengeModel{}).Error
}

func (s *PostgresStore) RawLeaderboard() ([]*models.LeaderboardEntry, error) {
	ctx := context.Background()
	var rows []postgresMemberModel
	if err := s.db.WithContext(ctx).Order("points DESC, id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.LeaderboardEntry, 0, len(rows))
	for _, row := range rows {
		items = append(items, &models.LeaderboardEntry{MemberID: row.ID, DisplayName: row.DisplayName, AvatarURL: row.AvatarURL, Points: row.Points, TokenBalance: row.TokenBalance})
	}
	return items, nil
}

func (s *PostgresStore) MemberStats(memberID int64) (proposalsCreated, ordersSubmitted, votesCast int64, err error) {
	ctx := context.Background()
	if err := s.db.WithContext(ctx).Model(&postgresProposalModel{}).Where("created_by = ?", memberID).Count(&proposalsCreated).Error; err != nil {
		return 0, 0, 0, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresOrderModel{}).Where("member_id = ?", memberID).Count(&ordersSubmitted).Error; err != nil {
		return 0, 0, 0, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresVoteModel{}).Where("member_id = ?", memberID).Count(&votesCast).Error; err != nil {
		return 0, 0, 0, err
	}
	return proposalsCreated, ordersSubmitted, votesCast, nil
}

func (s *PostgresStore) CreateProposal(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	ctx := context.Background()
	now := time.Now().UTC()
	if maxOptions <= 0 {
		maxOptions = 5
	}
	if mealPeriod == "" {
		mealPeriod = "lunch"
	}
	proposal := &postgresProposalModel{Title: title, Description: description, MerchantGroup: merchantGroup, MealPeriod: mealPeriod, ProposalDate: proposalDate, MaxOptions: maxOptions, CreatedBy: memberID, CreatedByName: createdByName, ProposalDeadline: proposalDeadline.UTC(), VoteDeadline: voteDeadline.UTC(), OrderDeadline: orderDeadline.UTC(), WinnerOptionID: 0, RewardsApplied: false, CreatedAt: now}
	if err := s.db.WithContext(ctx).Create(proposal).Error; err != nil {
		if isDuplicateKeyError(err) {
			return nil, ErrDuplicateProposalRound
		}
		return nil, err
	}
	return s.GetProposal(proposal.ID)
}

func (s *PostgresStore) CreateProposalWithCredit(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time, useTicket bool) (*models.Proposal, error) {
	ctx := context.Background()
	var proposal postgresProposalModel
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		actualAssetType := "token"
		actualAmount := fmt.Sprintf("%d", proposalTokenCost)
		actualNote := "建立訂單輪次"
		var member postgresMemberModel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&member, "id = ?", memberID).Error; err != nil {
			return err
		}
		usedCreateOrderTicket := false
		if useTicket && member.CreateOrderTicketCount > 0 {
			if err := tx.Model(&postgresMemberModel{}).Where("id = ? AND create_order_ticket_count > 0", memberID).Update("create_order_ticket_count", gorm.Expr("create_order_ticket_count - 1")).Error; err != nil {
				return err
			}
			actualAssetType = "create_order_ticket"
			actualAmount = "1"
			actualNote = "建立訂單輪次（建立訂單券抵用）"
			usedCreateOrderTicket = true
		} else {
			res := tx.Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, proposalTokenCost).Update("token_balance", gorm.Expr("token_balance - ?", proposalTokenCost))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return errors.New("insufficient token balance")
			}
		}
		if maxOptions <= 0 {
			maxOptions = 5
		}
		if mealPeriod == "" {
			mealPeriod = "lunch"
		}
		proposal = postgresProposalModel{Title: title, Description: description, MerchantGroup: merchantGroup, MealPeriod: mealPeriod, ProposalDate: proposalDate, MaxOptions: maxOptions, CreatedBy: memberID, CreatedByName: createdByName, UsedCreateOrderTicket: usedCreateOrderTicket, ProposalDeadline: proposalDeadline.UTC(), VoteDeadline: voteDeadline.UTC(), OrderDeadline: orderDeadline.UTC(), CreatedAt: time.Now().UTC()}
		if err := tx.Create(&proposal).Error; err != nil {
			if isDuplicateKeyError(err) {
				return ErrDuplicateProposalRound
			}
			return err
		}
		return s.logUsageTxGorm(ctx, tx, memberID, proposal.ID, "create_proposal", actualAssetType, "debit", actualAmount, actualNote, "")
	})
	if err != nil {
		return nil, err
	}
	return s.GetProposal(proposal.ID)
}

func (s *PostgresStore) ListProposals() []*models.Proposal {
	ctx := context.Background()
	var rows []postgresProposalModel
	if err := s.db.WithContext(ctx).Order("id DESC").Find(&rows).Error; err != nil {
		return []*models.Proposal{}
	}
	items := make([]*models.Proposal, 0, len(rows))
	for _, row := range rows {
		proposal, err := s.GetProposal(row.ID)
		if err == nil {
			items = append(items, proposal)
		}
	}
	return items
}

func (s *PostgresStore) GetProposal(id int64) (*models.Proposal, error) {
	ctx := context.Background()
	if err := s.refreshProposalState(ctx, id); err != nil {
		return nil, err
	}
	return s.loadProposal(ctx, id)
}

func (s *PostgresStore) DeleteProposalByCreator(proposalID, memberID int64) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var proposal postgresProposalModel
		if err := tx.Where("id = ?", proposalID).First(&proposal).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("proposal not found")
			}
			return err
		}
		if proposal.CreatedBy != memberID {
			return errors.New("only the creator can delete this proposal")
		}

		var voteCount int64
		if err := tx.Model(&postgresVoteModel{}).Where("proposal_id = ?", proposalID).Count(&voteCount).Error; err != nil {
			return err
		}
		if voteCount > 0 {
			return errors.New("cannot delete after voting has started")
		}

		var orderCount int64
		if err := tx.Model(&postgresOrderModel{}).Where("proposal_id = ?", proposalID).Count(&orderCount).Error; err != nil {
			return err
		}
		if orderCount > 0 {
			return errors.New("cannot delete after ordering has started")
		}

		var options []postgresProposalOptionModel
		if err := tx.Where("proposal_id = ?", proposalID).Find(&options).Error; err != nil {
			return err
		}
		refundTokens := int64(0)
		for _, option := range options {
			if option.ProposerMemberID != memberID {
				return errors.New("cannot delete after another member has proposed")
			}
			refundTokens += option.TokenStake
		}

		var createUsageCount int64
		if err := tx.Model(&postgresUsageRecordModel{}).
			Where("proposal_id = ? AND member_id = ? AND action = ?", proposalID, memberID, "create_proposal").
			Count(&createUsageCount).Error; err != nil {
			return err
		}
		if createUsageCount > 0 {
			refundTokens += proposalTokenCost
		}

		if refundTokens > 0 {
			if err := tx.Model(&postgresMemberModel{}).
				Where("id = ?", memberID).
				Update("token_balance", gorm.Expr("token_balance + ?", refundTokens)).Error; err != nil {
				return err
			}
			if err := s.logUsageTxGorm(ctx, tx, memberID, proposalID, "delete_proposal_refund", "token", "credit", fmt.Sprintf("%d", refundTokens), "刪除單人提案退回 token", ""); err != nil {
				return err
			}
		}

		return s.deleteProposalRoundTxGorm(ctx, tx, proposalID)
	})
}

func (s *PostgresStore) InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64, useTicket bool) (*models.ProposalOption, error) {
	ctx := context.Background()
	var option postgresProposalOptionModel
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		actualTokenCost := tokenCost
		var member postgresMemberModel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&member, "id = ?", memberID).Error; err != nil {
			return err
		}
		usedProposalTicket := false
		if useTicket && member.ProposalTicketCount > 0 {
			if err := tx.Model(&postgresMemberModel{}).Where("id = ? AND proposal_ticket_count > 0", memberID).Update("proposal_ticket_count", gorm.Expr("proposal_ticket_count - 1")).Error; err != nil {
				return err
			}
			actualTokenCost = 0
			usedProposalTicket = true
		} else {
			res := tx.Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, tokenCost).Update("token_balance", gorm.Expr("token_balance - ?", tokenCost))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return errors.New("insufficient token balance")
			}
		}
		option = postgresProposalOptionModel{ProposalID: proposalID, MerchantID: merchantID, MerchantName: merchantName, ProposerMemberID: memberID, ProposerName: proposerName, UsedProposalTicket: usedProposalTicket, WeightedVotes: 0, TokenStake: actualTokenCost, CreatedAt: time.Now().UTC()}
		if err := tx.Create(&option).Error; err != nil {
			if isDuplicateKeyError(err) {
				return ErrDuplicateOption
			}
			return err
		}
		assetType := "token"
		amount := fmt.Sprintf("%d", tokenCost)
		note := "提名候選店家"
		if actualTokenCost == 0 {
			assetType = "proposal_ticket"
			amount = "1"
			note = "提名候選店家（提案券抵用）"
		}
		return s.logUsageTxGorm(ctx, tx, memberID, proposalID, "add_option", assetType, "debit", amount, note, fmt.Sprintf("option:%d", option.ID))
	})
	if err != nil {
		return nil, err
	}
	proposal, err := s.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	for _, item := range proposal.Options {
		if item.ID == option.ID {
			return item, nil
		}
	}
	return nil, errors.New("created option not found")
}

func (s *PostgresStore) RecordVote(proposalID, memberID, optionID int64, tokenAmount int64, memberDisplayName string, useTicket bool) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing postgresVoteModel
		hasExisting := tx.Where("proposal_id = ? AND member_id = ?", proposalID, memberID).First(&existing).Error == nil
		if hasExisting {
			if existing.UseVoteTicket {
				if err := tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("vote_ticket_count", gorm.Expr("vote_ticket_count + 1")).Error; err != nil {
					return err
				}
			} else if existing.TokenAmount > 0 {
				if err := tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("token_balance", gorm.Expr("token_balance + ?", existing.TokenAmount)).Error; err != nil {
					return err
				}
			}
			if err := tx.Model(&postgresProposalOptionModel{}).Where("id = ?", existing.OptionID).Update("weighted_votes", gorm.Expr("weighted_votes - ?", existing.VoteWeight)).Error; err != nil {
				return err
			}
		}

		if useTicket {
			res := tx.Model(&postgresMemberModel{}).Where("id = ? AND vote_ticket_count > 0", memberID).Update("vote_ticket_count", gorm.Expr("vote_ticket_count - 1"))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return errors.New("目前沒有可用的投票券")
			}
			tokenAmount = 1
		} else {
			res := tx.Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, tokenAmount).Update("token_balance", gorm.Expr("token_balance - ?", tokenAmount))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return errors.New("insufficient token balance")
			}
		}
		if err := tx.Model(&postgresProposalOptionModel{}).Where("id = ?", optionID).Update("weighted_votes", gorm.Expr("weighted_votes + ?", tokenAmount)).Error; err != nil {
			return err
		}
		if hasExisting {
			if err := tx.Model(&postgresVoteModel{}).Where("id = ?", existing.ID).Updates(map[string]any{
				"option_id":       optionID,
				"token_amount":    tokenAmount,
				"vote_weight":     tokenAmount,
				"use_vote_ticket": useTicket,
				"submitted_at":    time.Now().UTC(),
			}).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Create(&postgresVoteModel{ProposalID: proposalID, MemberID: memberID, MemberName: memberDisplayName, OptionID: optionID, TokenAmount: tokenAmount, VoteWeight: tokenAmount, UseVoteTicket: useTicket, SubmittedAt: time.Now().UTC(), WalletHidden: true}).Error; err != nil {
				if isDuplicateKeyError(err) {
					return ErrDuplicateVote
				}
				return err
			}
		}
		assetType := "token"
		note := "投票加權"
		if useTicket {
			assetType = "vote_ticket"
			note = "投票（投票券抵用）"
		}
		return s.logUsageTxGorm(ctx, tx, memberID, proposalID, "vote", assetType, "debit", fmt.Sprintf("%d", tokenAmount), note, fmt.Sprintf("option:%d", optionID))
	})
}

func (s *PostgresStore) ApplySettlementRewards(proposalID int64, rewards []MemberReward, optionRefunds []OptionRefund) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, reward := range rewards {
			if err := tx.Model(&postgresMemberModel{}).Where("id = ?", reward.MemberID).Updates(map[string]any{"points": gorm.Expr("points + ?", reward.Points), "token_balance": gorm.Expr("token_balance + ?", reward.Tokens)}).Error; err != nil {
				return err
			}
			if reward.Tokens > 0 {
				if err := s.logUsageTxGorm(ctx, tx, reward.MemberID, proposalID, "settlement_reward", "token", "credit", fmt.Sprintf("%d", reward.Tokens), "提案結算獎勵", ""); err != nil {
					return err
				}
			}
		}
		for _, refund := range optionRefunds {
			if err := tx.Model(&postgresProposalOptionModel{}).Where("id = ?", refund.OptionID).Updates(map[string]any{"partial_refund": refund.PartialRefund, "winner_token_back": refund.WinnerTokenBack}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&postgresProposalModel{}).Where("id = ?", proposalID).Update("rewards_applied", true).Error
	})
}

func (s *PostgresStore) SaveOrder(proposalID, memberID int64, quote *models.OrderQuote, sig *models.OrderSignature, memberDisplayName string) (*models.Order, error) {
	ctx := context.Background()
	var order postgresOrderModel
	var items []*models.OrderItem
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if sig == nil {
			sig = &models.OrderSignature{}
		}
		if sig.OrderHash == "" {
			sig.OrderHash = fmt.Sprintf("local-order-%d-%d", proposalID, time.Now().UTC().UnixNano())
		}
		if sig.AmountWei == "" {
			sig.AmountWei = quote.SubtotalWei
		}
		status := "payment_received"
		order = postgresOrderModel{
			ProposalID:         proposalID,
			MemberID:           memberID,
			MemberName:         memberDisplayName,
			MerchantID:         quote.MerchantID,
			OrderHash:          sig.OrderHash,
			AmountWei:          sig.AmountWei,
			Status:             status,
			SignatureAmountWei: sig.AmountWei,
			SignatureExpiry:    sig.Expiry,
			SignatureValue:     sig.Signature,
			SignatureDigest:    sig.Digest,
			SignerAddress:      sig.SignerAddress,
			ContractAddress:    sig.ContractAddress,
			TokenAddress:       sig.TokenAddress,
			CreatedAt:          time.Now().UTC(),
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		items = make([]*models.OrderItem, 0, len(quote.Items))
		for _, item := range quote.Items {
			row := postgresOrderItemModel{
				OrderID:    order.ID,
				MenuItemID: item.MenuItemID,
				Name:       item.Name,
				Quantity:   item.Quantity,
				PriceWei:   item.PriceWei,
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			items = append(items, &models.OrderItem{
				MenuItemID: item.MenuItemID,
				Name:       item.Name,
				Quantity:   item.Quantity,
				PriceWei:   item.PriceWei,
			})
		}
		return s.logUsageTxGorm(ctx, tx, memberID, proposalID, "place_order", "native", "debit", sig.AmountWei, "點餐支付已入平台錢包", sig.OrderHash)
	})
	if err != nil {
		return nil, err
	}
	result := &models.Order{
		ID:                    order.ID,
		ProposalID:            order.ProposalID,
		Title:                 s.proposalTitleByID(ctx, order.ProposalID),
		MemberID:              order.MemberID,
		MemberName:            order.MemberName,
		MerchantID:            order.MerchantID,
		MerchantName:          quote.MerchantName,
		MerchantPayoutAddress: "",
		OrderHash:             order.OrderHash,
		AmountWei:             order.AmountWei,
		Status:                order.Status,
		Items:                 items,
		CreatedAt:             order.CreatedAt.UTC(),
		AcceptedAt:            toUTCPointer(order.AcceptedAt),
		CompletedAt:           toUTCPointer(order.CompletedAt),
		ConfirmedAt:           toUTCPointer(order.ConfirmedAt),
		PaidOutAt:             toUTCPointer(order.PaidOutAt),
		Signature: &models.OrderSignature{
			AmountWei:       order.SignatureAmountWei,
			Expiry:          order.SignatureExpiry,
			OrderHash:       order.OrderHash,
			Signature:       order.SignatureValue,
			Digest:          order.SignatureDigest,
			SignerAddress:   order.SignerAddress,
			ContractAddress: order.ContractAddress,
			TokenAddress:    order.TokenAddress,
		},
	}
	return result, nil
}

func (s *PostgresStore) ListMemberOrders(memberID int64) ([]*models.Order, error) {
	ctx := context.Background()
	var rows []postgresOrderModel
	if err := s.db.WithContext(ctx).Where("member_id = ?", memberID).Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	orders := make([]*models.Order, 0, len(rows))
	for _, row := range rows {
		title := s.proposalTitleByID(ctx, row.ProposalID)
		var merchant postgresMerchantModel
		merchantName := ""
		merchantPayoutAddress := ""
		if err := s.db.WithContext(ctx).Where("id = ?", row.MerchantID).First(&merchant).Error; err == nil {
			merchantName = merchant.Name
			merchantPayoutAddress = merchant.PayoutAddress
		}
		var orderItems []postgresOrderItemModel
		if err := s.db.WithContext(ctx).Where("order_id = ?", row.ID).Order("id ASC").Find(&orderItems).Error; err != nil {
			return nil, err
		}
		items := make([]*models.OrderItem, 0, len(orderItems))
		for _, item := range orderItems {
			items = append(items, &models.OrderItem{
				MenuItemID: item.MenuItemID,
				Name:       item.Name,
				Quantity:   item.Quantity,
				PriceWei:   item.PriceWei,
			})
		}
		acceptedAt, completedAt, confirmedAt, paidOutAt := normalizedOrderTimestamps(row)
		orders = append(orders, &models.Order{
			ID:                    row.ID,
			ProposalID:            row.ProposalID,
			Title:                 title,
			MemberID:              row.MemberID,
			MemberName:            row.MemberName,
			MerchantID:            row.MerchantID,
			MerchantName:          merchantName,
			MerchantPayoutAddress: merchantPayoutAddress,
			OrderHash:             row.OrderHash,
			AmountWei:             row.AmountWei,
			Status:                normalizeOrderStatus(row.Status),
			Items:                 items,
			CreatedAt:             row.CreatedAt.UTC(),
			AcceptedAt:            acceptedAt,
			CompletedAt:           completedAt,
			ConfirmedAt:           confirmedAt,
			PaidOutAt:             paidOutAt,
		})
	}
	return orders, nil
}

func (s *PostgresStore) MemberReviewCount(memberID int64) (int64, error) {
	ctx := context.Background()
	var count int64
	if err := s.db.WithContext(ctx).Model(&postgresMerchantReviewModel{}).Where("member_id = ?", memberID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (s *PostgresStore) UpdateOrderStatus(orderID int64, merchantID, status string) (*models.Order, error) {
	ctx := context.Background()
	nextStatus := strings.TrimSpace(status)
	var row postgresOrderModel
	if err := s.db.WithContext(ctx).First(&row, "id = ? AND merchant_id = ?", orderID, strings.TrimSpace(merchantID)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order not found")
		}
		return nil, err
	}
	if !isValidMerchantOrderTransition(row.Status, nextStatus) {
		return nil, fmt.Errorf("cannot change order from %s to %s", row.Status, nextStatus)
	}
	updates := map[string]any{"status": nextStatus}
	now := time.Now().UTC()
	if nextStatus == "merchant_accepted" {
		updates["accepted_at"] = now
	}
	if nextStatus == "merchant_completed" {
		updates["completed_at"] = now
	}
	if err := s.db.WithContext(ctx).Model(&postgresOrderModel{}).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.findMerchantOrderByID(strings.TrimSpace(merchantID), orderID)
}

func (s *PostgresStore) UpdateMemberOrderStatus(orderID, memberID int64, status string) (*models.Order, error) {
	ctx := context.Background()
	nextStatus := strings.TrimSpace(status)
	var row postgresOrderModel
	if err := s.db.WithContext(ctx).First(&row, "id = ? AND member_id = ?", orderID, memberID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order not found")
		}
		return nil, err
	}
	if !isValidMemberOrderTransition(row.Status, nextStatus) {
		return nil, fmt.Errorf("cannot change order from %s to %s", row.Status, nextStatus)
	}
	updates := map[string]any{"status": nextStatus}
	if nextStatus == "ready_for_payout" {
		updates["confirmed_at"] = time.Now().UTC()
	}
	if err := s.db.WithContext(ctx).Model(&postgresOrderModel{}).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.findMerchantOrderByID(strings.TrimSpace(row.MerchantID), orderID)
}

func (s *PostgresStore) UpdateAdminOrderStatus(orderID int64, status string) (*models.Order, error) {
	ctx := context.Background()
	nextStatus := strings.TrimSpace(status)
	var row postgresOrderModel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", orderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("order not found")
		}
		return nil, err
	}
	if !isValidAdminOrderTransition(row.Status, nextStatus) {
		return nil, fmt.Errorf("cannot change order from %s to %s", row.Status, nextStatus)
	}
	updates := map[string]any{"status": nextStatus}
	if nextStatus == "platform_paid" {
		updates["paid_out_at"] = time.Now().UTC()
	}
	if err := s.db.WithContext(ctx).Model(&postgresOrderModel{}).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.findMerchantOrderByID(strings.TrimSpace(row.MerchantID), orderID)
}

func (s *PostgresStore) findMerchantOrderByID(merchantID string, orderID int64) (*models.Order, error) {
	orders, err := s.ListMerchantOrders(strings.TrimSpace(merchantID))
	if err != nil {
		return nil, err
	}
	for _, order := range orders {
		if order.ID == orderID {
			return order, nil
		}
	}
	return nil, errors.New("order not found")
}

func isValidMerchantOrderTransition(currentStatus, nextStatus string) bool {
	current := normalizeOrderStatus(strings.TrimSpace(currentStatus))
	next := strings.TrimSpace(nextStatus)
	switch next {
	case "merchant_accepted":
		return current == "payment_received"
	case "merchant_completed":
		return current == "merchant_accepted"
	default:
		return false
	}
}

func isValidMemberOrderTransition(currentStatus, nextStatus string) bool {
	current := normalizeOrderStatus(strings.TrimSpace(currentStatus))
	next := strings.TrimSpace(nextStatus)
	return current == "merchant_completed" && next == "ready_for_payout"
}

func isValidAdminOrderTransition(currentStatus, nextStatus string) bool {
	current := normalizeOrderStatus(strings.TrimSpace(currentStatus))
	next := strings.TrimSpace(nextStatus)
	return current == "ready_for_payout" && next == "platform_paid"
}

func normalizeOrderStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "paid_local", "paid_onchain":
		return "payment_received"
	case "merchant_confirmed":
		return "ready_for_payout"
	default:
		return strings.TrimSpace(status)
	}
}

func normalizedOrderTimestamps(row postgresOrderModel) (*time.Time, *time.Time, *time.Time, *time.Time) {
	status := normalizeOrderStatus(row.Status)
	createdAt := row.CreatedAt.UTC()
	acceptedAt := toUTCPointer(row.AcceptedAt)
	completedAt := toUTCPointer(row.CompletedAt)
	confirmedAt := toUTCPointer(row.ConfirmedAt)
	paidOutAt := toUTCPointer(row.PaidOutAt)

	if acceptedAt == nil && (status == "merchant_accepted" || status == "merchant_completed" || status == "ready_for_payout" || status == "platform_paid") {
		acceptedAt = &createdAt
	}
	if completedAt == nil && (status == "merchant_completed" || status == "ready_for_payout" || status == "platform_paid") {
		if acceptedAt != nil {
			completedAt = acceptedAt
		} else {
			completedAt = &createdAt
		}
	}
	if confirmedAt == nil && (status == "ready_for_payout" || status == "platform_paid") {
		switch {
		case completedAt != nil:
			confirmedAt = completedAt
		case acceptedAt != nil:
			confirmedAt = acceptedAt
		default:
			confirmedAt = &createdAt
		}
	}
	if paidOutAt == nil && status == "platform_paid" {
		switch {
		case confirmedAt != nil:
			paidOutAt = confirmedAt
		case completedAt != nil:
			paidOutAt = completedAt
		case acceptedAt != nil:
			paidOutAt = acceptedAt
		default:
			paidOutAt = &createdAt
		}
	}

	return acceptedAt, completedAt, confirmedAt, paidOutAt
}

func (s *PostgresStore) backfillLegacyOrders() error {
	ctx := context.Background()
	var rows []postgresOrderModel
	if err := s.db.WithContext(ctx).Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		normalizedStatus := normalizeOrderStatus(row.Status)
		acceptedAt, completedAt, confirmedAt, paidOutAt := normalizedOrderTimestamps(row)
		updates := map[string]any{}
		if normalizedStatus != row.Status {
			updates["status"] = normalizedStatus
		}
		if row.AcceptedAt == nil && acceptedAt != nil {
			updates["accepted_at"] = acceptedAt.UTC()
		}
		if row.CompletedAt == nil && completedAt != nil {
			updates["completed_at"] = completedAt.UTC()
		}
		if row.ConfirmedAt == nil && confirmedAt != nil {
			updates["confirmed_at"] = confirmedAt.UTC()
		}
		if row.PaidOutAt == nil && paidOutAt != nil {
			updates["paid_out_at"] = paidOutAt.UTC()
		}
		if len(updates) == 0 {
			continue
		}
		if err := s.db.WithContext(ctx).Model(&postgresOrderModel{}).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
			return err
		}
	}
	return nil
}

func toUTCPointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copy := value.UTC()
	return &copy
}

func generateMerchantID(name string) string {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.ReplaceAll(normalized, " ", "-")
	var builder strings.Builder
	for _, r := range normalized {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			builder.WriteRune(r)
		}
	}
	id := strings.Trim(builder.String(), "-")
	if id == "" {
		return fmt.Sprintf("merchant-%d", time.Now().UTC().Unix())
	}
	return "merchant-" + id
}

func ensureUniqueMerchantID(ctx context.Context, db *gorm.DB, base string) string {
	candidate := strings.TrimSpace(base)
	if candidate == "" {
		candidate = fmt.Sprintf("merchant-%d", time.Now().UTC().Unix())
	}
	index := 1
	for {
		var count int64
		if err := db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("id = ?", candidate).Count(&count).Error; err != nil || count == 0 {
			return candidate
		}
		index++
		candidate = fmt.Sprintf("%s-%d", base, index)
	}
}

func (s *PostgresStore) ApplyScheduledMenuChangeRequests(now time.Time) error {
	ctx := context.Background()
	var rows []postgresMenuChangeRequestModel
	if err := s.db.WithContext(ctx).
		Where("status = ? AND effective_at IS NOT NULL AND effective_at <= ?", "approved", now.UTC()).
		Order("effective_at ASC, id ASC").
		Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		row := row
		if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			switch row.Action {
			case "create", "update":
				var existing postgresMenuItemModel
				err := tx.Where("merchant_id = ? AND item_id = ?", row.MerchantID, row.MenuItemID).First(&existing).Error
				if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				if errors.Is(err, gorm.ErrRecordNotFound) {
					menuRow := postgresMenuItemModel{
						MerchantID:  row.MerchantID,
						ItemID:      row.MenuItemID,
						Name:        row.ItemName,
						PriceWei:    row.PriceWei,
						Description: row.Description,
					}
					if err := tx.Create(&menuRow).Error; err != nil {
						return err
					}
				} else {
					if err := tx.Model(&existing).Updates(map[string]any{
						"name":        row.ItemName,
						"price_wei":   row.PriceWei,
						"description": row.Description,
					}).Error; err != nil {
						return err
					}
				}
			case "delete":
				if err := tx.Where("merchant_id = ? AND item_id = ?", row.MerchantID, row.MenuItemID).Delete(&postgresMenuItemModel{}).Error; err != nil {
					return err
				}
			default:
				return fmt.Errorf("unsupported menu change action: %s", row.Action)
			}
			return tx.Model(&postgresMenuChangeRequestModel{}).Where("id = ?", row.ID).Update("status", "applied").Error
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *PostgresStore) GetMerchant(id string) (*models.Merchant, error) {
	_ = s.ApplyScheduledMenuChangeRequests(time.Now().UTC())
	ctx := context.Background()
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("id = ? AND delisted_at IS NULL", id).First(&merchant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	return s.merchantFromModel(ctx, &merchant)
}

func (s *PostgresStore) GetMerchantDetail(id string) (*models.MerchantDetail, error) {
	ctx := context.Background()
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&merchant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	item, err := s.merchantFromModel(ctx, &merchant)
	if err != nil {
		return nil, err
	}
	reviews, err := s.ListMerchantReviews(merchant.ID)
	if err != nil {
		return nil, err
	}
	return &models.MerchantDetail{Merchant: item, Reviews: reviews}, nil
}

func (s *PostgresStore) ListMerchants() ([]*models.Merchant, error) {
	_ = s.ApplyScheduledMenuChangeRequests(time.Now().UTC())
	ctx := context.Background()
	var rows []postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("delisted_at IS NULL").Order("name ASC, id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	merchants := make([]*models.Merchant, 0, len(rows))
	for _, row := range rows {
		ownerID := int64(0)
		ownerName := ""
		if row.OwnerMemberID != nil {
			ownerID = *row.OwnerMemberID
			var owner postgresMemberModel
			if err := s.db.WithContext(ctx).Select("display_name").First(&owner, "id = ?", *row.OwnerMemberID).Error; err == nil {
				ownerName = owner.DisplayName
			}
		}
		merchants = append(merchants, &models.Merchant{
			ID:                row.ID,
			Name:              row.Name,
			Group:             row.MerchantGroup,
			Address:           row.Address,
			Description:       row.Description,
			PayoutAddress:     row.PayoutAddress,
			DelistRequestedAt: derefTime(row.DelistRequestedAt),
			DelistedAt:        derefTime(row.DelistedAt),
			OwnerMemberID:     ownerID,
			OwnerDisplayName:  ownerName,
			Menu:              []*models.MenuItem{},
		})
	}
	for _, merchant := range merchants {
		avg, count, err := s.merchantReviewSummary(ctx, merchant.ID)
		if err == nil {
			merchant.AverageRating = avg
			merchant.ReviewCount = count
		}
	}
	return merchants, nil
}

func (s *PostgresStore) ListMerchantReviews(merchantID string) ([]*models.MerchantReview, error) {
	ctx := context.Background()
	var rows []postgresMerchantReviewModel
	if err := s.db.WithContext(ctx).Where("merchant_id = ?", strings.TrimSpace(merchantID)).Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.MerchantReview, 0, len(rows))
	for _, row := range rows {
		items = append(items, &models.MerchantReview{
			ID:         row.ID,
			MerchantID: row.MerchantID,
			MemberID:   row.MemberID,
			MemberName: row.MemberName,
			Rating:     row.Rating,
			Comment:    row.Comment,
			CreatedAt:  row.CreatedAt.UTC(),
		})
	}
	return items, nil
}

func (s *PostgresStore) CreateMerchantReview(review *models.MerchantReview) (*models.MerchantReview, error) {
	ctx := context.Background()
	if review == nil {
		return nil, errors.New("review is required")
	}
	row := postgresMerchantReviewModel{
		MerchantID: strings.TrimSpace(review.MerchantID),
		MemberID:   review.MemberID,
		MemberName: strings.TrimSpace(review.MemberName),
		Rating:     review.Rating,
		Comment:    strings.TrimSpace(review.Comment),
		CreatedAt:  time.Now().UTC(),
	}
	if row.MerchantID == "" || row.MemberID <= 0 || row.MemberName == "" || row.Comment == "" {
		return nil, errors.New("merchant, member, and comment are required")
	}
	if row.Rating < 1 || row.Rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &models.MerchantReview{
		ID:         row.ID,
		MerchantID: row.MerchantID,
		MemberID:   row.MemberID,
		MemberName: row.MemberName,
		Rating:     row.Rating,
		Comment:    row.Comment,
		CreatedAt:  row.CreatedAt.UTC(),
	}, nil
}

func (s *PostgresStore) GetMerchantByOwner(memberID int64, wallet string) (*models.Merchant, error) {
	ctx := context.Background()
	var row postgresMerchantModel
	query := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("delisted_at IS NULL AND delist_requested_at IS NULL")
	if memberID > 0 {
		query = query.Where("owner_member_id = ?", memberID)
	}
	if strings.TrimSpace(wallet) != "" {
		query = query.Or("LOWER(payout_address) = LOWER(?)", strings.TrimSpace(wallet))
	}
	if err := query.First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	return s.merchantFromModel(ctx, &row)
}

func (s *PostgresStore) ClaimMerchant(merchantID string, memberID int64, displayName, wallet string) (*models.Merchant, error) {
	ctx := context.Background()
	merchantID = strings.TrimSpace(merchantID)
	wallet = strings.TrimSpace(wallet)
	if merchantID == "" || memberID <= 0 || wallet == "" {
		return nil, errors.New("merchant id, member id, and wallet are required")
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var merchant postgresMerchantModel
		if err := tx.First(&merchant, "id = ?", merchantID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("merchant not found")
			}
			return err
		}
		if merchant.OwnerMemberID != nil && *merchant.OwnerMemberID != memberID {
			return errors.New("merchant has already been claimed by another account")
		}
		return tx.Model(&postgresMerchantModel{}).
			Where("id = ?", merchantID).
			Updates(map[string]any{
				"owner_member_id": memberID,
				"payout_address":  wallet,
			}).Error
	}); err != nil {
		return nil, err
	}
	_ = displayName
	return s.GetMerchant(merchantID)
}

func (s *PostgresStore) UpsertOwnedMerchantProfile(memberID int64, displayName, wallet string, merchant *models.Merchant) (*models.Merchant, error) {
	ctx := context.Background()
	if merchant == nil {
		return nil, errors.New("merchant is required")
	}
	if memberID <= 0 {
		return nil, errors.New("member id is required")
	}
	name := strings.TrimSpace(merchant.Name)
	address := strings.TrimSpace(merchant.Address)
	description := strings.TrimSpace(merchant.Description)
	group := strings.TrimSpace(merchant.Group)
	if name == "" || address == "" {
		return nil, errors.New("merchant name and address are required")
	}
	if group == "" {
		group = "all"
	}
	wallet = strings.TrimSpace(wallet)
	if wallet == "" {
		return nil, errors.New("connect wallet first")
	}
	var existing postgresMerchantModel
	err := s.db.WithContext(ctx).Where("owner_member_id = ? AND delisted_at IS NULL AND delist_requested_at IS NULL", memberID).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	id := strings.TrimSpace(merchant.ID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if id == "" {
			id = generateMerchantID(name)
		}
		row := postgresMerchantModel{
			ID:            ensureUniqueMerchantID(ctx, s.db, id),
			Name:          name,
			MerchantGroup: group,
			Address:       address,
			Description:   description,
			PayoutAddress: wallet,
			OwnerMemberID: &memberID,
		}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		_ = displayName
		return s.GetMerchant(row.ID)
	}
	updates := map[string]any{
		"name":            name,
		"merchant_group":  group,
		"address":         address,
		"description":     description,
		"payout_address":  wallet,
		"owner_member_id": memberID,
	}
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = displayName
	return s.GetMerchant(existing.ID)
}

func (s *PostgresStore) UpdateOwnedMerchantWallet(memberID int64, wallet string) (*models.Merchant, error) {
	ctx := context.Background()
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("owner_member_id = ?", memberID).First(&merchant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("id = ?", merchant.ID).Update("payout_address", strings.TrimSpace(wallet)).Error; err != nil {
		return nil, err
	}
	return s.GetMerchantByOwner(memberID, "")
}

func (s *PostgresStore) UnlinkOwnedMerchant(memberID int64) error {
	ctx := context.Background()
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("owner_member_id = ? AND delisted_at IS NULL", memberID).Order("id DESC").First(&merchant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("merchant not found")
		}
		return err
	}
	now := time.Now().UTC()
	return s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("id = ?", merchant.ID).Updates(map[string]any{
		"payout_address":      "",
		"delist_requested_at": now,
	}).Error
}

func (s *PostgresStore) RequestMerchantDelist(memberID int64) (*models.Merchant, error) {
	ctx := context.Background()
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("owner_member_id = ?", memberID).First(&merchant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	now := time.Now().UTC()
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("id = ?", merchant.ID).Updates(map[string]any{
		"delist_requested_at": now,
	}).Error; err != nil {
		return nil, err
	}
	return s.GetMerchantByOwner(memberID, "")
}

func (s *PostgresStore) CancelMerchantDelist(memberID int64) (*models.Merchant, error) {
	ctx := context.Background()
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("owner_member_id = ?", memberID).First(&merchant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	if merchant.DelistedAt != nil {
		return nil, errors.New("merchant already delisted")
	}
	if merchant.DelistRequestedAt == nil {
		return nil, errors.New("no pending delist request")
	}
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("id = ?", merchant.ID).Updates(map[string]any{
		"delist_requested_at": nil,
	}).Error; err != nil {
		return nil, err
	}
	return s.GetMerchantByOwner(memberID, "")
}

func (s *PostgresStore) ListMerchantDelistRequests(pendingOnly bool) ([]*models.MerchantDelistRequest, error) {
	ctx := context.Background()
	type row struct {
		ID                string
		Name              string
		OwnerMemberID     *int64
		PayoutAddress     string
		DelistRequestedAt *time.Time
		DelistedAt        *time.Time
		OwnerDisplayName  string
	}
	query := s.db.WithContext(ctx).
		Table("merchants AS m").
		Select("m.id, m.name, m.owner_member_id, m.payout_address, m.delist_requested_at, m.delisted_at, COALESCE(mem.display_name, '') AS owner_display_name").
		Joins("LEFT JOIN members AS mem ON mem.id = m.owner_member_id")
	if pendingOnly {
		query = query.Where("m.delist_requested_at IS NOT NULL AND m.delisted_at IS NULL")
	} else {
		query = query.Where("m.delist_requested_at IS NOT NULL OR m.delisted_at IS NOT NULL")
	}
	var rows []row
	if err := query.Order("m.delist_requested_at ASC NULLS LAST, m.id ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.MerchantDelistRequest, 0, len(rows))
	for _, row := range rows {
		item := &models.MerchantDelistRequest{
			MerchantID:        row.ID,
			MerchantName:      row.Name,
			PayoutAddress:     row.PayoutAddress,
			OwnerDisplayName:  row.OwnerDisplayName,
			CurrentlyDelisted: row.DelistedAt != nil,
		}
		if row.OwnerMemberID != nil {
			item.OwnerMemberID = *row.OwnerMemberID
		}
		if row.DelistRequestedAt != nil {
			item.RequestedAt = row.DelistRequestedAt.UTC()
		}
		if row.DelistedAt != nil {
			item.ReviewedAt = row.DelistedAt.UTC()
			item.Decision = "approve"
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *PostgresStore) ReviewMerchantDelist(merchantID string, approve bool) (*models.Merchant, error) {
	ctx := context.Background()
	merchantID = strings.TrimSpace(merchantID)
	if merchantID == "" {
		return nil, errors.New("merchant id is required")
	}
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("id = ?", merchantID).First(&merchant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	updates := map[string]any{"delist_requested_at": nil}
	if approve {
		now := time.Now().UTC()
		updates["delisted_at"] = now
	} else {
		updates["delisted_at"] = nil
	}
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("id = ?", merchantID).Updates(updates).Error; err != nil {
		return nil, err
	}
	var updated postgresMerchantModel
	if err := s.db.WithContext(ctx).Where("id = ?", merchantID).First(&updated).Error; err != nil {
		return nil, err
	}
	return s.merchantFromModel(ctx, &updated)
}

func (s *PostgresStore) merchantFromModel(ctx context.Context, merchant *postgresMerchantModel) (*models.Merchant, error) {
	var menuRows []postgresMenuItemModel
	if err := s.db.WithContext(ctx).Where("merchant_id = ?", merchant.ID).Order("id ASC").Find(&menuRows).Error; err != nil {
		return nil, err
	}
	result := &models.Merchant{
		ID:                merchant.ID,
		Name:              merchant.Name,
		Group:             merchant.MerchantGroup,
		Address:           merchant.Address,
		Description:       merchant.Description,
		PayoutAddress:     merchant.PayoutAddress,
		DelistRequestedAt: derefTime(merchant.DelistRequestedAt),
		DelistedAt:        derefTime(merchant.DelistedAt),
	}
	if merchant.OwnerMemberID != nil {
		result.OwnerMemberID = *merchant.OwnerMemberID
		var owner postgresMemberModel
		if err := s.db.WithContext(ctx).Select("display_name").First(&owner, "id = ?", *merchant.OwnerMemberID).Error; err == nil {
			result.OwnerDisplayName = owner.DisplayName
		}
	}
	for _, item := range menuRows {
		result.Menu = append(result.Menu, &models.MenuItem{ID: item.ItemID, Name: item.Name, PriceWei: item.PriceWei, Description: item.Description})
	}
	avg, count, err := s.merchantReviewSummary(ctx, merchant.ID)
	if err == nil {
		result.AverageRating = avg
		result.ReviewCount = count
	}
	return result, nil
}

func (s *PostgresStore) merchantReviewSummary(ctx context.Context, merchantID string) (float64, int64, error) {
	type summary struct {
		Average float64
		Count   int64
	}
	var row summary
	if err := s.db.WithContext(ctx).
		Model(&postgresMerchantReviewModel{}).
		Select("COALESCE(AVG(rating), 0) AS average, COUNT(*) AS count").
		Where("merchant_id = ?", strings.TrimSpace(merchantID)).
		Scan(&row).Error; err != nil {
		return 0, 0, err
	}
	return row.Average, row.Count, nil
}

func derefTime(value *time.Time) time.Time {
	if value == nil {
		return time.Time{}
	}
	return value.UTC()
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func (s *PostgresStore) UpsertMerchant(merchant *models.Merchant) (*models.Merchant, error) {
	ctx := context.Background()
	if merchant == nil {
		return nil, errors.New("merchant is required")
	}
	id := strings.TrimSpace(merchant.ID)
	name := strings.TrimSpace(merchant.Name)
	group := strings.TrimSpace(merchant.Group)
	payout := strings.TrimSpace(merchant.PayoutAddress)
	if id == "" || name == "" || group == "" || payout == "" {
		return nil, errors.New("merchant id, name, group, and payout address are required")
	}
	row := postgresMerchantModel{
		ID:            id,
		Name:          name,
		MerchantGroup: group,
		Address:       strings.TrimSpace(merchant.Address),
		Description:   strings.TrimSpace(merchant.Description),
		PayoutAddress: payout,
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "merchant_group", "address", "description", "payout_address"}),
	}).Create(&row).Error; err != nil {
		return nil, err
	}
	return s.GetMerchant(id)
}

func (s *PostgresStore) UpsertMenuItem(merchantID string, item *models.MenuItem) error {
	ctx := context.Background()
	merchantID = strings.TrimSpace(merchantID)
	if merchantID == "" || item == nil {
		return errors.New("merchant id and menu item are required")
	}
	itemID := strings.TrimSpace(item.ID)
	name := strings.TrimSpace(item.Name)
	description := strings.TrimSpace(item.Description)
	if itemID == "" || name == "" {
		return errors.New("menu item id and name are required")
	}
	if item.PriceWei <= 0 {
		return errors.New("menu item price must be greater than 0")
	}
	var existingMerchant postgresMerchantModel
	if err := s.db.WithContext(ctx).First(&existingMerchant, "id = ?", merchantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("merchant not found")
		}
		return err
	}

	var existing postgresMenuItemModel
	err := s.db.WithContext(ctx).Where("merchant_id = ? AND item_id = ?", merchantID, itemID).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := postgresMenuItemModel{
			MerchantID:  merchantID,
			ItemID:      itemID,
			Name:        name,
			PriceWei:    item.PriceWei,
			Description: description,
		}
		return s.db.WithContext(ctx).Create(&row).Error
	}
	existing.Name = name
	existing.PriceWei = item.PriceWei
	existing.Description = description
	return s.db.WithContext(ctx).Save(&existing).Error
}

func (s *PostgresStore) ListMerchantOrders(merchantID string) ([]*models.Order, error) {
	ctx := context.Background()
	var rows []postgresOrderModel
	if err := s.db.WithContext(ctx).Where("merchant_id = ?", merchantID).Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	merchantName := ""
	merchantPayoutAddress := ""
	if merchant, err := s.GetMerchant(merchantID); err == nil {
		merchantName = merchant.Name
		merchantPayoutAddress = merchant.PayoutAddress
	}
	items := make([]*models.Order, 0, len(rows))
	for _, row := range rows {
		title := s.proposalTitleByID(ctx, row.ProposalID)
		var orderItems []postgresOrderItemModel
		if err := s.db.WithContext(ctx).Where("order_id = ?", row.ID).Order("id ASC").Find(&orderItems).Error; err != nil {
			return nil, err
		}
		menuItems := make([]*models.OrderItem, 0, len(orderItems))
		for _, item := range orderItems {
			menuItems = append(menuItems, &models.OrderItem{
				MenuItemID: item.MenuItemID,
				Name:       item.Name,
				Quantity:   item.Quantity,
				PriceWei:   item.PriceWei,
			})
		}
		items = append(items, &models.Order{
			ID:                    row.ID,
			ProposalID:            row.ProposalID,
			Title:                 title,
			MemberID:              row.MemberID,
			MemberName:            row.MemberName,
			MerchantID:            row.MerchantID,
			MerchantName:          merchantName,
			MerchantPayoutAddress: merchantPayoutAddress,
			OrderHash:             row.OrderHash,
			AmountWei:             row.AmountWei,
			Status:                normalizeOrderStatus(row.Status),
			Items:                 menuItems,
			CreatedAt:             row.CreatedAt.UTC(),
			AcceptedAt:            func() *time.Time { acceptedAt, _, _, _ := normalizedOrderTimestamps(row); return acceptedAt }(),
			CompletedAt:           func() *time.Time { _, completedAt, _, _ := normalizedOrderTimestamps(row); return completedAt }(),
			ConfirmedAt:           func() *time.Time { _, _, confirmedAt, _ := normalizedOrderTimestamps(row); return confirmedAt }(),
			PaidOutAt:             func() *time.Time { _, _, _, paidOutAt := normalizedOrderTimestamps(row); return paidOutAt }(),
		})
	}
	return items, nil
}

func (s *PostgresStore) CreateMenuChangeRequest(req *models.MenuChangeRequest) (*models.MenuChangeRequest, error) {
	ctx := context.Background()
	if req == nil {
		return nil, errors.New("request is required")
	}
	row := postgresMenuChangeRequestModel{
		MerchantID:        strings.TrimSpace(req.MerchantID),
		MenuItemID:        strings.TrimSpace(req.MenuItemID),
		Action:            strings.TrimSpace(req.Action),
		Status:            "pending",
		ItemName:          strings.TrimSpace(req.ItemName),
		PriceWei:          req.PriceWei,
		Description:       strings.TrimSpace(req.Description),
		RequestedByMember: req.RequestedByMember,
		RequestedByName:   strings.TrimSpace(req.RequestedByName),
		CreatedAt:         time.Now().UTC(),
	}
	if row.MerchantID == "" || row.Action == "" {
		return nil, errors.New("店家編號與異動類型為必填")
	}
	if row.Action != "delete" && (row.ItemName == "" || row.PriceWei <= 0) {
		return nil, errors.New("新增或修改品項時，品項名稱與價格為必填")
	}
	if row.MenuItemID == "" {
		row.MenuItemID = fmt.Sprintf("draft-%d", time.Now().UTC().UnixNano())
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return s.menuChangeRequestByID(row.ID)
}

func (s *PostgresStore) ListMenuChangeRequests(merchantID string, status string) ([]*models.MenuChangeRequest, error) {
	ctx := context.Background()
	query := s.db.WithContext(ctx).Model(&postgresMenuChangeRequestModel{}).Order("created_at DESC")
	if strings.TrimSpace(merchantID) != "" {
		query = query.Where("merchant_id = ?", strings.TrimSpace(merchantID))
	}
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(status))
	}
	var rows []postgresMenuChangeRequestModel
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.MenuChangeRequest, 0, len(rows))
	for i := range rows {
		item, err := s.menuChangeRequestToModel(&rows[i])
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *PostgresStore) WithdrawMenuChangeRequest(requestID, requesterMemberID int64) (*models.MenuChangeRequest, error) {
	ctx := context.Background()
	res := s.db.WithContext(ctx).Model(&postgresMenuChangeRequestModel{}).
		Where("id = ? AND requested_by_member = ? AND status = ?", requestID, requesterMemberID, "pending").
		Updates(map[string]any{
			"status":      "withdrawn",
			"review_note": "店家已抽回修改",
			"reviewed_at": time.Now().UTC(),
		})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, errors.New("menu change request cannot be withdrawn")
	}
	return s.menuChangeRequestByID(requestID)
}

func (s *PostgresStore) ReviewMenuChangeRequest(requestID, reviewerMemberID int64, reviewerName string, approved bool, reviewNote string, effectiveAt time.Time) (*models.MenuChangeRequest, error) {
	ctx := context.Background()
	updates := map[string]any{
		"reviewed_by_member": reviewerMemberID,
		"reviewed_by_name":   strings.TrimSpace(reviewerName),
		"review_note":        strings.TrimSpace(reviewNote),
		"reviewed_at":        time.Now().UTC(),
	}
	if approved {
		updates["status"] = "approved"
		updates["effective_at"] = effectiveAt.UTC()
	} else {
		updates["status"] = "rejected"
	}
	res := s.db.WithContext(ctx).Model(&postgresMenuChangeRequestModel{}).
		Where("id = ? AND status = ?", requestID, "pending").
		Updates(updates)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, errors.New("menu change request has already been reviewed")
	}
	return s.menuChangeRequestByID(requestID)
}

func (s *PostgresStore) menuChangeRequestByID(requestID int64) (*models.MenuChangeRequest, error) {
	ctx := context.Background()
	var row postgresMenuChangeRequestModel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", requestID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("menu change request not found")
		}
		return nil, err
	}
	return s.menuChangeRequestToModel(&row)
}

func (s *PostgresStore) menuChangeRequestToModel(row *postgresMenuChangeRequestModel) (*models.MenuChangeRequest, error) {
	if row == nil {
		return nil, errors.New("menu change request is required")
	}
	item := &models.MenuChangeRequest{
		ID:                row.ID,
		MerchantID:        row.MerchantID,
		MenuItemID:        row.MenuItemID,
		Action:            row.Action,
		Status:            row.Status,
		ItemName:          row.ItemName,
		PriceWei:          row.PriceWei,
		Description:       row.Description,
		RequestedByMember: row.RequestedByMember,
		RequestedByName:   row.RequestedByName,
		ReviewNote:        row.ReviewNote,
		CreatedAt:         row.CreatedAt.UTC(),
	}
	if row.ReviewedByMember != nil {
		item.ReviewedByMember = *row.ReviewedByMember
	}
	item.ReviewedByName = row.ReviewedByName
	if row.EffectiveAt != nil {
		item.EffectiveAt = row.EffectiveAt.UTC()
	}
	if row.ReviewedAt != nil {
		item.ReviewedAt = row.ReviewedAt.UTC()
	}
	return item, nil
}

func (s *PostgresStore) AdminDashboard() (*models.AdminDashboard, error) {
	ctx := context.Background()
	_ = s.ApplyScheduledMenuChangeRequests(time.Now().UTC())
	var memberCount int64
	var groupCount int64
	var merchantCount int64
	var orderCount int64
	var dinerCount int64
	var pendingMenuReviews int64
	var pendingMerchantDelists int64
	type aggregateRow struct{ Total int64 }
	var servings aggregateRow
	if err := s.db.WithContext(ctx).Model(&postgresMemberModel{}).Count(&memberCount).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresGroupModel{}).Count(&groupCount).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Count(&merchantCount).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresOrderModel{}).Count(&orderCount).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresOrderModel{}).Distinct("member_id").Count(&dinerCount).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresOrderItemModel{}).Select("COALESCE(SUM(quantity), 0) AS total").Scan(&servings).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresMenuChangeRequestModel{}).Where("status = ?", "pending").Count(&pendingMenuReviews).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Where("delist_requested_at IS NOT NULL AND delisted_at IS NULL").Count(&pendingMerchantDelists).Error; err != nil {
		return nil, err
	}
	requests, err := s.ListMenuChangeRequests("", "")
	if err != nil {
		return nil, err
	}
	delistRequests, err := s.ListMerchantDelistRequests(true)
	if err != nil {
		return nil, err
	}
	var payoutRows []struct {
		ID            int64
		ProposalID    int64
		MemberName    string
		MerchantID    string
		MerchantName  string
		PayoutAddress string
		AmountWei     string
		Status        string
		CreatedAt     time.Time
	}
	if err := s.db.WithContext(ctx).
		Table("orders AS o").
		Select("o.id, o.proposal_id, o.member_name, o.merchant_id, m.name AS merchant_name, m.payout_address, o.amount_wei, o.status, o.created_at").
		Joins("JOIN merchants AS m ON m.id = o.merchant_id").
		Where("o.status = ?", "ready_for_payout").
		Order("o.created_at ASC").
		Scan(&payoutRows).Error; err != nil {
		return nil, err
	}
	readyPayoutOrders := make([]*models.ReadyPayoutOrder, 0, len(payoutRows))
	for _, row := range payoutRows {
		readyPayoutOrders = append(readyPayoutOrders, &models.ReadyPayoutOrder{
			OrderID:               row.ID,
			ProposalID:            row.ProposalID,
			MemberName:            row.MemberName,
			MerchantID:            row.MerchantID,
			MerchantName:          row.MerchantName,
			MerchantPayoutAddress: row.PayoutAddress,
			AmountWei:             row.AmountWei,
			Status:                row.Status,
			CreatedAt:             row.CreatedAt.UTC(),
		})
	}
	return &models.AdminDashboard{
		MemberCount:            memberCount,
		GroupCount:             groupCount,
		MerchantCount:          merchantCount,
		OrderCount:             orderCount,
		DinerCount:             dinerCount,
		TotalServings:          servings.Total,
		PendingMenuReviews:     pendingMenuReviews,
		PendingMerchantDelists: pendingMerchantDelists,
		PlatformTreasury:       s.ContractInfo().PlatformTreasury,
		MenuChangeRequests:     requests,
		MerchantDelistRequests: delistRequests,
		ReadyPayoutOrders:      readyPayoutOrders,
	}, nil
}

func (s *PostgresStore) AdminInsights() (*models.AdminInsights, error) {
	ctx := context.Background()
	type groupSummaryRow struct {
		ID               int64
		Name             string
		Description      string
		OwnerMemberID    int64
		OwnerDisplayName string
		MemberCount      int64
		CreatedAt        time.Time
	}
	var groupRows []groupSummaryRow
	if err := s.db.WithContext(ctx).
		Table("groups AS g").
		Select("g.id, g.name, g.description, g.owner_member_id, COALESCE(m.display_name, '') AS owner_display_name, COUNT(gm.member_id) AS member_count, g.created_at").
		Joins("LEFT JOIN members AS m ON m.id = g.owner_member_id").
		Joins("LEFT JOIN group_memberships AS gm ON gm.group_id = g.id").
		Group("g.id, g.name, g.description, g.owner_member_id, m.display_name, g.created_at").
		Order("g.created_at DESC").
		Scan(&groupRows).Error; err != nil {
		return nil, err
	}
	groups := make([]*models.AdminGroupSummary, 0, len(groupRows))
	for _, row := range groupRows {
		groups = append(groups, &models.AdminGroupSummary{
			ID:               row.ID,
			Name:             row.Name,
			Description:      row.Description,
			OwnerMemberID:    row.OwnerMemberID,
			OwnerDisplayName: row.OwnerDisplayName,
			MemberCount:      row.MemberCount,
			CreatedAt:        row.CreatedAt.UTC(),
		})
	}

	var memberRows []postgresMemberModel
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&memberRows).Error; err != nil {
		return nil, err
	}
	members := make([]*models.AdminMemberSummary, 0, len(memberRows))
	for _, row := range memberRows {
		members = append(members, &models.AdminMemberSummary{
			ID:                 row.ID,
			DisplayName:        row.DisplayName,
			Email:              row.Email,
			WalletAddress:      derefString(row.WalletAddress),
			IsAdmin:            row.IsAdmin,
			SubscriptionActive: row.SubscriptionExpiresAt != nil && row.SubscriptionExpiresAt.After(time.Now().UTC()),
			TokenBalance:       row.TokenBalance,
			Points:             row.Points,
			CreatedAt:          row.CreatedAt.UTC(),
		})
	}

	merchants, err := s.ListMerchants()
	if err != nil {
		return nil, err
	}

	var orderRows []postgresOrderModel
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&orderRows).Error; err != nil {
		return nil, err
	}
	orders := make([]*models.Order, 0, len(orderRows))
	for _, row := range orderRows {
		title := s.proposalTitleByID(ctx, row.ProposalID)
		var merchant postgresMerchantModel
		merchantName := ""
		merchantPayoutAddress := ""
		if err := s.db.WithContext(ctx).Where("id = ?", row.MerchantID).First(&merchant).Error; err == nil {
			merchantName = merchant.Name
			merchantPayoutAddress = merchant.PayoutAddress
		}
		var orderItems []postgresOrderItemModel
		if err := s.db.WithContext(ctx).Where("order_id = ?", row.ID).Order("id ASC").Find(&orderItems).Error; err != nil {
			return nil, err
		}
		items := make([]*models.OrderItem, 0, len(orderItems))
		for _, item := range orderItems {
			items = append(items, &models.OrderItem{
				MenuItemID: item.MenuItemID,
				Name:       item.Name,
				Quantity:   item.Quantity,
				PriceWei:   item.PriceWei,
			})
		}
		acceptedAt, completedAt, confirmedAt, paidOutAt := normalizedOrderTimestamps(row)
		orders = append(orders, &models.Order{
			ID:                    row.ID,
			ProposalID:            row.ProposalID,
			Title:                 title,
			MemberID:              row.MemberID,
			MemberName:            row.MemberName,
			MerchantID:            row.MerchantID,
			MerchantName:          merchantName,
			MerchantPayoutAddress: merchantPayoutAddress,
			OrderHash:             row.OrderHash,
			AmountWei:             row.AmountWei,
			Status:                normalizeOrderStatus(row.Status),
			Items:                 items,
			CreatedAt:             row.CreatedAt.UTC(),
			AcceptedAt:            acceptedAt,
			CompletedAt:           completedAt,
			ConfirmedAt:           confirmedAt,
			PaidOutAt:             paidOutAt,
		})
	}

	return &models.AdminInsights{
		Groups:    groups,
		Members:   members,
		Merchants: merchants,
		Orders:    orders,
	}, nil
}

func (s *PostgresStore) StoreChainEvents(events []*models.ChainEvent, lastSeenBlock uint64, syncErr string) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		for _, event := range events {
			record := postgresChainEventModel{
				BlockNumber: event.BlockNumber,
				BlockHash:   event.BlockHash,
				TxHash:      event.TxHash,
				LogIndex:    event.LogIndex,
				EventName:   event.EventName,
				ProposalID:  event.ProposalID,
				PayloadJSON: event.PayloadJSON,
				CreatedAt:   now,
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&record).Error; err != nil {
				return err
			}
			applied, err := s.isEventAppliedTxGorm(ctx, tx, event.TxHash, event.LogIndex)
			if err != nil {
				return err
			}
			if applied {
				continue
			}
			if err := s.applyChainEventTxGorm(ctx, tx, event); err != nil {
				return err
			}
			if err := tx.Create(&postgresAppliedChainEventModel{
				TxHash:    event.TxHash,
				LogIndex:  event.LogIndex,
				AppliedAt: now,
			}).Error; err != nil {
				return err
			}
		}
		status := postgresSyncStateModel{
			CursorKey:       chainCursorKey,
			LastSyncedBlock: lastSeenBlock,
			LastSyncedAt:    now.Format(time.RFC3339),
			LastSeenBlock:   lastSeenBlock,
			LastSyncError:   syncErr,
			UpdatedAt:       now,
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "cursor_key"}},
			DoUpdates: clause.Assignments(map[string]any{
				"last_synced_block": status.LastSyncedBlock,
				"last_synced_at":    status.LastSyncedAt,
				"last_seen_block":   status.LastSeenBlock,
				"last_sync_error":   status.LastSyncError,
				"updated_at":        status.UpdatedAt,
			}),
		}).Create(&status).Error
	})
}

func (s *PostgresStore) ChainSyncStatus() (*models.ChainSyncStatus, error) {
	ctx := context.Background()
	var state postgresSyncStateModel
	err := s.db.WithContext(ctx).First(&state, "cursor_key = ?", chainCursorKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &models.ChainSyncStatus{CursorKey: chainCursorKey}, nil
		}
		return nil, err
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&postgresChainEventModel{}).Count(&count).Error; err != nil {
		return nil, err
	}
	return &models.ChainSyncStatus{
		CursorKey:         state.CursorKey,
		LastSyncedBlock:   state.LastSyncedBlock,
		LastSyncedAt:      state.LastSyncedAt,
		LastSeenBlock:     state.LastSeenBlock,
		LastSyncError:     state.LastSyncError,
		IndexedEventCount: count,
	}, nil
}

func (s *PostgresStore) ListChainEvents(limit int) ([]*models.ChainEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	ctx := context.Background()
	var rows []postgresChainEventModel
	if err := s.db.WithContext(ctx).Order("block_number DESC, log_index DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	events := make([]*models.ChainEvent, 0, len(rows))
	for _, row := range rows {
		events = append(events, &models.ChainEvent{
			ID:          row.ID,
			BlockNumber: row.BlockNumber,
			BlockHash:   row.BlockHash,
			TxHash:      row.TxHash,
			LogIndex:    row.LogIndex,
			EventName:   row.EventName,
			ProposalID:  row.ProposalID,
			PayloadJSON: row.PayloadJSON,
			CreatedAt:   row.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return events, nil
}

func (s *PostgresStore) RegisterPendingTransaction(memberID, proposalID int64, action, txHash, walletAddress, relatedOrder string) (*models.PendingTransaction, error) {
	ctx := context.Background()
	now := time.Now().UTC()
	record := postgresPendingTransactionModel{MemberID: memberID, ProposalID: proposalID, Action: action, TxHash: txHash, WalletAddress: walletAddress, Status: "pending", RelatedOrder: relatedOrder, CreatedAt: now, UpdatedAt: now}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}},
		DoUpdates: clause.Assignments(map[string]any{"member_id": memberID, "proposal_id": nullableInt64(proposalID), "action": action, "wallet_address": walletAddress, "related_order": relatedOrder, "updated_at": now}),
	}).Create(&record).Error; err != nil {
		return nil, err
	}
	return s.GetPendingTransaction(memberID, txHash)
}

func (s *PostgresStore) GetPendingTransaction(memberID int64, txHash string) (*models.PendingTransaction, error) {
	ctx := context.Background()
	var record postgresPendingTransactionModel
	query := s.db.WithContext(ctx).Where("tx_hash = ?", txHash)
	if memberID > 0 {
		query = query.Where("member_id = ?", memberID)
	}
	if err := query.First(&record).Error; err != nil {
		return nil, err
	}
	return pendingTxFromModel(&record), nil
}

func (s *PostgresStore) ListPendingTransactions(memberID int64, limit int) ([]*models.PendingTransaction, error) {
	if limit <= 0 {
		limit = 30
	}
	ctx := context.Background()
	var rows []postgresPendingTransactionModel
	if err := s.db.WithContext(ctx).Where("member_id = ?", memberID).Order("id DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.PendingTransaction, 0, len(rows))
	for _, row := range rows {
		items = append(items, pendingTxFromModel(&row))
	}
	return items, nil
}

func (s *PostgresStore) LogUsage(memberID, proposalID int64, action, assetType, direction, amount, note, reference string) error {
	ctx := context.Background()
	return s.logUsageTxGorm(ctx, s.db.WithContext(ctx), memberID, proposalID, action, assetType, direction, amount, note, reference)
}

func (s *PostgresStore) ListUsage(memberID int64, limit int) ([]*models.UsageRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	ctx := context.Background()
	var rows []postgresUsageRecordModel
	if err := s.db.WithContext(ctx).Where("member_id = ?", memberID).Order("created_at DESC, id DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.UsageRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, &models.UsageRecord{ID: row.ID, MemberID: row.MemberID, ProposalID: row.ProposalID, Action: row.Action, AssetType: row.AssetType, Direction: row.Direction, Amount: row.Amount, Note: row.Note, Reference: row.Reference, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)})
	}
	return items, nil
}

func (s *PostgresStore) CreateGroup(ownerMemberID int64, name, description string) (*models.Group, error) {
	ctx := context.Background()
	var group postgresGroupModel
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		group = postgresGroupModel{Name: name, Description: description, OwnerMemberID: ownerMemberID, CreatedAt: now}
		if err := tx.Create(&group).Error; err != nil {
			return err
		}
		return tx.Create(&postgresGroupMembershipModel{GroupID: group.ID, MemberID: ownerMemberID, JoinedAt: now}).Error
	})
	if err != nil {
		return nil, err
	}
	return &models.Group{ID: group.ID, Name: group.Name, Description: group.Description, OwnerMemberID: group.OwnerMemberID, CreatedAt: group.CreatedAt.UTC().Format(time.RFC3339), Members: []*models.GroupMember{}, InviteCode: ""}, nil
}

func (s *PostgresStore) GetGroup(id int64) (*models.Group, error) {
	ctx := context.Background()
	if err := s.PruneInactiveGroups(ctx); err != nil {
		return nil, err
	}
	var group postgresGroupModel
	if err := s.db.WithContext(ctx).First(&group, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		return nil, err
	}
	members, err := s.loadGroupMembers(ctx, group.ID)
	if err != nil {
		return nil, err
	}
	inviteCode, err := s.latestGroupInviteCode(ctx, group.ID)
	if err != nil {
		return nil, err
	}
	return &models.Group{ID: group.ID, Name: group.Name, Description: group.Description, OwnerMemberID: group.OwnerMemberID, CreatedAt: group.CreatedAt.UTC().Format(time.RFC3339), Members: members, InviteCode: inviteCode}, nil
}

func (s *PostgresStore) GetGroupByOwnerAndName(ownerMemberID int64, name string) (*models.Group, error) {
	ctx := context.Background()
	var group postgresGroupModel
	if err := s.db.WithContext(ctx).Where("owner_member_id = ? AND name = ?", ownerMemberID, name).Order("id ASC").First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		return nil, err
	}
	return &models.Group{ID: group.ID, Name: group.Name, Description: group.Description, OwnerMemberID: group.OwnerMemberID, CreatedAt: group.CreatedAt.UTC().Format(time.RFC3339), Members: []*models.GroupMember{}}, nil
}

func (s *PostgresStore) CreateInvite(groupID, createdBy int64, inviteCode string) (*models.GroupInvite, error) {
	ctx := context.Background()
	var invite postgresGroupInviteModel
	if err := s.db.WithContext(ctx).Where("group_id = ?", groupID).Order("id DESC").First(&invite).Error; err == nil {
		return s.groupInviteFromModel(&invite), nil
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	invite = postgresGroupInviteModel{GroupID: groupID, InviteCode: inviteCode, CreatedBy: createdBy, CreatedAt: time.Now().UTC()}
	if err := s.db.WithContext(ctx).Create(&invite).Error; err != nil {
		return nil, err
	}
	return s.groupInviteFromModel(&invite), nil
}

func (s *PostgresStore) GetInviteByCode(code string) (*models.GroupInvite, error) {
	ctx := context.Background()
	var invite postgresGroupInviteModel
	if err := s.db.WithContext(ctx).Where("invite_code = ?", code).First(&invite).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		return nil, err
	}
	return s.groupInviteFromModel(&invite), nil
}

func (s *PostgresStore) ListGroupInviteUsages(groupID int64) ([]*models.GroupInviteUsage, error) {
	ctx := context.Background()
	type usageRow struct {
		ID            int64
		GroupID        int64
		InviteCode    string
		UsedByMemberID int64
		UsedByName    string
		UsedAt        time.Time
	}
	var rows []usageRow
	if err := s.db.WithContext(ctx).
		Table("group_invite_usages AS u").
		Select("u.id, u.group_id, u.invite_code, u.used_by_member_id, members.display_name AS used_by_name, u.used_at").
		Joins("JOIN members ON members.id = u.used_by_member_id").
		Where("u.group_id = ?", groupID).
		Order("u.used_at DESC, u.id DESC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.GroupInviteUsage, 0, len(rows))
	for _, row := range rows {
		items = append(items, &models.GroupInviteUsage{
			ID:            row.ID,
			GroupID:       row.GroupID,
			InviteCode:    row.InviteCode,
			UsedByMemberID: row.UsedByMemberID,
			UsedByName:    row.UsedByName,
			UsedAt:        row.UsedAt.UTC().Format(time.RFC3339),
		})
	}
	return items, nil
}

func (s *PostgresStore) AddMember(groupID, memberID int64) error {
	ctx := context.Background()
	entry := postgresGroupMembershipModel{GroupID: groupID, MemberID: memberID, JoinedAt: time.Now().UTC()}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&entry).Error
}

func (s *PostgresStore) AddMemberByInvite(groupID, memberID int64, inviteCode string) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		entry := postgresGroupMembershipModel{GroupID: groupID, MemberID: memberID, JoinedAt: time.Now().UTC()}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&entry).Error; err != nil {
			return err
		}
		var existing int64
		if err := tx.Model(&postgresGroupInviteUsageModel{}).
			Where("group_id = ? AND used_by_member_id = ?", groupID, memberID).
			Count(&existing).Error; err != nil {
			return err
		}
		if existing == 0 {
			if err := tx.Create(&postgresGroupInviteUsageModel{
				GroupID:       groupID,
				InviteCode:    inviteCode,
				UsedByMemberID: memberID,
				UsedAt:        time.Now().UTC(),
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *PostgresStore) RemoveMember(groupID, memberID int64) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Where("group_id = ? AND member_id = ?", groupID, memberID).Delete(&postgresGroupMembershipModel{}).Error
}

func (s *PostgresStore) DeleteGroup(groupID int64) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var proposals []postgresProposalModel
		if err := tx.Where("COALESCE(group_id, 0) = ?", groupID).Find(&proposals).Error; err != nil {
			return err
		}
		for _, proposal := range proposals {
			if err := s.deleteProposalRoundTxGorm(ctx, tx, proposal.ID); err != nil {
				return err
			}
		}
		if err := tx.Where("group_id = ?", groupID).Delete(&postgresGroupInviteModel{}).Error; err != nil {
			return err
		}
		if err := tx.Where("group_id = ?", groupID).Delete(&postgresGroupMembershipModel{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", groupID).Delete(&postgresGroupModel{}).Error
	})
}

func (s *PostgresStore) UpdateGroup(groupID, ownerMemberID int64, name, description string) (*models.Group, error) {
	ctx := context.Background()
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	if name == "" {
		return nil, errors.New("group name is required")
	}
	result := s.db.WithContext(ctx).Model(&postgresGroupModel{}).Where("id = ? AND owner_member_id = ?", groupID, ownerMemberID).Updates(map[string]any{
		"name":        name,
		"description": description,
	})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, errors.New("group not found")
	}
	return s.GetGroup(groupID)
}

func (s *PostgresStore) RemoveGroupMember(groupID, ownerMemberID, targetMemberID int64) error {
	ctx := context.Background()
	var group postgresGroupModel
	if err := s.db.WithContext(ctx).First(&group, "id = ?", groupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("group not found")
		}
		return err
	}
	if group.OwnerMemberID != ownerMemberID {
		return errors.New("only the group owner can edit members")
	}
	if targetMemberID == ownerMemberID {
		return errors.New("group owner cannot remove self")
	}
	return s.db.WithContext(ctx).Where("group_id = ? AND member_id = ?", groupID, targetMemberID).Delete(&postgresGroupMembershipModel{}).Error
}

func (s *PostgresStore) IsMember(groupID, memberID int64) (bool, error) {
	ctx := context.Background()
	if err := s.PruneInactiveGroups(ctx); err != nil {
		return false, err
	}
	var count int64
	err := s.db.WithContext(ctx).Model(&postgresGroupMembershipModel{}).Where("group_id = ? AND member_id = ?", groupID, memberID).Count(&count).Error
	return count > 0, err
}

func (s *PostgresStore) GetGroupDetail(groupID, viewerMemberID int64) (*models.GroupDetail, error) {
	group, err := s.GetGroup(groupID)
	if err != nil {
		return nil, err
	}
	if ok, err := s.IsMember(groupID, viewerMemberID); err != nil {
		return nil, err
	} else if !ok {
		return nil, errors.New("not a member of this group")
	}
	details := make([]*models.GroupMemberDetail, 0, len(group.Members))
	for _, gm := range group.Members {
		member, err := s.MemberByID(gm.MemberID)
		if err != nil {
			continue
		}
		profileMember, err := s.MemberByID(gm.MemberID)
		if err != nil {
			continue
		}
		created, orders, votes, _ := s.MemberStats(gm.MemberID)
		reviews, _ := s.MemberReviewCount(gm.MemberID)
		recentOrders, _ := s.ListMemberOrders(gm.MemberID)
		if len(recentOrders) > 5 {
			recentOrders = recentOrders[:5]
		}
		details = append(details, &models.GroupMemberDetail{
			MemberID:         gm.MemberID,
			DisplayName:      gm.DisplayName,
			WalletAddress:    member.WalletAddress,
			Points:           member.Points,
			TokenBalance:     member.TokenBalance,
			JoinedAt:         gm.JoinedAt,
			OrdersSubmitted:  orders,
			VotesCast:        votes,
			ProposalsCreated: created,
			MerchantReviews:  reviews,
			RecentOrders:     recentOrders,
			Profile: &models.MemberProfile{
				Member: profileMember,
				Stats: map[string]int64{
					"points":       member.Points,
					"tokenBalance": member.TokenBalance,
				},
				History: map[string]int64{
					"ordersSubmitted":  orders,
					"votesCast":        votes,
					"proposalsCreated": created,
					"merchantReviews":  reviews,
				},
			},
		})
	}
	inviteUsages, _ := s.ListGroupInviteUsages(groupID)
	return &models.GroupDetail{
		Group:        group,
		MemberCount:  int64(len(group.Members)),
		Members:      details,
		CanManage:    group.OwnerMemberID == viewerMemberID,
		InviteUsages: inviteUsages,
	}, nil
}

func (s *PostgresStore) AdminGroupDetail(groupID int64) (*models.GroupDetail, error) {
	group, err := s.GetGroup(groupID)
	if err != nil {
		return nil, err
	}
	details := make([]*models.GroupMemberDetail, 0, len(group.Members))
	for _, gm := range group.Members {
		member, err := s.MemberByID(gm.MemberID)
		if err != nil {
			continue
		}
		profileMember, err := s.MemberByID(gm.MemberID)
		if err != nil {
			continue
		}
		created, orders, votes, _ := s.MemberStats(gm.MemberID)
		reviews, _ := s.MemberReviewCount(gm.MemberID)
		recentOrders, _ := s.ListMemberOrders(gm.MemberID)
		if len(recentOrders) > 5 {
			recentOrders = recentOrders[:5]
		}
		details = append(details, &models.GroupMemberDetail{
			MemberID:         gm.MemberID,
			DisplayName:      member.DisplayName,
			WalletAddress:    member.WalletAddress,
			Points:           member.Points,
			TokenBalance:     member.TokenBalance,
			JoinedAt:         gm.JoinedAt,
			OrdersSubmitted:  orders,
			VotesCast:        votes,
			ProposalsCreated: created,
			MerchantReviews:  reviews,
			RecentOrders:     recentOrders,
			Profile: &models.MemberProfile{
				Member:  profileMember,
				History: map[string]int64{},
				Stats:   map[string]int64{},
			},
		})
	}
	return &models.GroupDetail{
		Group:       group,
		MemberCount: int64(len(details)),
		Members:     details,
		CanManage:   false,
	}, nil
}

func (s *PostgresStore) ListMemberGroups(memberID int64) ([]*models.Group, error) {
	ctx := context.Background()
	if err := s.PruneInactiveGroups(ctx); err != nil {
		return nil, err
	}
	var rows []postgresGroupModel
	if err := s.db.WithContext(ctx).Table("groups").Select("groups.*").Joins("JOIN group_memberships gm ON gm.group_id = groups.id").Where("gm.member_id = ?", memberID).Order("groups.created_at DESC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]*models.Group, 0, len(rows))
	for _, row := range rows {
		members, err := s.loadGroupMembers(ctx, row.ID)
		if err != nil {
			return nil, err
		}
		items = append(items, &models.Group{ID: row.ID, Name: row.Name, Description: row.Description, OwnerMemberID: row.OwnerMemberID, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), Members: members})
	}
	return items, nil
}

func (s *PostgresStore) HasClaimed(memberID int64) (bool, error) {
	ctx := context.Background()
	var count int64
	err := s.db.WithContext(ctx).Model(&postgresFaucetClaimModel{}).Where("member_id = ?", memberID).Count(&count).Error
	return count > 0, err
}
func (s *PostgresStore) RecordClaim(memberID int64, walletAddress string) error {
	ctx := context.Background()
	var walletPtr *string
	if strings.TrimSpace(walletAddress) != "" {
		wallet := walletAddress
		walletPtr = &wallet
	}
	return s.db.WithContext(ctx).Create(&postgresFaucetClaimModel{
		MemberID:      memberID,
		WalletAddress: walletPtr,
		ClaimedAt:     time.Now().UTC(),
	}).Error
}
func (s *PostgresStore) ClaimFaucet(memberID int64, walletAddress string) (int64, error) {
	ctx := context.Background()
	var newBalance int64
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&postgresFaucetClaimModel{}).Where("member_id = ?", memberID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrAlreadyClaimed
		}
		var walletPtr *string
		if strings.TrimSpace(walletAddress) != "" {
			wallet := walletAddress
			walletPtr = &wallet
		}
		if err := tx.Create(&postgresFaucetClaimModel{
			MemberID:      memberID,
			WalletAddress: walletPtr,
			ClaimedAt:     time.Now().UTC(),
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("token_balance", gorm.Expr("token_balance + 100")).Error; err != nil {
			return err
		}
		if err := s.logUsageTxGorm(ctx, tx, memberID, 0, "claim_faucet", "token", "credit", "100", "領取註冊 Token", ""); err != nil {
			return err
		}
		var member postgresMemberModel
		if err := tx.First(&member, "id = ?", memberID).Error; err != nil {
			return err
		}
		newBalance = member.TokenBalance
		return nil
	})
	if err != nil {
		return 0, err
	}
	return newBalance, nil
}

func (s *PostgresStore) DeductTokens(memberID int64, amount int64) error {
	ctx := context.Background()
	res := s.db.WithContext(ctx).Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, amount).Update("token_balance", gorm.Expr("token_balance - ?", amount))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("insufficient token balance or member not found")
	}
	return nil
}

func (s *PostgresStore) DeductTokensAndSubscribe(memberID int64, amount int64, expiresAt time.Time) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, amount).Update("token_balance", gorm.Expr("token_balance - ?", amount))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("insufficient token balance or member not found")
		}
		return tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("subscription_expires_at", expiresAt.UTC()).Error
	})
}

func (s *PostgresStore) AdvanceProposalStage(proposalID int64, stage string) error {
	ctx := context.Background()
	now := time.Now().UTC().Add(-time.Second)
	result := s.db.WithContext(ctx)
	switch stage {
	case "voting":
		result = result.Model(&postgresProposalModel{}).Where("id = ?", proposalID).Update("proposal_deadline", now)
	case "ordering":
		var winner postgresProposalOptionModel
		winnerID := int64(0)
		if err := s.db.WithContext(ctx).Where("proposal_id = ?", proposalID).Order("weighted_votes DESC, id ASC").First(&winner).Error; err == nil {
			winnerID = winner.ID
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		result = result.Model(&postgresProposalModel{}).Where("id = ?", proposalID).Updates(map[string]any{
			"vote_deadline":    now,
			"winner_option_id": winnerID,
		})
	case "settled":
		result = result.Model(&postgresProposalModel{}).Where("id = ?", proposalID).Update("order_deadline", now)
	default:
		return errors.New("invalid stage: must be voting, ordering, or settled")
	}
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("proposal %d not found", proposalID)
	}
	return nil
}

func (s *PostgresStore) GetProposalIDByGroupAndTitle(groupID int64, title string) (int64, error) {
	ctx := context.Background()
	var proposal postgresProposalModel
	if err := s.db.WithContext(ctx).Where("group_id = ? AND title = ?", groupID, title).Order("id DESC").First(&proposal).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, gorm.ErrRecordNotFound
		}
		return 0, err
	}
	return proposal.ID, nil
}

func (s *PostgresStore) SetProposalGroupID(proposalID, groupID int64) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Model(&postgresProposalModel{}).Where("id = ?", proposalID).Update("group_id", groupID).Error
}

func (s *PostgresStore) PruneProposalRounds(groupID, keepProposalID int64) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var rows []postgresProposalModel
		if err := tx.Where("id <> ? AND COALESCE(group_id, 0) = ?", keepProposalID, groupID).Find(&rows).Error; err != nil {
			return err
		}
		for _, row := range rows {
			if err := s.deleteProposalRoundTxGorm(ctx, tx, row.ID); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *PostgresStore) memberByQuery(apply func(*gorm.DB) *gorm.DB) (*models.Member, error) {
	ctx := context.Background()
	var member postgresMemberModel
	query := s.db.WithContext(ctx).Model(&postgresMemberModel{})
	if apply != nil {
		query = apply(query)
	}
	if err := query.First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("member not found")
		}
		return nil, err
	}
	return s.memberFromModel(&member), nil
}

func (s *PostgresStore) memberFromModel(member *postgresMemberModel) *models.Member {
	result := &models.Member{ID: member.ID, Email: member.Email, PasswordHash: member.PasswordHash, DisplayName: member.DisplayName, AvatarURL: member.AvatarURL, IsAdmin: member.IsAdmin, Points: member.Points, TokenBalance: member.TokenBalance, ProposalTicketCount: member.ProposalTicketCount, VoteTicketCount: member.VoteTicketCount, CreateOrderTicketCount: member.CreateOrderTicketCount, ClaimableProposalTickets: member.ClaimableProposalTickets, ClaimableVoteTickets: member.ClaimableVoteTickets, ClaimableCreateOrderTickets: member.ClaimableCreateOrderTickets, CreatedAt: member.CreatedAt.UTC()}
	if member.WalletAddress != nil {
		result.WalletAddress = *member.WalletAddress
	}
	if member.RegistrationInviteCode != nil {
		result.RegistrationInviteCode = *member.RegistrationInviteCode
	}
	if member.SubscriptionExpiresAt != nil {
		result.SubscriptionExpiresAt = member.SubscriptionExpiresAt.UTC()
		result.SubscriptionActive = member.SubscriptionExpiresAt.After(time.Now().UTC())
	}
	return result
}

func (s *PostgresStore) loadGroupMembers(ctx context.Context, groupID int64) ([]*models.GroupMember, error) {
	type row struct {
		MemberID      int64
		DisplayName   string
		WalletAddress *string
		Points        int64
		JoinedAt      time.Time
	}
	var rows []row
	if err := s.db.WithContext(ctx).Table("group_memberships gm").Select("gm.member_id, m.display_name, m.wallet_address, m.points, gm.joined_at").Joins("JOIN members m ON m.id = gm.member_id").Where("gm.group_id = ?", groupID).Order("gm.joined_at ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	members := make([]*models.GroupMember, 0, len(rows))
	for _, row := range rows {
		members = append(members, &models.GroupMember{MemberID: row.MemberID, DisplayName: row.DisplayName, WalletAddress: derefString(row.WalletAddress), Points: row.Points, JoinedAt: row.JoinedAt.UTC().Format(time.RFC3339)})
	}
	return members, nil
}

func (s *PostgresStore) latestGroupInviteCode(ctx context.Context, groupID int64) (string, error) {
	var invite postgresGroupInviteModel
	err := s.db.WithContext(ctx).Where("group_id = ?", groupID).Order("id DESC").First(&invite).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return invite.InviteCode, nil
}

func (s *PostgresStore) groupInviteFromModel(invite *postgresGroupInviteModel) *models.GroupInvite {
	var usageCount int64
	_ = s.db.WithContext(context.Background()).Model(&postgresGroupInviteUsageModel{}).Where("group_id = ? AND invite_code = ?", invite.GroupID, invite.InviteCode).Count(&usageCount).Error
	return &models.GroupInvite{ID: invite.ID, GroupID: invite.GroupID, InviteCode: invite.InviteCode, CreatedBy: invite.CreatedBy, CreatedAt: invite.CreatedAt.UTC().Format(time.RFC3339), UsageCount: usageCount}
}

func (s *PostgresStore) loadProposal(ctx context.Context, proposalID int64) (*models.Proposal, error) {
	var proposalRow postgresProposalModel
	if err := s.db.WithContext(ctx).First(&proposalRow, "id = ?", proposalID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("proposal not found")
		}
		return nil, err
	}
	proposal := &models.Proposal{ID: proposalRow.ID, Title: proposalRow.Title, Description: proposalRow.Description, MerchantGroup: proposalRow.MerchantGroup, MealPeriod: proposalRow.MealPeriod, ProposalDate: proposalRow.ProposalDate, MaxOptions: proposalRow.MaxOptions, CreatedBy: proposalRow.CreatedBy, CreatedByName: proposalRow.CreatedByName, ProposalDeadline: proposalRow.ProposalDeadline.UTC(), VoteDeadline: proposalRow.VoteDeadline.UTC(), OrderDeadline: proposalRow.OrderDeadline.UTC(), WinnerOptionID: proposalRow.WinnerOptionID, RewardsApplied: proposalRow.RewardsApplied, CreatedAt: proposalRow.CreatedAt.UTC()}
	if proposal.ProposalDate == "" {
		reference := proposal.CreatedAt
		if reference.IsZero() {
			reference = proposal.ProposalDeadline
		}
		proposal.ProposalDate = reference.In(repositoryBusinessLocation()).Format("2006-01-02")
	}
	if proposal.MaxOptions <= 0 {
		proposal.MaxOptions = 5
	}
	if proposal.MealPeriod == "" {
		proposal.MealPeriod = "lunch"
	}
	if proposalRow.GroupID != nil {
		proposal.GroupID = *proposalRow.GroupID
	}
	var chainMap postgresProposalChainMapModel
	if err := s.db.WithContext(ctx).First(&chainMap, "local_proposal_id = ?", proposalID).Error; err == nil {
		chainProposalID := chainMap.ChainProposalID
		proposal.ChainProposalID = &chainProposalID
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	proposal.Status = deriveStatus(proposal)

	var optionRows []postgresProposalOptionModel
	if err := s.db.WithContext(ctx).Where("proposal_id = ?", proposalID).Order("id ASC").Find(&optionRows).Error; err != nil {
		return nil, err
	}
	for _, row := range optionRows {
		option := &models.ProposalOption{ID: row.ID, MerchantID: row.MerchantID, MerchantName: row.MerchantName, ProposerMember: row.ProposerMemberID, ProposerName: row.ProposerName, WeightedVotes: row.WeightedVotes, TokenStake: row.TokenStake, PartialRefund: row.PartialRefund, WinnerTokenBack: row.WinnerTokenBack}
		var optionMap postgresProposalOptionChainMapModel
		if err := s.db.WithContext(ctx).First(&optionMap, "local_option_id = ?", row.ID).Error; err == nil {
			chainOptionIndex := optionMap.ChainOptionIndex
			option.ChainOptionIndex = &chainOptionIndex
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		proposal.Options = append(proposal.Options, option)
	}

	var voteRows []postgresVoteModel
	if err := s.db.WithContext(ctx).Where("proposal_id = ?", proposalID).Order("id ASC").Find(&voteRows).Error; err != nil {
		return nil, err
	}
	for _, row := range voteRows {
		proposal.Votes = append(proposal.Votes, &models.VoteRecord{MemberID: row.MemberID, MemberName: row.MemberName, OptionID: row.OptionID, TokenAmount: row.TokenAmount, VoteWeight: row.VoteWeight, SubmittedAt: row.SubmittedAt.UTC().Format(time.RFC3339), WalletHidden: row.WalletHidden})
	}
	var orderRows []postgresOrderModel
	if err := s.db.WithContext(ctx).Where("proposal_id = ?", proposalID).Order("id ASC").Find(&orderRows).Error; err != nil {
		return nil, err
	}
	for _, row := range orderRows {
		merchantName := ""
		merchantPayoutAddress := ""
		title := s.proposalTitleByID(ctx, row.ProposalID)
		if merchant, err := s.GetMerchant(row.MerchantID); err == nil {
			merchantName = merchant.Name
			merchantPayoutAddress = merchant.PayoutAddress
		}
		order := &models.Order{
			ID:                    row.ID,
			ProposalID:            row.ProposalID,
			Title:                 title,
			MemberID:              row.MemberID,
			MemberName:            row.MemberName,
			MerchantID:            row.MerchantID,
			MerchantName:          merchantName,
			MerchantPayoutAddress: merchantPayoutAddress,
			OrderHash:             row.OrderHash,
			AmountWei:             row.AmountWei,
			Status:                normalizeOrderStatus(row.Status),
			CreatedAt:             row.CreatedAt.UTC(),
			AcceptedAt:            func() *time.Time { acceptedAt, _, _, _ := normalizedOrderTimestamps(row); return acceptedAt }(),
			CompletedAt:           func() *time.Time { _, completedAt, _, _ := normalizedOrderTimestamps(row); return completedAt }(),
			ConfirmedAt:           func() *time.Time { _, _, confirmedAt, _ := normalizedOrderTimestamps(row); return confirmedAt }(),
			PaidOutAt:             func() *time.Time { _, _, _, paidOutAt := normalizedOrderTimestamps(row); return paidOutAt }(),
			Signature: &models.OrderSignature{
				AmountWei:       row.SignatureAmountWei,
				Expiry:          row.SignatureExpiry,
				OrderHash:       row.OrderHash,
				Signature:       row.SignatureValue,
				Digest:          row.SignatureDigest,
				SignerAddress:   row.SignerAddress,
				ContractAddress: row.ContractAddress,
				TokenAddress:    row.TokenAddress,
			},
		}
		var itemRows []postgresOrderItemModel
		if err := s.db.WithContext(ctx).Where("order_id = ?", row.ID).Order("id ASC").Find(&itemRows).Error; err != nil {
			return nil, err
		}
		for _, item := range itemRows {
			order.Items = append(order.Items, &models.OrderItem{
				MenuItemID: item.MenuItemID,
				Name:       item.Name,
				Quantity:   item.Quantity,
				PriceWei:   item.PriceWei,
			})
		}
		proposal.Orders = append(proposal.Orders, order)
	}
	proposal.OrderTotalWei = sumProposalOrderAmounts(proposal.Orders)
	proposal.OrderMemberCount = countCountedOrders(proposal.Orders)
	return proposal, nil
}

func (s *PostgresStore) refreshProposalState(ctx context.Context, proposalID int64) error {
	var autoSettle bool
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var proposal postgresProposalModel
		if err := tx.First(&proposal, "id = ?", proposalID).Error; err != nil {
			return err
		}
		var chainMapCount int64
		if err := tx.Model(&postgresProposalChainMapModel{}).Where("local_proposal_id = ?", proposalID).Count(&chainMapCount).Error; err != nil {
			return err
		}
		if chainMapCount > 0 {
			return nil
		}

		var optCount int64
		if err := tx.Model(&postgresProposalOptionModel{}).Where("proposal_id = ?", proposalID).Count(&optCount).Error; err != nil {
			return err
		}

		voteEnd := proposal.VoteDeadline.UTC()
		if isCurrentProposalDay(proposal.ProposalDate) && proposal.WinnerOptionID == 0 && !time.Now().UTC().Before(voteEnd) && optCount > 0 {
			var winner postgresProposalOptionModel
			if err := tx.Where("proposal_id = ?", proposalID).Order("weighted_votes DESC, id ASC").First(&winner).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return nil
				}
				return err
			}
			if err := tx.Model(&postgresProposalModel{}).Where("id = ?", proposalID).Update("winner_option_id", winner.ID).Error; err != nil {
				return err
			}
			proposal.WinnerOptionID = winner.ID
		}

		propView := &models.Proposal{
			ProposalDate:     proposal.ProposalDate,
			ProposalDeadline: proposal.ProposalDeadline.UTC(),
			VoteDeadline:     voteEnd,
			OrderDeadline:    proposal.OrderDeadline.UTC(),
			WinnerOptionID:   proposal.WinnerOptionID,
			RewardsApplied:   proposal.RewardsApplied,
		}
		autoSettle = shouldAutoSettleLocalProposal(propView)
		return nil
	})
	if err != nil {
		return err
	}
	if autoSettle {
		return s.applyLocalSettlementRewards(ctx, proposalID)
	}
	return nil
}

func (s *PostgresStore) applyLocalSettlementRewards(ctx context.Context, proposalID int64) error {
	proposal, err := s.loadProposal(ctx, proposalID)
	if err != nil {
		return err
	}
	if proposal.RewardsApplied || !shouldAutoSettleLocalProposal(proposal) {
		return nil
	}

	var rewards []MemberReward
	var optionRefunds []OptionRefund
	for _, opt := range proposal.Options {
		if opt == nil {
			continue
		}
		if opt.ID == proposal.WinnerOptionID {
			rewards = append(rewards, MemberReward{
				MemberID: opt.ProposerMember,
				Points:   autoWinnerProposerPoints,
				Tokens:   autoWinnerTokenReward,
			})
			optionRefunds = append(optionRefunds, OptionRefund{
				OptionID:        opt.ID,
				WinnerTokenBack: autoWinnerTokenReward,
			})
			continue
		}
		rewards = append(rewards, MemberReward{
			MemberID: opt.ProposerMember,
			Tokens:   autoLoserPartialRefund,
		})
		optionRefunds = append(optionRefunds, OptionRefund{
			OptionID:      opt.ID,
			PartialRefund: autoLoserPartialRefund,
		})
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var voterIDs []int64
		if err := tx.Model(&postgresVoteModel{}).Where("proposal_id = ?", proposalID).Distinct("member_id").Pluck("member_id", &voterIDs).Error; err != nil {
			return err
		}
		for _, memberID := range voterIDs {
			rewards = append(rewards, MemberReward{
				MemberID: memberID,
				Points:   autoVoterPoints,
			})
		}

		for _, reward := range rewards {
			if err := tx.Model(&postgresMemberModel{}).Where("id = ?", reward.MemberID).Updates(map[string]any{
				"points":        gorm.Expr("points + ?", reward.Points),
				"token_balance": gorm.Expr("token_balance + ?", reward.Tokens),
			}).Error; err != nil {
				return err
			}
			if reward.Tokens > 0 {
				if err := s.logUsageTxGorm(ctx, tx, reward.MemberID, proposalID, "settlement_reward", "token", "credit", fmt.Sprintf("%d", reward.Tokens), "自動結算獎勵", ""); err != nil {
					return err
				}
			}
		}
		for _, refund := range optionRefunds {
			if err := tx.Model(&postgresProposalOptionModel{}).Where("id = ?", refund.OptionID).Updates(map[string]any{
				"partial_refund":    refund.PartialRefund,
				"winner_token_back": refund.WinnerTokenBack,
			}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&postgresProposalModel{}).Where("id = ?", proposalID).Update("rewards_applied", true).Error
	})
}

func (s *PostgresStore) logUsageTxGorm(ctx context.Context, tx *gorm.DB, memberID, proposalID int64, action, assetType, direction, amount, note, reference string) error {
	if memberID <= 0 || strings.TrimSpace(action) == "" || strings.TrimSpace(assetType) == "" || strings.TrimSpace(direction) == "" || strings.TrimSpace(amount) == "" {
		return nil
	}
	record := postgresUsageRecordModel{MemberID: memberID, Action: action, AssetType: assetType, Direction: direction, Amount: amount, Note: note, Reference: reference, CreatedAt: time.Now().UTC()}
	if proposalID > 0 {
		record.ProposalID = proposalID
	}
	return tx.WithContext(ctx).Create(&record).Error
}

func pendingTxFromModel(record *postgresPendingTransactionModel) *models.PendingTransaction {
	return &models.PendingTransaction{ID: record.ID, MemberID: record.MemberID, ProposalID: record.ProposalID, Action: record.Action, TxHash: record.TxHash, WalletAddress: record.WalletAddress, Status: record.Status, RelatedEvent: record.RelatedEvent, RelatedOrder: record.RelatedOrder, ErrorMessage: record.ErrorMessage, ConfirmedBlock: record.ConfirmedBlock, CreatedAt: record.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: record.UpdatedAt.UTC().Format(time.RFC3339)}
}

func (s *PostgresStore) deleteProposalRoundTxGorm(ctx context.Context, tx *gorm.DB, proposalID int64) error {
	if err := tx.WithContext(ctx).Where("proposal_id = ?", proposalID).Delete(&postgresPendingTransactionModel{}).Error; err != nil {
		return err
	}
	var orderIDs []int64
	if err := tx.WithContext(ctx).Model(&postgresOrderModel{}).Where("proposal_id = ?", proposalID).Pluck("id", &orderIDs).Error; err != nil {
		return err
	}
	if len(orderIDs) > 0 {
		if err := tx.WithContext(ctx).Where("order_id IN ?", orderIDs).Delete(&postgresOrderItemModel{}).Error; err != nil {
			return err
		}
	}
	if err := tx.WithContext(ctx).Where("proposal_id = ?", proposalID).Delete(&postgresOrderModel{}).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Where("proposal_id = ?", proposalID).Delete(&postgresVoteModel{}).Error; err != nil {
		return err
	}
	var optionIDs []int64
	if err := tx.WithContext(ctx).Model(&postgresProposalOptionModel{}).Where("proposal_id = ?", proposalID).Pluck("id", &optionIDs).Error; err != nil {
		return err
	}
	if len(optionIDs) > 0 {
		if err := tx.WithContext(ctx).Where("local_option_id IN ?", optionIDs).Delete(&postgresProposalOptionChainMapModel{}).Error; err != nil {
			return err
		}
	}
	if err := tx.WithContext(ctx).Where("proposal_id = ?", proposalID).Delete(&postgresProposalOptionModel{}).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Where("local_proposal_id = ?", proposalID).Delete(&postgresProposalChainMapModel{}).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Where("proposal_id = ?", proposalID).Delete(&postgresChainEventModel{}).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Where("proposal_id = ?", proposalID).Delete(&postgresUsageRecordModel{}).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Where("id = ?", proposalID).Delete(&postgresProposalModel{}).Error; err != nil {
		return err
	}
	return nil
}

func (s *PostgresStore) isEventAppliedTxGorm(ctx context.Context, tx *gorm.DB, txHash string, logIndex uint) (bool, error) {
	var count int64
	err := tx.WithContext(ctx).Model(&postgresAppliedChainEventModel{}).
		Where("tx_hash = ? AND log_index = ?", txHash, logIndex).
		Count(&count).Error
	return count > 0, err
}

func (s *PostgresStore) applyChainEventTxGorm(ctx context.Context, tx *gorm.DB, event *models.ChainEvent) error {
	payload := map[string]any{}
	if err := json.Unmarshal([]byte(event.PayloadJSON), &payload); err != nil {
		return err
	}
	var err error
	switch event.EventName {
	case "ProposalCreated":
		_, err = s.ensureProposalForChainTxGorm(ctx, tx, event.ProposalID, payload)
	case "OptionAdded":
		err = s.applyOptionAddedEventTxGorm(ctx, tx, event.ProposalID, payload, event.TxHash)
	case "Voted":
		err = s.applyVoteEventTxGorm(ctx, tx, event.ProposalID, payload, event.TxHash)
	case "VoteFinalized":
		err = s.applyVoteFinalizedEventTxGorm(ctx, tx, event.ProposalID, payload)
	case "OrderPlaced":
		err = s.applyOrderPlacedEventTxGorm(ctx, tx, event.ProposalID, payload, event.TxHash)
	case "OrderCancelled":
		err = s.applyOrderCancelledEventTxGorm(ctx, tx, event.ProposalID, payload)
	case "ProposalSettled":
		var localProposalID int64
		localProposalID, err = s.localProposalIDByChainTxGorm(ctx, tx, event.ProposalID)
		if err == nil {
			err = tx.WithContext(ctx).Model(&postgresProposalModel{}).Where("id = ?", localProposalID).Update("rewards_applied", true).Error
		}
	case "RewardAllocated":
		err = s.applyRewardAllocatedEventTxGorm(ctx, tx, payload, event.TxHash)
	case "SubscriptionPaid":
		err = s.applySubscriptionPaidEventTxGorm(ctx, tx, payload, event.TxHash)
	default:
		err = nil
	}
	if err != nil {
		return err
	}
	return s.matchPendingTransactionTxGorm(ctx, tx, event)
}

func (s *PostgresStore) matchPendingTransactionTxGorm(ctx context.Context, tx *gorm.DB, event *models.ChainEvent) error {
	actionByEvent := map[string]string{
		"ProposalCreated":  "create_proposal",
		"OptionAdded":      "add_option",
		"Voted":            "vote",
		"OrderPlaced":      "place_order",
		"OrderCancelled":   "cancel_order",
		"ProposalSettled":  "settle_proposal",
		"SubscriptionPaid": "subscribe",
	}
	action, ok := actionByEvent[event.EventName]
	if !ok {
		return nil
	}
	return tx.WithContext(ctx).
		Model(&postgresPendingTransactionModel{}).
		Where("tx_hash = ? AND action = ?", event.TxHash, action).
		Updates(map[string]any{
			"status":          "confirmed",
			"related_event":   event.EventName,
			"confirmed_block": event.BlockNumber,
			"updated_at":      time.Now().UTC(),
		}).Error
}

func (s *PostgresStore) ensureProposalForChainTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64, payload map[string]any) (int64, error) {
	if localID, err := s.localProposalIDByChainTxGorm(ctx, tx, chainProposalID); err == nil {
		return localID, nil
	}
	creatorID, creatorName, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "creator"))
	if err != nil {
		return 0, err
	}
	proposalDeadlineUnix := getInt64(payload, "proposalDeadline")
	voteDeadlineUnix := getInt64(payload, "voteDeadline")
	orderDeadlineUnix := getInt64(payload, "orderDeadline")
	proposalDeadline := time.Unix(proposalDeadlineUnix, 0).UTC()
	if proposalDeadlineUnix <= 0 {
		proposalDeadline = time.Now().UTC()
	}
	voteDeadline := time.Unix(voteDeadlineUnix, 0).UTC()
	if voteDeadlineUnix <= 0 {
		voteDeadline = proposalDeadline.Add(30 * time.Minute)
	}
	orderDeadline := time.Unix(orderDeadlineUnix, 0).UTC()
	if orderDeadlineUnix <= 0 {
		orderDeadline = voteDeadline.Add(30 * time.Minute)
	}
	proposalDate := proposalDeadline.In(repositoryBusinessLocation()).Format("2006-01-02")
	row := postgresProposalModel{
		Title:            fmt.Sprintf("Chain Proposal #%d", chainProposalID),
		Description:      "Imported from on-chain ProposalCreated event",
		MerchantGroup:    "chain-import",
		MealPeriod:       "lunch",
		ProposalDate:     proposalDate,
		MaxOptions:       5,
		CreatedBy:        creatorID,
		CreatedByName:    creatorName,
		ProposalDeadline: proposalDeadline,
		VoteDeadline:     voteDeadline,
		OrderDeadline:    orderDeadline,
		CreatedAt:        time.Now().UTC(),
	}
	if err := tx.WithContext(ctx).Create(&row).Error; err != nil {
		return 0, err
	}
	if err := tx.WithContext(ctx).Create(&postgresProposalChainMapModel{
		LocalProposalID: row.ID,
		ChainProposalID: chainProposalID,
	}).Error; err != nil {
		return 0, err
	}
	return row.ID, nil
}

func (s *PostgresStore) ensureOptionForChainTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64, payload map[string]any) (int64, error) {
	localProposalID, err := s.ensureProposalForChainTxGorm(ctx, tx, chainProposalID, payload)
	if err != nil {
		return 0, err
	}
	chainOptionIndex := getInt64(payload, "optionIndex")
	if localOptionID, err := s.localOptionIDByChainTxGorm(ctx, tx, localProposalID, chainOptionIndex); err == nil {
		return localOptionID, nil
	}
	merchantID := getString(payload, "merchantId")
	merchantName := merchantID
	var merchant postgresMerchantModel
	if err := tx.WithContext(ctx).First(&merchant, "id = ?", merchantID).Error; err == nil {
		merchantName = merchant.Name
	}
	proposerID, proposerName, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "proposer"))
	if err != nil {
		return 0, err
	}
	option := postgresProposalOptionModel{
		ProposalID:       localProposalID,
		MerchantID:       merchantID,
		MerchantName:     merchantName,
		ProposerMemberID: proposerID,
		ProposerName:     proposerName,
		TokenStake:       normalizeTokenAmountValue(payload, "cost"),
		CreatedAt:        time.Now().UTC(),
	}
	if err := tx.WithContext(ctx).Create(&option).Error; err != nil {
		return 0, err
	}
	if err := tx.WithContext(ctx).Create(&postgresProposalOptionChainMapModel{
		LocalOptionID:    option.ID,
		LocalProposalID:  localProposalID,
		ChainOptionIndex: chainOptionIndex,
	}).Error; err != nil {
		return 0, err
	}
	return option.ID, nil
}

func (s *PostgresStore) applyOptionAddedEventTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64, payload map[string]any, txHash string) error {
	localOptionID, err := s.ensureOptionForChainTxGorm(ctx, tx, chainProposalID, payload)
	if err != nil {
		return err
	}
	localProposalID, err := s.localProposalIDByChainTxGorm(ctx, tx, chainProposalID)
	if err != nil {
		return err
	}
	memberID, _, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "proposer"))
	if err != nil {
		return err
	}
	tokenCost := normalizeTokenAmountValue(payload, "cost")
	if tokenCost <= 0 {
		return nil
	}
	return s.logUsageTxGorm(ctx, tx, memberID, localProposalID, "add_option", "token", "debit", fmt.Sprintf("%d", tokenCost), "鏈上提名候選店家", fmt.Sprintf("%s:option:%d", txHash, localOptionID))
}

func (s *PostgresStore) applyVoteEventTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64, payload map[string]any, txHash string) error {
	localProposalID, err := s.ensureProposalForChainTxGorm(ctx, tx, chainProposalID, payload)
	if err != nil {
		return err
	}
	localOptionID, err := s.ensureOptionForChainTxGorm(ctx, tx, chainProposalID, payload)
	if err != nil {
		return err
	}
	memberID, memberName, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "voter"))
	if err != nil {
		return err
	}
	tokenAmount := normalizeTokenAmountValue(payload, "tokenAmount")
	weight := normalizeTokenAmountValue(payload, "weight")
	if err := tx.WithContext(ctx).Model(&postgresProposalOptionModel{}).Where("id = ?", localOptionID).Update("weighted_votes", gorm.Expr("weighted_votes + ?", weight)).Error; err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Create(&postgresVoteModel{
		ProposalID:   localProposalID,
		MemberID:     memberID,
		MemberName:   memberName,
		OptionID:     localOptionID,
		TokenAmount:  tokenAmount,
		VoteWeight:   weight,
		SubmittedAt:  time.Now().UTC(),
		WalletHidden: true,
	}).Error; err != nil {
		return err
	}
	return s.logUsageTxGorm(ctx, tx, memberID, localProposalID, "vote", "token", "debit", fmt.Sprintf("%d", tokenAmount), "鏈上投票", txHash)
}

func (s *PostgresStore) applyVoteFinalizedEventTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64, payload map[string]any) error {
	localProposalID, err := s.ensureProposalForChainTxGorm(ctx, tx, chainProposalID, payload)
	if err != nil {
		return err
	}
	localOptionID, err := s.ensureOptionForChainTxGorm(ctx, tx, chainProposalID, map[string]any{
		"proposalId":  chainProposalID,
		"optionIndex": getInt64(payload, "winnerOptionIndex"),
		"merchantId":  getString(payload, "merchantId"),
		"proposer":    "",
		"cost":        0,
	})
	if err != nil {
		return err
	}
	if err := tx.WithContext(ctx).Model(&postgresProposalModel{}).Where("id = ?", localProposalID).Update("winner_option_id", localOptionID).Error; err != nil {
		return err
	}
	return tx.WithContext(ctx).Model(&postgresProposalOptionModel{}).Where("id = ?", localOptionID).Update("weighted_votes", normalizeTokenAmountValue(payload, "weightedVotes")).Error
}

func (s *PostgresStore) applyOrderPlacedEventTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64, payload map[string]any, txHash string) error {
	localProposalID, err := s.ensureProposalForChainTxGorm(ctx, tx, chainProposalID, payload)
	if err != nil {
		return err
	}
	memberID, memberName, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "member"))
	if err != nil {
		return err
	}
	orderHash := getString(payload, "orderHash")
	amount := getDecimalString(payload, "amount")
	var existing postgresOrderModel
	err = tx.WithContext(ctx).Where("proposal_id = ? AND order_hash = ?", localProposalID, orderHash).First(&existing).Error
	if err == nil {
		if err := tx.WithContext(ctx).Model(&postgresOrderModel{}).Where("id = ?", existing.ID).Update("status", "paid_onchain").Error; err != nil {
			return err
		}
		return s.logUsageTxGorm(ctx, tx, memberID, localProposalID, "place_order", "native", "debit", amount, "鏈上點餐支付", txHash)
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	merchantID := ""
	var proposal postgresProposalModel
	if err := tx.WithContext(ctx).First(&proposal, "id = ?", localProposalID).Error; err == nil && proposal.WinnerOptionID > 0 {
		var winner postgresProposalOptionModel
		if err := tx.WithContext(ctx).First(&winner, "id = ?", proposal.WinnerOptionID).Error; err == nil {
			merchantID = winner.MerchantID
		}
	}
	order := postgresOrderModel{
		ProposalID:         localProposalID,
		MemberID:           memberID,
		MemberName:         memberName,
		MerchantID:         merchantID,
		OrderHash:          orderHash,
		AmountWei:          amount,
		Status:             "paid_onchain",
		SignatureAmountWei: amount,
		CreatedAt:          time.Now().UTC(),
	}
	if err := tx.WithContext(ctx).Create(&order).Error; err != nil {
		return err
	}
	return s.logUsageTxGorm(ctx, tx, memberID, localProposalID, "place_order", "native", "debit", amount, "鏈上點餐支付", txHash)
}

func (s *PostgresStore) applyOrderCancelledEventTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64, payload map[string]any) error {
	localProposalID, err := s.ensureProposalForChainTxGorm(ctx, tx, chainProposalID, payload)
	if err != nil {
		return err
	}
	memberID, _, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "member"))
	if err != nil {
		return err
	}
	return tx.WithContext(ctx).Model(&postgresOrderModel{}).
		Where("proposal_id = ? AND member_id = ?", localProposalID, memberID).
		Update("status", "cancelled_onchain").Error
}

func (s *PostgresStore) applyRewardAllocatedEventTxGorm(ctx context.Context, tx *gorm.DB, payload map[string]any, txHash string) error {
	memberID, _, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "member"))
	if err != nil {
		return err
	}
	amount := normalizeTokenAmountValue(payload, "amount")
	rewardType := getString(payload, "rewardType")
	if rewardType != "winner_proposer" && rewardType != "loser_refund" {
		return nil
	}
	if err := tx.WithContext(ctx).Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("token_balance", gorm.Expr("token_balance + ?", amount)).Error; err != nil {
		return err
	}
	return s.logUsageTxGorm(ctx, tx, memberID, 0, "settlement_reward", "token", "credit", fmt.Sprintf("%d", amount), rewardType, txHash)
}

func (s *PostgresStore) applySubscriptionPaidEventTxGorm(ctx context.Context, tx *gorm.DB, payload map[string]any, txHash string) error {
	memberID, _, err := s.ensureMemberForWalletTxGorm(ctx, tx, getString(payload, "member"))
	if err != nil {
		return err
	}
	expiresAtUnix := getInt64(payload, "expiresAt")
	expiresAt := time.Unix(expiresAtUnix, 0).UTC()
	if expiresAtUnix <= 0 {
		expiresAt = time.Now().UTC().Add(30 * 24 * time.Hour)
	}
	if err := tx.WithContext(ctx).Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("subscription_expires_at", expiresAt).Error; err != nil {
		return err
	}
	return s.logUsageTxGorm(ctx, tx, memberID, 0, "subscribe", "token", "debit", fmt.Sprintf("%d", normalizeTokenAmountValue(payload, "amount")), "鏈上月訂閱", txHash)
}

func (s *PostgresStore) localProposalIDByChainTxGorm(ctx context.Context, tx *gorm.DB, chainProposalID int64) (int64, error) {
	var mapping postgresProposalChainMapModel
	if err := tx.WithContext(ctx).First(&mapping, "chain_proposal_id = ?", chainProposalID).Error; err != nil {
		return 0, err
	}
	return mapping.LocalProposalID, nil
}

func (s *PostgresStore) localOptionIDByChainTxGorm(ctx context.Context, tx *gorm.DB, localProposalID, chainOptionIndex int64) (int64, error) {
	var mapping postgresProposalOptionChainMapModel
	if err := tx.WithContext(ctx).First(&mapping, "local_proposal_id = ? AND chain_option_index = ?", localProposalID, chainOptionIndex).Error; err != nil {
		return 0, err
	}
	return mapping.LocalOptionID, nil
}

func (s *PostgresStore) ensureMemberForWalletTxGorm(ctx context.Context, tx *gorm.DB, wallet string) (int64, string, error) {
	wallet = strings.TrimSpace(wallet)
	if wallet == "" {
		wallet = "0x0000000000000000000000000000000000000000"
	}
	var member postgresMemberModel
	err := tx.WithContext(ctx).Where("LOWER(wallet_address) = LOWER(?)", wallet).First(&member).Error
	if err == nil {
		return member.ID, member.DisplayName, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, "", err
	}
	displayName := shortWalletLabel(wallet)
	avatarURL := fmt.Sprintf("https://api.dicebear.com/9.x/shapes/svg?seed=%s", displayName)
	email := fmt.Sprintf("%s@chain.local", strings.ToLower(strings.TrimPrefix(wallet, "0x")))
	member = postgresMemberModel{
		Email:         email,
		DisplayName:   displayName,
		AvatarURL:     avatarURL,
		WalletAddress: &wallet,
		CreatedAt:     time.Now().UTC(),
	}
	if err := tx.WithContext(ctx).Create(&member).Error; err != nil {
		if lookupErr := tx.WithContext(ctx).Where("LOWER(wallet_address) = LOWER(?)", wallet).First(&member).Error; lookupErr == nil {
			return member.ID, member.DisplayName, nil
		}
		return 0, "", err
	}
	if _, err := assignRandomRegistrationInviteCode(tx, member.ID); err != nil {
		return 0, "", err
	}
	return member.ID, displayName, nil
}

func assignRandomRegistrationInviteCode(tx *gorm.DB, memberID int64) (string, error) {
	for attempt := 0; attempt < 8; attempt++ {
		inviteCode, err := newRegistrationInviteCode()
		if err != nil {
			return "", err
		}
		err = tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Update("registration_invite_code", inviteCode).Error
		if err == nil {
			return inviteCode, nil
		}
		if isDuplicateKeyError(err) {
			continue
		}
		return "", err
	}
	return "", fmt.Errorf("failed to generate unique registration invite code")
}

func (s *PostgresStore) seedMerchants() error {
	ctx := context.Background()
	var count int64
	if err := s.db.WithContext(ctx).Model(&postgresMerchantModel{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	type merchantSeed struct {
		id, name, groupName, payout string
		menu                        []models.MenuItem
	}
	seeds := []merchantSeed{
		{id: "shop-hotpot", name: "湯潮火鍋", groupName: "taipei-xinyi", payout: "0x00000000000000000000000000000000000000A1", menu: []models.MenuItem{{ID: "hotpot-set", Name: "雙人火鍋套餐", PriceWei: 4200000000000000, Description: "牛五花、蔬菜盤、王子麵"}, {ID: "fish-ball", Name: "手工魚餃", PriceWei: 900000000000000, Description: "單點加料"}}},
		{id: "shop-bento", name: "午間便當室", groupName: "taipei-xinyi", payout: "0x00000000000000000000000000000000000000A2", menu: []models.MenuItem{{ID: "bento-chicken", Name: "鹽烤雞腿便當", PriceWei: 1400000000000000, Description: "雞腿、三樣配菜、熱湯"}, {ID: "bento-pork", Name: "招牌排骨便當", PriceWei: 1250000000000000, Description: "排骨、三樣配菜、熱湯"}}},
		{id: "shop-salad", name: "輕禾沙拉所", groupName: "taipei-xinyi", payout: "0x00000000000000000000000000000000000000A3", menu: []models.MenuItem{{ID: "salad-caesar", Name: "凱薩雞肉沙拉", PriceWei: 1100000000000000, Description: "舒肥雞胸與奶香凱薩醬"}, {ID: "salad-yuzu", Name: "柚香鮭魚沙拉", PriceWei: 1600000000000000, Description: "挪威鮭魚、柚香油醋醬"}}},
		{id: "shop-nangang-bowl", name: "南港能量餐盒", groupName: "taipei-nangang", payout: "0x00000000000000000000000000000000000000B1", menu: []models.MenuItem{{ID: "bowl-chicken", Name: "舒肥雞胸能量盒", PriceWei: 1380000000000000, Description: "雞胸、時蔬、藜麥飯"}, {ID: "bowl-beef", Name: "炙燒牛肉能量盒", PriceWei: 1520000000000000, Description: "牛肉、地瓜、時蔬"}}},
		{id: "shop-nangang-ramen", name: "程式拉麵研究所", groupName: "taipei-nangang", payout: "0x00000000000000000000000000000000000000B2", menu: []models.MenuItem{{ID: "ramen-tonkotsu", Name: "濃厚豚骨拉麵", PriceWei: 2050000000000000, Description: "叉燒、糖心蛋、木耳"}, {ID: "ramen-spicy", Name: "赤辛味噌拉麵", PriceWei: 2180000000000000, Description: "辣味噌、叉燒、蔥花"}}},
		{id: "shop-songshan-curry", name: "松山咖哩製造所", groupName: "taipei-songshan", payout: "0x00000000000000000000000000000000000000C1", menu: []models.MenuItem{{ID: "curry-chicken", Name: "香料雞腿咖哩", PriceWei: 1460000000000000, Description: "雞腿排、香料咖哩、時蔬"}, {ID: "curry-pork", Name: "厚切豬排咖哩", PriceWei: 1580000000000000, Description: "豬排、香料咖哩、溏心蛋"}}},
		{id: "shop-songshan-bbq", name: "夜場串燒局", groupName: "taipei-songshan", payout: "0x00000000000000000000000000000000000000C2", menu: []models.MenuItem{{ID: "bbq-set", Name: "串燒拼盤", PriceWei: 2480000000000000, Description: "雞腿串、豬五花、甜不辣"}, {ID: "bbq-rice", Name: "炭烤牛肉丼", PriceWei: 2120000000000000, Description: "炭烤牛肉、溫泉蛋、蔥鹽"}}},
		{id: "shop-dintaifung-101", name: "鼎泰豐 台北101店", groupName: "taipei-xinyi", payout: "0x00000000000000000000000000000000000000D1", menu: []models.MenuItem{{ID: "dtf-xiaolongbao", Name: "小籠包", PriceWei: 2200000000000000, Description: "經典原味小籠包 10入"}, {ID: "dtf-sour-spicy-soup", Name: "酸辣湯", PriceWei: 800000000000000, Description: "濃郁酸辣湯"}, {ID: "dtf-crab-xiaolongbao", Name: "蟹粉小籠包", PriceWei: 2800000000000000, Description: "升級版蟹粉小籠包"}}},
		{id: "shop-starbucks-station", name: "星巴克 台北車站店", groupName: "taipei-zhongzheng", payout: "0x00000000000000000000000000000000000000D2", menu: []models.MenuItem{{ID: "sb-latte", Name: "拿鐵咖啡", PriceWei: 1500000000000000, Description: "經典拿鐵 中杯"}, {ID: "sb-croissant", Name: "巧克力可頌", PriceWei: 950000000000000, Description: "新鮮出爐可頌"}}},
		{id: "shop-yifang-fruit-tea", name: "一芳水果茶", groupName: "taipei-daan", payout: "0x00000000000000000000000000000000000000D3", menu: []models.MenuItem{{ID: "yf-mango-green-tea", Name: "芒果綠茶", PriceWei: 850000000000000, Description: "新鮮芒果 + 綠茶"}, {ID: "yf-strawberry-fruit-tea", Name: "草莓果茶", PriceWei: 900000000000000, Description: "季節限定草莓果茶"}}},
		{id: "shop-xiang-buffet", name: "饗食天堂 台北店", groupName: "taipei-zhongshan", payout: "0x00000000000000000000000000000000000000D4", menu: []models.MenuItem{{ID: "xi-sashimi-platter", Name: "生魚片拼盤", PriceWei: 4500000000000000, Description: "新鮮生魚片組合"}}},
		{id: "shop-mr-steak", name: "牛排先生", groupName: "taipei-songshan", payout: "0x00000000000000000000000000000000000000D5", menu: []models.MenuItem{{ID: "ms-new-york-steak", Name: "紐約客牛排", PriceWei: 6500000000000000, Description: "8oz 紐約客牛排"}}},
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, seed := range seeds {
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&postgresMerchantModel{ID: seed.id, Name: seed.name, MerchantGroup: seed.groupName, PayoutAddress: seed.payout}).Error; err != nil {
				return err
			}
			for _, item := range seed.menu {
				row := postgresMenuItemModel{MerchantID: seed.id, ItemID: item.ID, Name: item.Name, PriceWei: item.PriceWei, Description: item.Description}
				if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (s *PostgresStore) seedDemoData() error {
	const defaultTokens = int64(300)
	avatarFor := func(name string) string {
		return fmt.Sprintf("https://api.dicebear.com/9.x/shapes/svg?seed=%s", name)
	}
	insertMember := func(email, displayName string, isAdmin bool) (int64, error) {
		hash := legacyPasswordHash("demo1234")
		return s.CreateMember(email, hash, displayName, isAdmin, defaultTokens, avatarFor(displayName))
	}

	aliceID, err := insertMember("alice@example.com", "Alice", true)
	if err != nil {
		return err
	}
	bobID, err := insertMember("bob@example.com", "Bob", false)
	if err != nil {
		return err
	}
	carolID, err := insertMember("carol@example.com", "Carol", false)
	if err != nil {
		return err
	}

	if err := s.UpdateMemberWallet(aliceID, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); err != nil {
		return err
	}
	if err := s.UpdateMemberWallet(bobID, "0xca58948542843E4Ca9EE4062d9a317c4Bea45CAa"); err != nil {
		return err
	}
	if err := s.UpdateMemberWallet(carolID, "0xe921bd1E07735b9Eee467A6494436a7e4d5A2dbE"); err != nil {
		return err
	}

	now := time.Now().UTC()
	proposal, err := s.CreateProposal(aliceID, "今晚吃什麼", "信義區晚餐局", "all", "dinner", now.In(repositoryBusinessLocation()).Format("2006-01-02"), 5, "Alice",
		now.Add(30*time.Minute),
		now.Add(75*time.Minute),
		now.Add(135*time.Minute),
	)
	if err != nil {
		return err
	}

	if _, err := s.InsertProposalOption(proposal.ID, aliceID, "shop-hotpot", "湯潮火鍋", "Alice", 10, false); err != nil {
		return err
	}
	if _, err := s.InsertProposalOption(proposal.ID, bobID, "shop-bento", "午間便當室", "Bob", 10, false); err != nil {
		return err
	}
	return nil
}
