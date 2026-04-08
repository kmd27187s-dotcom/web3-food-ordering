package repository

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"mealvoting/backend/internal/models"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

// isDuplicateKeyError returns true if the error is a PostgreSQL unique_violation (code 23505).
func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func newRegistrationInviteCode() (string, error) {
	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "invite-" + strings.ToLower(fmt.Sprintf("%x", bytes)), nil
}

func deriveStatus(proposal *models.Proposal) string {
	now := time.Now().UTC()
	if proposal.FailedReason == "cancelled_by_creator" {
		return "cancelled"
	}
	if proposal.RewardsApplied && proposal.TotalVoteCount == 0 && proposal.FailedReason == "no_votes_cast" {
		return "failed"
	}
	switch compareProposalDate(proposal.ProposalDate) {
	case -1:
		if proposal.RewardsApplied {
			if proposal.FailedReason == "no_votes_cast" {
				return "failed"
			}
			return "settled"
		}
		return "settled"
	case 1:
		return "upcoming"
	}
	switch {
	case now.Before(proposal.ProposalDeadline):
		return "proposing"
	case now.Before(proposal.VoteDeadline):
		return "voting"
	case now.Before(proposal.OrderDeadline):
		if proposal.FailedReason == "no_votes_cast" {
			return "failed"
		}
		return "ordering"
	default:
		if proposal.FailedReason == "no_votes_cast" {
			return "failed"
		}
		if proposal.RewardsApplied || proposal.WinnerOptionID > 0 {
			return "settled"
		}
		return "awaiting_settlement"
	}
}

func isCurrentProposalDay(proposalDate string) bool {
	if proposalDate == "" {
		return false
	}
	nowLocal := time.Now().In(repositoryBusinessLocation()).Format("2006-01-02")
	return proposalDate == nowLocal
}

func compareProposalDate(proposalDate string) int {
	if proposalDate == "" {
		return -1
	}
	today := time.Now().In(repositoryBusinessLocation()).Format("2006-01-02")
	switch {
	case proposalDate < today:
		return -1
	case proposalDate > today:
		return 1
	default:
		return 0
	}
}

func shouldAutoSettleLocalProposal(proposal *models.Proposal) bool {
	if proposal == nil || proposal.RewardsApplied {
		return false
	}
	if !isCurrentProposalDay(proposal.ProposalDate) {
		return false
	}
	return !time.Now().UTC().Before(proposal.VoteDeadline)
}

func shouldCountOrderInRoundTotal(status string) bool {
	return !strings.HasPrefix(strings.ToLower(strings.TrimSpace(status)), "cancelled")
}

func sumProposalOrderAmounts(orders []*models.Order) string {
	total := big.NewInt(0)
	for _, order := range orders {
		if order == nil || !shouldCountOrderInRoundTotal(order.Status) {
			continue
		}
		value := strings.TrimSpace(order.AmountWei)
		if value == "" {
			continue
		}
		amount, ok := new(big.Int).SetString(value, 10)
		if !ok {
			continue
		}
		total.Add(total, amount)
	}
	return total.String()
}

func countCountedOrders(orders []*models.Order) int64 {
	var count int64
	for _, order := range orders {
		if order == nil || !shouldCountOrderInRoundTotal(order.Status) {
			continue
		}
		count++
	}
	return count
}

func nullableInt64(value int64) any {
	if value == 0 {
		return nil
	}
	return value
}

func getString(payload map[string]any, key string) string {
	value, ok := payload[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return fmt.Sprintf("%.0f", typed)
	default:
		return fmt.Sprintf("%v", typed)
	}
}

func getInt64(payload map[string]any, key string) int64 {
	value, ok := payload[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case int64:
		return typed
	case string:
		if bigInt, ok := new(big.Int).SetString(typed, 10); ok {
			return bigInt.Int64()
		}
	}
	return 0
}

func normalizeTokenAmountValue(payload map[string]any, key string) int64 {
	value := getBigInt(payload, key)
	if value == nil {
		return 0
	}
	decimals := big.NewInt(1_000_000_000_000_000_000)
	if value.Cmp(decimals) >= 0 {
		value = new(big.Int).Div(value, decimals)
	}
	return value.Int64()
}

func getBigInt(payload map[string]any, key string) *big.Int {
	value, ok := payload[key]
	if !ok || value == nil {
		return nil
	}
	switch typed := value.(type) {
	case float64:
		return big.NewInt(int64(typed))
	case int64:
		return big.NewInt(typed)
	case string:
		if parsed, ok := new(big.Int).SetString(typed, 10); ok {
			return parsed
		}
	}
	return nil
}

func getDecimalString(payload map[string]any, key string) string {
	if bigValue := getBigInt(payload, key); bigValue != nil {
		return bigValue.String()
	}
	return "0"
}

func shortWalletLabel(wallet string) string {
	if len(wallet) < 10 {
		return wallet
	}
	return wallet[:6] + "..." + wallet[len(wallet)-4:]
}

func repositoryBusinessLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Taipei")
	if err != nil {
		return time.Local
	}
	return location
}

func autoPayoutAtForOrder(confirmedAt *time.Time, delayDays int64) *time.Time {
	if confirmedAt == nil {
		return nil
	}
	if delayDays < 0 {
		delayDays = 0
	}
	local := confirmedAt.In(repositoryBusinessLocation())
	target := time.Date(local.Year(), local.Month(), local.Day()+int(delayDays), 23, 59, 0, 0, repositoryBusinessLocation()).UTC()
	return &target
}

func toUTCPtr(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	normalized := value.UTC()
	return &normalized
}
