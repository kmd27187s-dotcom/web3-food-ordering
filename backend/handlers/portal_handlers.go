package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"mealvoting/backend/internal/models"
)

func nextEffectiveMidnight(now time.Time) time.Time {
	local := now.In(handlerBusinessLocation())
	return time.Date(local.Year(), local.Month(), local.Day()+1, 0, 0, 0, 0, local.Location()).UTC()
}

func (s *Server) handlePasswordLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	member, token, err := s.members.Login(body.Email, body.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"token":  token,
		"member": member,
	})
}

func (s *Server) handleMerchantDashboard(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	if err := s.merchantRepo.ApplyScheduledMenuChangeRequests(time.Now().UTC()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	merchant, err := s.merchantRepo.GetMerchantByOwner(memberID, member.WalletAddress)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			writeJSON(w, http.StatusOK, map[string]any{
				"merchant":            nil,
				"orders":              []any{},
				"menuChangeRequests":  []any{},
				"acceptedOrderCount":  0,
				"pendingOrderCount":   0,
				"completedOrderCount": 0,
				"totalOrderCount":     0,
				"totalRevenueWei":     "0",
			})
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	orders, err := s.merchantRepo.ListMerchantOrders(merchant.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	requests, err := s.merchantRepo.ListMenuChangeRequests(merchant.ID, "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var totalRevenue int64
	var pending int64
	var accepted int64
	var completed int64
	for _, order := range orders {
		amount, _ := strconv.ParseInt(order.AmountWei, 10, 64)
		totalRevenue += amount
		if order.Status == "payment_received" || order.Status == "paid_onchain" || order.Status == "paid_local" {
			pending++
		}
		if order.Status == "merchant_accepted" {
			accepted++
		}
		if order.Status == "merchant_completed" || order.Status == "ready_for_payout" || order.Status == "platform_paid" {
			completed++
		}
	}
	writeJSON(w, http.StatusOK, &models.MerchantDashboard{
		Merchant:            merchant,
		Orders:              orders,
		MenuChangeRequests:  requests,
		AcceptedOrderCount:  accepted,
		PendingOrderCount:   pending,
		CompletedOrderCount: completed,
		TotalOrderCount:     int64(len(orders)),
		TotalRevenueWei:     strconv.FormatInt(totalRevenue, 10),
	})
}

func (s *Server) handleMerchantClaim(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	if strings.TrimSpace(member.WalletAddress) == "" {
		writeError(w, http.StatusBadRequest, "connect wallet first")
		return
	}
	var body struct {
		MerchantID string `json:"merchantId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	merchant, err := s.merchantRepo.ClaimMerchant(body.MerchantID, memberID, member.DisplayName, member.WalletAddress)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleMerchantUpsertProfile(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	if strings.TrimSpace(member.WalletAddress) == "" {
		writeError(w, http.StatusBadRequest, "connect wallet first")
		return
	}
	var body struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Address     string `json:"address"`
		Description string `json:"description"`
		Group       string `json:"group"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	merchant, err := s.merchantRepo.UpsertOwnedMerchantProfile(memberID, member.DisplayName, member.WalletAddress, &models.Merchant{
		ID:            strings.TrimSpace(body.ID),
		Name:          strings.TrimSpace(body.Name),
		Group:         strings.TrimSpace(body.Group),
		Address:       strings.TrimSpace(body.Address),
		Description:   strings.TrimSpace(body.Description),
		PayoutAddress: strings.TrimSpace(member.WalletAddress),
		Menu:          []*models.MenuItem{},
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleMerchantUpdateWallet(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		WalletAddress string `json:"walletAddress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	wallet, err := normalizeWalletAddressForProfileLookup(body.WalletAddress)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	merchant, err := s.merchantRepo.UpdateOwnedMerchantWallet(memberID, wallet)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleMerchantUnlinkWallet(w http.ResponseWriter, r *http.Request, memberID int64) {
	if err := s.merchantRepo.UnlinkOwnedMerchant(memberID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Server) handleMerchantRequestDelist(w http.ResponseWriter, r *http.Request, memberID int64) {
	merchant, err := s.merchantRepo.RequestMerchantDelist(memberID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleMerchantCancelDelist(w http.ResponseWriter, r *http.Request, memberID int64) {
	merchant, err := s.merchantRepo.CancelMerchantDelist(memberID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleMerchantAcceptOrder(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	merchant, err := s.merchantRepo.GetMerchantByOwner(memberID, member.WalletAddress)
	if err != nil {
		writeError(w, http.StatusForbidden, "merchant access required")
		return
	}
	orderID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}
	order, err := s.orderRepo.UpdateOrderStatus(orderID, merchant.ID, "merchant_accepted")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, order)
}

func (s *Server) handleMerchantCompleteOrder(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	merchant, err := s.merchantRepo.GetMerchantByOwner(memberID, member.WalletAddress)
	if err != nil {
		writeError(w, http.StatusForbidden, "merchant access required")
		return
	}
	orderID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}
	order, err := s.orderRepo.UpdateOrderStatus(orderID, merchant.ID, "merchant_completed")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, order)
}

func (s *Server) handleMerchantCreateMenuChange(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	merchant, err := s.merchantRepo.GetMerchantByOwner(memberID, member.WalletAddress)
	if err != nil {
		writeError(w, http.StatusForbidden, "merchant access required")
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	action, _ := body["action"].(string)
	menuItemID, _ := body["menuItemId"].(string)
	itemName, _ := body["itemName"].(string)
	description, _ := body["description"].(string)
	var priceWei int64
	switch value := body["priceWei"].(type) {
	case float64:
		priceWei = int64(value)
	case int64:
		priceWei = value
	case int:
		priceWei = int64(value)
	case string:
		if parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64); err == nil {
			priceWei = parsed
		}
	}
	req, err := s.merchantRepo.CreateMenuChangeRequest(&models.MenuChangeRequest{
		MerchantID:        merchant.ID,
		MenuItemID:        menuItemID,
		Action:            action,
		ItemName:          itemName,
		PriceWei:          priceWei,
		Description:       description,
		RequestedByMember: memberID,
		RequestedByName:   member.DisplayName,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, req)
}

func (s *Server) handleMerchantWithdrawMenuChange(w http.ResponseWriter, r *http.Request, memberID int64) {
	requestID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request id")
		return
	}
	item, err := s.merchantRepo.WithdrawMenuChangeRequest(requestID, memberID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminDashboard(w http.ResponseWriter, r *http.Request, memberID int64) {
	dashboard, err := s.adminRepo.AdminDashboard()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, dashboard)
}

func (s *Server) handleAdminInsights(w http.ResponseWriter, r *http.Request, memberID int64) {
	insights, err := s.adminRepo.AdminInsights()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, insights)
}

func (s *Server) handleAdminGroupDetail(w http.ResponseWriter, r *http.Request, memberID int64) {
	groupID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid group id")
		return
	}
	detail, err := s.adminRepo.AdminGroupDetail(groupID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) handleAdminUpdatePlatformTreasury(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		Address string `json:"address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	info, err := s.chainRepo.SetPlatformTreasury(body.Address)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) handleAdminMenuChanges(w http.ResponseWriter, r *http.Request, memberID int64) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	items, err := s.merchantRepo.ListMenuChangeRequests("", status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminReviewMenuChange(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	requestID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request id")
		return
	}
	var body struct {
		Decision   string `json:"decision"`
		ReviewNote string `json:"reviewNote"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	approved := strings.EqualFold(strings.TrimSpace(body.Decision), "approve")
	item, err := s.merchantRepo.ReviewMenuChangeRequest(
		requestID,
		memberID,
		member.DisplayName,
		approved,
		body.ReviewNote,
		nextEffectiveMidnight(time.Now()),
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminReviewMerchantDelist(w http.ResponseWriter, r *http.Request, memberID int64) {
	merchantID := strings.TrimSpace(r.PathValue("id"))
	if merchantID == "" {
		writeError(w, http.StatusBadRequest, "invalid merchant id")
		return
	}
	var body struct {
		Decision string `json:"decision"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	approve := strings.EqualFold(strings.TrimSpace(body.Decision), "approve")
	merchant, err := s.merchantRepo.ReviewMerchantDelist(merchantID, approve)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleAdminMarkOrderPaid(w http.ResponseWriter, r *http.Request, memberID int64) {
	orderID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}
	order, err := s.orderRepo.UpdateAdminOrderStatus(orderID, "platform_paid")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, order)
}
