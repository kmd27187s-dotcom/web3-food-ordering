package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"mealvoting/backend/blockchain"
	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
)

const estimatedOrderGasWei = int64(2_000_000_000_000_000)

// OrderService owns order quote computation, hash generation, and signature coordination.
type OrderService struct {
	orders    repository.OrderRepo
	proposals repository.ProposalRepo
	merchants repository.MerchantRepo
	members   repository.MemberRepo
	chain     *blockchain.Client
}

func NewOrderService(orders repository.OrderRepo, proposals repository.ProposalRepo, merchants repository.MerchantRepo, members repository.MemberRepo, chain *blockchain.Client) *OrderService {
	return &OrderService{orders: orders, proposals: proposals, merchants: merchants, members: members, chain: chain}
}

func (s *OrderService) Quote(proposalID, memberID int64, items map[string]int64) (*models.OrderQuote, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.ProposalDate) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.Status != "ordering" {
		return nil, errors.New("proposal is not in ordering stage")
	}
	var winner *models.ProposalOption
	for _, opt := range proposal.Options {
		if opt.ID == proposal.WinnerOptionID {
			winner = opt
			break
		}
	}
	if winner == nil {
		return nil, errors.New("winner not finalized yet")
	}
	merchant, err := s.merchants.GetMerchant(winner.MerchantID)
	if err != nil {
		return nil, err
	}
	if len(merchant.Menu) == 0 {
		return nil, errors.New("winning merchant has no menu; ordering is unavailable")
	}
	var quoteItems []*models.OrderItem
	var subtotal int64
	for menuID, quantity := range items {
		if quantity <= 0 {
			continue
		}
		var menuItem *models.MenuItem
		for _, mi := range merchant.Menu {
			if mi.ID == menuID {
				menuItem = mi
				break
			}
		}
		if menuItem == nil {
			return nil, fmt.Errorf("menu item %s not found", menuID)
		}
		subtotal += menuItem.PriceWei * quantity
		quoteItems = append(quoteItems, &models.OrderItem{
			MenuItemID: menuID, Name: menuItem.Name, Quantity: quantity, PriceWei: menuItem.PriceWei,
		})
	}
	if len(quoteItems) == 0 {
		return nil, errors.New("at least one order item is required")
	}
	return &models.OrderQuote{
		ProposalID:         proposal.ID,
		MerchantID:         merchant.ID,
		MerchantName:       merchant.Name,
		Items:              quoteItems,
		SubtotalWei:        fmt.Sprintf("%d", subtotal),
		EstimatedGasWei:    fmt.Sprintf("%d", estimatedOrderGasWei),
		RequiredBalanceWei: fmt.Sprintf("%d", subtotal+estimatedOrderGasWei),
	}, nil
}

func (s *OrderService) Sign(proposalID, memberID int64, items map[string]int64, walletAddress string) (*models.OrderQuote, *models.OrderSignature, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, nil, err
	}
	quote, err := s.Quote(proposalID, memberID, items)
	if err != nil {
		return nil, nil, err
	}

	var sig *models.OrderSignature
	if proposal.ChainProposalID == nil {
		orderHash := computeOrderHash(proposal.ID, memberID, quote.Items)
		sig = &models.OrderSignature{
			AmountWei: quote.SubtotalWei,
			Expiry:    time.Now().UTC().Add(15 * time.Minute).Unix(),
			OrderHash: orderHash,
		}
	} else {
		if s.chain == nil {
			return nil, nil, errors.New("chain signer unavailable")
		}
		orderHash := computeOrderHash(*proposal.ChainProposalID, memberID, quote.Items)
		sig, err = s.chain.SignOrder(*proposal.ChainProposalID, walletAddress, orderHash, quote.SubtotalWei)
		if err != nil {
			return nil, nil, err
		}
	}

	return quote, sig, nil
}

func (s *OrderService) SaveSignedOrder(proposalID, memberID int64, items map[string]int64, signature *models.OrderSignature, escrowOrderID *int64) (*models.Order, error) {
	quote, err := s.Quote(proposalID, memberID, items)
	if err != nil {
		return nil, err
	}
	memberDisplayName := ""
	if s.members != nil {
		member, lookupErr := s.members.MemberByID(memberID)
		if lookupErr == nil {
			memberDisplayName = member.DisplayName
		}
	}
	return s.orders.SaveOrder(proposalID, memberID, quote, signature, memberDisplayName, escrowOrderID)
}

func computeOrderHash(proposalID, memberID int64, items any) string {
	payload, _ := json.Marshal(struct {
		ProposalID int64 `json:"proposalId"`
		MemberID   int64 `json:"memberId"`
		Items      any   `json:"items"`
	}{proposalID, memberID, items})
	sum := sha256.Sum256(payload)
	return "0x" + hex.EncodeToString(sum[:])
}
