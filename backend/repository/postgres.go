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
	ClaimableProposalTickets int64   `gorm:"not null;default:0"`
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

type postgresFaucetClaimModel struct {
	ID            int64     `gorm:"primaryKey"`
	MemberID      int64     `gorm:"not null;uniqueIndex"`
	WalletAddress *string   `gorm:"index"`
	ClaimedAt     time.Time `gorm:"not null"`
}

func (postgresFaucetClaimModel) TableName() string { return "faucet_claims" }

type postgresMerchantModel struct {
	ID            string `gorm:"primaryKey"`
	Name          string `gorm:"not null"`
	MerchantGroup string `gorm:"not null;index"`
	PayoutAddress string `gorm:"not null"`
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

type postgresProposalModel struct {
	ID               int64     `gorm:"primaryKey"`
	Title            string    `gorm:"not null"`
	Description      string    `gorm:"not null"`
	MerchantGroup    string    `gorm:"not null"`
	MealPeriod       string    `gorm:"not null;default:lunch;uniqueIndex:idx_proposals_group_period_date_unique"`
	ProposalDate     string    `gorm:"not null;uniqueIndex:idx_proposals_group_period_date_unique"`
	MaxOptions       int64     `gorm:"not null;default:5"`
	CreatedBy        int64     `gorm:"not null;index"`
	CreatedByName    string    `gorm:"not null"`
	ProposalDeadline time.Time `gorm:"not null"`
	VoteDeadline     time.Time `gorm:"not null"`
	OrderDeadline    time.Time `gorm:"not null"`
	WinnerOptionID   int64     `gorm:"not null;default:0"`
	RewardsApplied   bool      `gorm:"not null;default:false"`
	GroupID          *int64    `gorm:"uniqueIndex:idx_proposals_group_period_date_unique"`
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
}

func (postgresOrderModel) TableName() string { return "orders" }

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
	return s.db.AutoMigrate(
		&postgresMemberModel{},
		&postgresSessionModel{},
		&postgresWalletAuthChallengeModel{},
		&postgresGroupModel{},
		&postgresGroupMembershipModel{},
		&postgresGroupInviteModel{},
		&postgresFaucetClaimModel{},
		&postgresMerchantModel{},
		&postgresMenuItemModel{},
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
	)
}

func (s *PostgresStore) SetInactiveGroupThresholdDays(days int64) {
	if days > 0 {
		s.inactiveGroupThresholdDays = days
	}
}

func (s *PostgresStore) ContractInfo() models.ContractInfo { return s.contractInfo }

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
			ProposalTicketCount:      0,
			ClaimableProposalTickets: 0,
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

func (s *PostgresStore) ClaimTickets(memberID int64) (proposalTickets int64, err error) {
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
		if proposalTickets == 0 {
			return errors.New("no claimable tickets")
		}
		return tx.Model(&postgresMemberModel{}).Where("id = ?", memberID).Updates(map[string]any{
			"proposal_ticket_count":      gorm.Expr("proposal_ticket_count + ?", proposalTickets),
			"claimable_proposal_tickets": 0,
		}).Error
	})
	return proposalTickets, err
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
	if err := s.db.WithContext(ctx).Model(&postgresVoteModel{}).Where("member_id = ?", memberID).Count(&votesCast).Error; err != nil {
		return 0, 0, 0, err
	}
	return proposalsCreated, 0, votesCast, nil
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

func (s *PostgresStore) CreateProposalWithCredit(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	ctx := context.Background()
	var proposal postgresProposalModel
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, proposalTokenCost).Update("token_balance", gorm.Expr("token_balance - ?", proposalTokenCost))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("insufficient token balance")
		}
		if maxOptions <= 0 {
			maxOptions = 5
		}
		if mealPeriod == "" {
			mealPeriod = "lunch"
		}
		proposal = postgresProposalModel{Title: title, Description: description, MerchantGroup: merchantGroup, MealPeriod: mealPeriod, ProposalDate: proposalDate, MaxOptions: maxOptions, CreatedBy: memberID, CreatedByName: createdByName, ProposalDeadline: proposalDeadline.UTC(), VoteDeadline: voteDeadline.UTC(), OrderDeadline: orderDeadline.UTC(), CreatedAt: time.Now().UTC()}
		if err := tx.Create(&proposal).Error; err != nil {
			if isDuplicateKeyError(err) {
				return ErrDuplicateProposalRound
			}
			return err
		}
		return s.logUsageTxGorm(ctx, tx, memberID, proposal.ID, "create_proposal", "token", "debit", fmt.Sprintf("%d", proposalTokenCost), "建立提案輪次", "")
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

func (s *PostgresStore) InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64) (*models.ProposalOption, error) {
	ctx := context.Background()
	var option postgresProposalOptionModel
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		actualTokenCost := tokenCost
		var member postgresMemberModel
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&member, "id = ?", memberID).Error; err != nil {
			return err
		}
		if member.ProposalTicketCount > 0 {
			if err := tx.Model(&postgresMemberModel{}).Where("id = ? AND proposal_ticket_count > 0", memberID).Update("proposal_ticket_count", gorm.Expr("proposal_ticket_count - 1")).Error; err != nil {
				return err
			}
			actualTokenCost = 0
		} else {
			res := tx.Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, tokenCost).Update("token_balance", gorm.Expr("token_balance - ?", tokenCost))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return errors.New("insufficient token balance")
			}
		}
		option = postgresProposalOptionModel{ProposalID: proposalID, MerchantID: merchantID, MerchantName: merchantName, ProposerMemberID: memberID, ProposerName: proposerName, WeightedVotes: 0, TokenStake: actualTokenCost, CreatedAt: time.Now().UTC()}
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

func (s *PostgresStore) RecordVote(proposalID, memberID, optionID int64, tokenAmount int64, memberDisplayName string) error {
	ctx := context.Background()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&postgresMemberModel{}).Where("id = ? AND token_balance >= ?", memberID, tokenAmount).Update("token_balance", gorm.Expr("token_balance - ?", tokenAmount))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("insufficient token balance")
		}
		if err := tx.Model(&postgresProposalOptionModel{}).Where("id = ?", optionID).Update("weighted_votes", gorm.Expr("weighted_votes + ?", tokenAmount)).Error; err != nil {
			return err
		}
		if err := tx.Create(&postgresVoteModel{ProposalID: proposalID, MemberID: memberID, MemberName: memberDisplayName, OptionID: optionID, TokenAmount: tokenAmount, VoteWeight: tokenAmount, SubmittedAt: time.Now().UTC(), WalletHidden: true}).Error; err != nil {
			if isDuplicateKeyError(err) {
				return ErrDuplicateVote
			}
			return err
		}
		return s.logUsageTxGorm(ctx, tx, memberID, proposalID, "vote", "token", "debit", fmt.Sprintf("%d", tokenAmount), "投票加權", fmt.Sprintf("option:%d", optionID))
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
		status := "awaiting_wallet_payment"
		if sig.Signature == "" && sig.SignerAddress == "" && sig.ContractAddress == "" && sig.TokenAddress == "" {
			status = "paid_local"
		}
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
		if order.Status == "paid_local" {
			return s.logUsageTxGorm(ctx, tx, memberID, proposalID, "place_order", "native", "debit", sig.AmountWei, "本地點餐支付", sig.OrderHash)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	result := &models.Order{
		ID:         order.ID,
		ProposalID: order.ProposalID,
		MemberID:   order.MemberID,
		MemberName: order.MemberName,
		MerchantID: order.MerchantID,
		OrderHash:  order.OrderHash,
		AmountWei:  order.AmountWei,
		Status:     order.Status,
		Items:      items,
		CreatedAt:  order.CreatedAt.UTC(),
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

func (s *PostgresStore) GetMerchant(id string) (*models.Merchant, error) {
	ctx := context.Background()
	var merchant postgresMerchantModel
	if err := s.db.WithContext(ctx).First(&merchant, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("merchant not found")
		}
		return nil, err
	}
	var menuRows []postgresMenuItemModel
	if err := s.db.WithContext(ctx).Where("merchant_id = ?", id).Order("id ASC").Find(&menuRows).Error; err != nil {
		return nil, err
	}
	result := &models.Merchant{ID: merchant.ID, Name: merchant.Name, Group: merchant.MerchantGroup, PayoutAddress: merchant.PayoutAddress}
	for _, item := range menuRows {
		result.Menu = append(result.Menu, &models.MenuItem{ID: item.ItemID, Name: item.Name, PriceWei: item.PriceWei, Description: item.Description})
	}
	return result, nil
}

func (s *PostgresStore) ListMerchants() ([]*models.Merchant, error) {
	ctx := context.Background()
	var rows []postgresMerchantModel
	if err := s.db.WithContext(ctx).Order("name ASC, id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	merchants := make([]*models.Merchant, 0, len(rows))
	for _, row := range rows {
		merchants = append(merchants, &models.Merchant{
			ID:            row.ID,
			Name:          row.Name,
			Group:         row.MerchantGroup,
			PayoutAddress: row.PayoutAddress,
			Menu:          []*models.MenuItem{},
		})
	}
	return merchants, nil
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
		PayoutAddress: payout,
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "merchant_group", "payout_address"}),
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

func (s *PostgresStore) AddMember(groupID, memberID int64) error {
	ctx := context.Background()
	entry := postgresGroupMembershipModel{GroupID: groupID, MemberID: memberID, JoinedAt: time.Now().UTC()}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&entry).Error
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

func (s *PostgresStore) IsMember(groupID, memberID int64) (bool, error) {
	ctx := context.Background()
	if err := s.PruneInactiveGroups(ctx); err != nil {
		return false, err
	}
	var count int64
	err := s.db.WithContext(ctx).Model(&postgresGroupMembershipModel{}).Where("group_id = ? AND member_id = ?", groupID, memberID).Count(&count).Error
	return count > 0, err
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
		items = append(items, &models.Group{ID: row.ID, Name: row.Name, Description: row.Description, OwnerMemberID: row.OwnerMemberID, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)})
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
	err := s.db.WithContext(ctx).Model(&postgresProposalModel{}).Where("id = ?", proposalID).Update("group_id", groupID).Error
	if err != nil && isDuplicateKeyError(err) {
		return ErrDuplicateProposalRound
	}
	return err
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
	result := &models.Member{ID: member.ID, Email: member.Email, PasswordHash: member.PasswordHash, DisplayName: member.DisplayName, AvatarURL: member.AvatarURL, IsAdmin: member.IsAdmin, Points: member.Points, TokenBalance: member.TokenBalance, ProposalTicketCount: member.ProposalTicketCount, ClaimableProposalTickets: member.ClaimableProposalTickets, CreatedAt: member.CreatedAt.UTC()}
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
		MemberID    int64
		DisplayName string
		JoinedAt    time.Time
	}
	var rows []row
	if err := s.db.WithContext(ctx).Table("group_memberships gm").Select("gm.member_id, m.display_name, gm.joined_at").Joins("JOIN members m ON m.id = gm.member_id").Where("gm.group_id = ?", groupID).Order("gm.joined_at ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	members := make([]*models.GroupMember, 0, len(rows))
	for _, row := range rows {
		members = append(members, &models.GroupMember{MemberID: row.MemberID, DisplayName: row.DisplayName, JoinedAt: row.JoinedAt.UTC().Format(time.RFC3339)})
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
	return &models.GroupInvite{ID: invite.ID, GroupID: invite.GroupID, InviteCode: invite.InviteCode, CreatedBy: invite.CreatedBy, CreatedAt: invite.CreatedAt.UTC().Format(time.RFC3339)}
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
		order := &models.Order{
			ID:         row.ID,
			ProposalID: row.ProposalID,
			MemberID:   row.MemberID,
			MemberName: row.MemberName,
			MerchantID: row.MerchantID,
			OrderHash:  row.OrderHash,
			AmountWei:  row.AmountWei,
			Status:     row.Status,
			CreatedAt:  row.CreatedAt.UTC(),
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

	if _, err := s.InsertProposalOption(proposal.ID, aliceID, "shop-hotpot", "湯潮火鍋", "Alice", 10); err != nil {
		return err
	}
	if _, err := s.InsertProposalOption(proposal.ID, bobID, "shop-bento", "午間便當室", "Bob", 10); err != nil {
		return err
	}
	return nil
}
