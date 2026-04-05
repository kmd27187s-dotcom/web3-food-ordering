package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
)

const (
	optionTokenCost      = int64(1)
	winnerTokenReward    = int64(6)
	loserPartialRefund   = int64(4)
	voterPoints          = int64(25)
	winnerProposerPoints = int64(120)
)

// ProposalService owns all business rules for proposals, options, votes, and settlement.
type ProposalService struct {
	proposals repository.ProposalRepo
	members   repository.MemberRepo
	merchants repository.MerchantRepo
}

func NewProposalService(proposals repository.ProposalRepo, members repository.MemberRepo, merchants repository.MerchantRepo) *ProposalService {
	return &ProposalService{proposals: proposals, members: members, merchants: merchants}
}

func (s *ProposalService) Create(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions, proposalMinutes, voteMinutes, orderMinutes int64, consumeProposalToken bool) (*models.Proposal, error) {
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, errors.New("title is required")
	}
	description = strings.TrimSpace(description)
	if merchantGroup == "" {
		merchantGroup = "all"
	}
	if mealPeriod == "" {
		mealPeriod = "lunch"
	}
	scheduledDate, baseStart, err := resolveProposalSchedule(proposalDate, time.Now())
	if err != nil {
		return nil, err
	}
	if maxOptions < 3 || maxOptions > 10 {
		return nil, errors.New("maxOptions must be between 3 and 10")
	}
	if !isAllowedStageDuration(proposalMinutes) || !isAllowedStageDuration(voteMinutes) || !isAllowedStageDuration(orderMinutes) {
		return nil, errors.New("all stage durations must be 10 to 90 minutes in 10-minute steps")
	}
	if consumeProposalToken && member.TokenBalance < optionTokenCost {
		return nil, errors.New("insufficient token balance")
	}
	proposalDeadline := baseStart.Add(time.Duration(proposalMinutes) * time.Minute)
	voteDeadline := baseStart.Add(time.Duration(proposalMinutes+voteMinutes) * time.Minute)
	orderDeadline := baseStart.Add(time.Duration(proposalMinutes+voteMinutes+orderMinutes) * time.Minute)
	if err := validateProposalDeadlines(proposalDeadline, voteDeadline, orderDeadline); err != nil {
		return nil, err
	}
	if consumeProposalToken {
		return s.proposals.CreateProposalWithCredit(memberID, title, description, merchantGroup, mealPeriod, scheduledDate, maxOptions, member.DisplayName, proposalDeadline, voteDeadline, orderDeadline)
	}
	return s.proposals.CreateProposal(memberID, title, description, merchantGroup, mealPeriod, scheduledDate, maxOptions, member.DisplayName, proposalDeadline, voteDeadline, orderDeadline)
}

// CreateWithDeadlines creates a proposal with explicit deadlines (for demo/admin use).
func (s *ProposalService) CreateWithDeadlines(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, errors.New("title is required")
	}
	description = strings.TrimSpace(description)
	if merchantGroup == "" {
		merchantGroup = "all"
	}
	if mealPeriod == "" {
		mealPeriod = "lunch"
	}
	if proposalDate == "" {
		proposalDate = proposalDeadline.In(proposalBusinessLocation()).Format("2006-01-02")
	}
	if maxOptions < 3 || maxOptions > 10 {
		return nil, errors.New("maxOptions must be between 3 and 10")
	}
	if err := validateProposalDeadlines(proposalDeadline, voteDeadline, orderDeadline); err != nil {
		return nil, err
	}
	return s.proposals.CreateProposal(memberID, title, description, merchantGroup, mealPeriod, proposalDate, maxOptions, createdByName, proposalDeadline, voteDeadline, orderDeadline)
}

func (s *ProposalService) Get(id int64) (*models.Proposal, error) {
	return s.proposals.GetProposal(id)
}

func (s *ProposalService) List() []*models.Proposal {
	return s.proposals.ListProposals()
}

func (s *ProposalService) AddOption(proposalID, memberID int64, merchantID string) (*models.ProposalOption, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.ProposalDate) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.MaxOptions > 0 && int64(len(proposal.Options)) >= proposal.MaxOptions {
		return nil, errors.New("proposal option limit reached")
	}
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	if member.TokenBalance < optionTokenCost && member.ProposalTicketCount <= 0 {
		return nil, errors.New("insufficient token balance")
	}
	merchant, err := s.merchants.GetMerchant(merchantID)
	if err != nil {
		return nil, err
	}
	for _, opt := range proposal.Options {
		if opt.MerchantID == merchantID {
			return nil, errors.New("merchant already proposed")
		}
		if opt.ProposerMember == memberID {
			return nil, errors.New("you already proposed an option for this proposal")
		}
	}
	opt, err := s.proposals.InsertProposalOption(proposalID, memberID, merchant.ID, merchant.Name, member.DisplayName, optionTokenCost)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateOption) {
			return nil, errors.New("you already proposed an option for this proposal")
		}
		return nil, err
	}
	return opt, nil
}

func (s *ProposalService) Vote(proposalID, memberID, optionID, tokenAmount int64) (*models.Proposal, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.ProposalDate) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.Status != "voting" {
		return nil, errors.New("proposal is not in voting stage")
	}
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	if tokenAmount <= 0 {
		return nil, errors.New("tokenAmount must be greater than zero")
	}
	if member.TokenBalance < tokenAmount {
		return nil, errors.New("insufficient token balance")
	}
	found := false
	for _, opt := range proposal.Options {
		if opt.ID == optionID {
			found = true
			break
		}
	}
	if !found {
		return nil, errors.New("option not found")
	}
	for _, v := range proposal.Votes {
		if v.MemberID == memberID {
			return nil, errors.New("you already voted on this proposal")
		}
	}
	if err := s.proposals.RecordVote(proposalID, memberID, optionID, tokenAmount, member.DisplayName); err != nil {
		if errors.Is(err, repository.ErrDuplicateVote) {
			return nil, errors.New("you already voted on this proposal")
		}
		return nil, err
	}
	return s.proposals.GetProposal(proposalID)
}

func (s *ProposalService) QuoteOption() map[string]int64 {
	return map[string]int64{"tokenCost": optionTokenCost}
}

func (s *ProposalService) QuoteVote(tokenAmount int64) (map[string]int64, error) {
	if tokenAmount <= 0 {
		return nil, errors.New("tokenAmount must be greater than zero")
	}
	return map[string]int64{"tokenAmount": tokenAmount, "voteWeight": tokenAmount}, nil
}

func (s *ProposalService) FinalizeSettlement(proposalID int64) (*models.Proposal, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.ProposalDate) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.Status != "awaiting_settlement" && proposal.Status != "settled" {
		return nil, errors.New("proposal has not reached settlement stage")
	}
	if proposal.RewardsApplied {
		return nil, errors.New("proposal rewards already settled")
	}
	if proposal.WinnerOptionID == 0 {
		return nil, errors.New("winner not finalized")
	}

	var rewards []repository.MemberReward
	var optionRefunds []repository.OptionRefund

	for _, opt := range proposal.Options {
		if opt.ID == proposal.WinnerOptionID {
			rewards = append(rewards, repository.MemberReward{
				MemberID: opt.ProposerMember,
				Points:   winnerProposerPoints,
				Tokens:   winnerTokenReward,
			})
			optionRefunds = append(optionRefunds, repository.OptionRefund{
				OptionID:        opt.ID,
				WinnerTokenBack: winnerTokenReward,
			})
		} else {
			rewards = append(rewards, repository.MemberReward{
				MemberID: opt.ProposerMember,
				Tokens:   loserPartialRefund,
			})
			optionRefunds = append(optionRefunds, repository.OptionRefund{
				OptionID:      opt.ID,
				PartialRefund: loserPartialRefund,
			})
		}
	}
	voterIDs := make(map[int64]bool)
	for _, vote := range proposal.Votes {
		if !voterIDs[vote.MemberID] {
			voterIDs[vote.MemberID] = true
			rewards = append(rewards, repository.MemberReward{
				MemberID: vote.MemberID,
				Points:   voterPoints,
			})
		}
	}

	if err := s.proposals.ApplySettlementRewards(proposalID, rewards, optionRefunds); err != nil {
		return nil, err
	}
	return s.proposals.GetProposal(proposalID)
}

func (s *ProposalService) GetMerchant(id string) (*models.Merchant, error) {
	return s.merchants.GetMerchant(id)
}

func (s *ProposalService) ListMerchants() ([]*models.Merchant, error) {
	return s.merchants.ListMerchants()
}

func resolveProposalSchedule(proposalDate string, now time.Time) (string, time.Time, error) {
	location := now.Location()
	if location == nil {
		location = proposalBusinessLocation()
	}
	if proposalDate == "" {
		proposalDate = now.In(location).Format("2006-01-02")
	}
	day, err := time.ParseInLocation("2006-01-02", proposalDate, location)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("invalid proposalDate, expected YYYY-MM-DD")
	}
	nowLocal := now.In(location)
	if day.Before(time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, location)) {
		return "", time.Time{}, errors.New("proposalDate cannot be in the past")
	}
	if day.Year() == nowLocal.Year() && day.Month() == nowLocal.Month() && day.Day() == nowLocal.Day() {
		return proposalDate, now.UTC(), nil
	}
	base := time.Date(day.Year(), day.Month(), day.Day(), nowLocal.Hour(), nowLocal.Minute(), 0, 0, location)
	return proposalDate, base.UTC(), nil
}

// isCurrentProposalDay checks that the proposal is scheduled for today in local time.
func isCurrentProposalDay(proposalDate string) bool {
	if proposalDate == "" {
		return false
	}
	now := time.Now().In(proposalBusinessLocation()).Format("2006-01-02")
	return proposalDate == now
}

func proposalBusinessLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Taipei")
	if err != nil {
		return time.Local
	}
	return location
}

func validateProposalDeadlines(proposalDeadline, voteDeadline, orderDeadline time.Time) error {
	if proposalDeadline.IsZero() || voteDeadline.IsZero() || orderDeadline.IsZero() {
		return errors.New("all proposal deadlines are required")
	}
	if !proposalDeadline.Before(voteDeadline) {
		return errors.New("proposal deadline must be before vote deadline")
	}
	if !voteDeadline.Before(orderDeadline) {
		return errors.New("vote deadline must be before order deadline")
	}
	return nil
}

func isAllowedStageDuration(minutes int64) bool {
	return minutes >= 10 && minutes <= 90 && minutes%10 == 0
}
