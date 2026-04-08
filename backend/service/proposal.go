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
	defaultMaxProposalOptions = int64(10)
)

type governanceParamsReader interface {
	GovernanceParams() (*models.GovernanceParams, error)
}

// ProposalService owns all business rules for proposals, options, votes, and settlement.
type ProposalService struct {
	proposals repository.ProposalRepo
	members   repository.MemberRepo
	merchants repository.MerchantRepo
	settings  governanceParamsReader
}

func NewProposalService(proposals repository.ProposalRepo, members repository.MemberRepo, merchants repository.MerchantRepo, settings governanceParamsReader) *ProposalService {
	return &ProposalService{proposals: proposals, members: members, merchants: merchants, settings: settings}
}

func (s *ProposalService) Create(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions, proposalMinutes, voteMinutes, orderMinutes int64, consumeProposalToken bool, useCreateOrderTicket bool) (*models.Proposal, error) {
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	params, err := s.settings.GovernanceParams()
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
		mealPeriod = "custom"
	}
	scheduledDate, baseStart, err := resolveProposalSchedule(proposalDate, time.Now())
	if err != nil {
		return nil, err
	}
	if maxOptions < 1 || maxOptions > defaultMaxProposalOptions {
		return nil, errors.New("maxOptions must be between 1 and 10")
	}
	if !isAllowedStageDuration(proposalMinutes) || !isAllowedStageDuration(voteMinutes) || !isAllowedStageDuration(orderMinutes) {
		return nil, errors.New("all stage durations must be 10 to 90 minutes in 10-minute steps")
	}
	proposalDeadline := baseStart.Add(time.Duration(proposalMinutes) * time.Minute)
	voteDeadline := baseStart.Add(time.Duration(proposalMinutes+voteMinutes) * time.Minute)
	orderDeadline := baseStart.Add(time.Duration(proposalMinutes+voteMinutes+orderMinutes) * time.Minute)
	if err := validateProposalDeadlines(proposalDeadline, voteDeadline, orderDeadline); err != nil {
		return nil, err
	}
	if consumeProposalToken {
		return s.proposals.CreateProposalWithCredit(memberID, title, description, merchantGroup, mealPeriod, scheduledDate, maxOptions, member.DisplayName, proposalDeadline, voteDeadline, orderDeadline, params, useCreateOrderTicket)
	}
	return s.proposals.CreateProposal(memberID, title, description, merchantGroup, mealPeriod, scheduledDate, maxOptions, member.DisplayName, proposalDeadline, voteDeadline, orderDeadline, params)
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
		mealPeriod = "custom"
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
	params, err := s.settings.GovernanceParams()
	if err != nil {
		return nil, err
	}
	return s.proposals.CreateProposal(memberID, title, description, merchantGroup, mealPeriod, proposalDate, maxOptions, createdByName, proposalDeadline, voteDeadline, orderDeadline, params)
}

func (s *ProposalService) Get(id int64) (*models.Proposal, error) {
	return s.proposals.GetProposal(id)
}

func (s *ProposalService) List() []*models.Proposal {
	return s.proposals.ListProposals()
}

func (s *ProposalService) Delete(proposalID, memberID int64) error {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return err
	}
	if !isCurrentProposalDay(proposal.ProposalDate) {
		return errors.New("proposal expired for today")
	}
	if proposal.Status != "proposing" {
		return errors.New("only proposing rounds can be deleted")
	}
	if proposal.CreatedBy != memberID {
		return errors.New("only the creator can delete this proposal")
	}
	for _, option := range proposal.Options {
		if option.ProposerMember != memberID {
			return errors.New("cannot delete after another member has proposed")
		}
	}
	if len(proposal.Votes) > 0 {
		return errors.New("cannot delete after voting has started")
	}
	if len(proposal.Orders) > 0 {
		return errors.New("cannot delete after ordering has started")
	}
	return s.proposals.DeleteProposalByCreator(proposalID, memberID)
}

func (s *ProposalService) AddOption(proposalID, memberID int64, merchantID string, useProposalTicket bool) (*models.ProposalOption, error) {
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
	params, err := s.settings.GovernanceParams()
	if err != nil {
		return nil, err
	}
	merchant, err := s.merchants.GetMerchant(merchantID)
	if err != nil {
		return nil, err
	}
	for _, opt := range proposal.Options {
		if opt.MerchantID == merchantID {
			return nil, errors.New("merchant already proposed")
		}
	}
	memberProposalCount := int64(0)
	for _, opt := range proposal.Options {
		if opt.ProposerMember == memberID {
			memberProposalCount++
		}
	}
	if memberProposalCount >= 2 {
		return nil, errors.New("每位成員最多只能提案兩間店家")
	}
	if !useProposalTicket && member.ProposalCouponCount <= 0 {
		// no-op: governance fee will be handled by backend ledger for now
	}
	opt, err := s.proposals.InsertProposalOption(proposalID, memberID, merchant.ID, merchant.Name, member.DisplayName, params.ProposalFeeWei, useProposalTicket)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateOption) {
			return nil, errors.New("you already proposed an option for this proposal")
		}
		return nil, err
	}
	return opt, nil
}

func (s *ProposalService) Vote(proposalID, memberID, optionID, voteCount int64, useVoteTicket bool) (*models.Proposal, error) {
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
	if voteCount <= 0 {
		return nil, errors.New("voteCount must be greater than zero")
	}
	if useVoteTicket && member.VoteTicketCount <= 0 {
		return nil, errors.New("目前沒有可用的投票券")
	}
	params, err := s.settings.GovernanceParams()
	if err != nil {
		return nil, err
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
	feeAmountWei := params.VoteFeeWei * voteCount
	if useVoteTicket {
		feeAmountWei -= params.VoteFeeWei
		if feeAmountWei < 0 {
			feeAmountWei = 0
		}
	}
	if err := s.proposals.RecordVote(proposalID, memberID, optionID, voteCount, feeAmountWei, member.DisplayName, useVoteTicket); err != nil {
		if errors.Is(err, repository.ErrDuplicateVote) {
			return nil, errors.New("你已經完成投票，付款確認後不可再次修改")
		}
		return nil, err
	}
	return s.proposals.GetProposal(proposalID)
}

func (s *ProposalService) QuoteOption() (map[string]int64, error) {
	params, err := s.settings.GovernanceParams()
	if err != nil {
		return nil, err
	}
	return map[string]int64{"proposalFeeWei": params.ProposalFeeWei}, nil
}

func (s *ProposalService) QuoteVote(voteCount int64, useVoteTicket bool) (map[string]int64, error) {
	if voteCount <= 0 {
		return nil, errors.New("voteCount must be greater than zero")
	}
	params, err := s.settings.GovernanceParams()
	if err != nil {
		return nil, err
	}
	discountedVotes := int64(0)
	feeAmountWei := params.VoteFeeWei * voteCount
	if useVoteTicket {
		discountedVotes = 1
		feeAmountWei -= params.VoteFeeWei
		if feeAmountWei < 0 {
			feeAmountWei = 0
		}
	}
	return map[string]int64{
		"voteCount":       voteCount,
		"voteWeight":      voteCount,
		"feeAmountWei":    feeAmountWei,
		"voteFeeWei":      params.VoteFeeWei,
		"discountedVotes": discountedVotes,
	}, nil
}

func (s *ProposalService) FinalizeSettlement(proposalID int64) (*models.Proposal, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if proposal.RewardsApplied {
		return proposal, nil
	}
	return nil, errors.New("proposal settlement is handled automatically when the voting deadline is reached")
}

func (s *ProposalService) GetMerchant(id string) (*models.Merchant, error) {
	return s.merchants.GetMerchant(id)
}

func (s *ProposalService) ListMerchants() ([]*models.Merchant, error) {
	return s.merchants.ListMerchants()
}

func resolveProposalSchedule(proposalDate string, now time.Time) (string, time.Time, error) {
	location := proposalBusinessLocation()
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
	return minutes >= 1 && minutes <= 90
}
