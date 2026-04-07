package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"mealvoting/backend/blockchain"
	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"
	"mealvoting/backend/internal/testpg"
	"mealvoting/backend/service"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

const (
	aliceDemoPrivateKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
	aliceDemoWallet     = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	bobDemoPrivateKey   = "59c6995e998f97a5a0044966f0945382d7d6b5f0d1c42b4aef3f7c4d5e6f7a8b"
	bobDemoWallet       = "0xca58948542843E4Ca9EE4062d9a317c4Bea45CAa"
	carolDemoPrivateKey = "8b3a350cf5c34c9194ca3a545d8f5d1e5c9d4d8efab9c5f37d7a6742d95d6633"
	carolDemoWallet     = "0xe921bd1E07735b9Eee467A6494436a7e4d5A2dbE"
	daveDemoPrivateKey  = "0000000000000000000000000000000000000000000000000000000000000001"
)

func currentTestMealPeriod() string {
	if time.Now().In(time.Local).Hour() < 12 {
		return "lunch"
	}
	return "dinner"
}

func oppositeTestMealPeriod() string {
	if currentTestMealPeriod() == "lunch" {
		return "dinner"
	}
	return "lunch"
}

func newTestServer(t *testing.T) http.Handler {
	return newTestServerWithConfig(t, config.Config{})
}

func newTestServerWithConfig(t *testing.T, cfg config.Config) http.Handler {
	t.Helper()

	appStore := testpg.OpenStore(t, models.ContractInfo{})

	return NewServer(cfg, appStore, nil).Routes()
}

func performJSONRequest(t *testing.T, handler http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func performJSONRequestFromIP(t *testing.T, handler http.Handler, method, path, ip string, body any) *httptest.ResponseRecorder {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", ip)
	req.RemoteAddr = ip + ":12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decodeJSONBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response body: %v", err)
	}
	return body
}

func decodeJSONArrayBody(t *testing.T, rec *httptest.ResponseRecorder) []map[string]any {
	t.Helper()

	var body []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response array body: %v", err)
	}
	return body
}

func loginAndGetToken(t *testing.T, handler http.Handler, email, password string) string {
	t.Helper()

	wallet, privateKey := demoWalletForIdentity(t, email)
	challengeRec := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": wallet,
	})
	if challengeRec.Code != http.StatusOK {
		t.Fatalf("wallet challenge %s failed with status %d: %s", email, challengeRec.Code, challengeRec.Body.String())
	}
	challengeBody := decodeJSONBody(t, challengeRec)
	message, ok := challengeBody["message"].(string)
	if !ok || message == "" {
		t.Fatalf("expected challenge message for %s, got %v", email, challengeBody["message"])
	}
	signature := signWalletMessage(t, privateKey, message)

	rec := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": wallet,
		"signature":     signature,
		"displayName":   demoDisplayNameForIdentity(email),
	})
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("wallet verify %s failed with status %d: %s", email, rec.Code, rec.Body.String())
	}

	body := decodeJSONBody(t, rec)
	token, ok := body["token"].(string)
	if !ok || token == "" {
		t.Fatalf("expected login token for %s, got %v", email, body["token"])
	}
	memberBody, ok := body["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected member payload for %s, got %T", email, body["member"])
	}
	active, _ := memberBody["subscriptionActive"].(bool)
	if !active {
		subscribe := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/subscription/pay", token, map[string]any{
			"tokenAmount": 99,
		})
		if subscribe.Code != http.StatusOK {
			t.Fatalf("subscription payment for %s failed with status %d: %s", email, subscribe.Code, subscribe.Body.String())
		}
	}
	return token
}

func demoWalletForIdentity(t *testing.T, identity string) (wallet string, privateKey string) {
	t.Helper()
	switch identity {
	case "alice@example.com", "alice@demo.local", "Alice":
		return aliceDemoWallet, aliceDemoPrivateKey
	case "bob@example.com", "bob@demo.local", "Bob":
		return bobDemoWallet, bobDemoPrivateKey
	case "carol@example.com", "carol@demo.local", "Carol":
		return carolDemoWallet, carolDemoPrivateKey
	default:
		t.Fatalf("unknown demo identity %q", identity)
		return "", ""
	}
}

func demoDisplayNameForIdentity(identity string) string {
	switch identity {
	case "alice@example.com", "alice@demo.local", "Alice":
		return "Alice"
	case "bob@example.com", "bob@demo.local", "Bob":
		return "Bob"
	case "carol@example.com", "carol@demo.local", "Carol":
		return "Carol"
	default:
		return "Wallet User"
	}
}

func signWalletMessage(t *testing.T, privateKeyHex, message string) string {
	t.Helper()
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		t.Fatalf("parse test private key: %v", err)
	}
	signature, err := crypto.Sign(accounts.TextHash([]byte(message)), privateKey)
	if err != nil {
		t.Fatalf("sign wallet message: %v", err)
	}
	signature[64] += 27
	return hexutil.Encode(signature)
}

func walletAddressFromPrivateKey(t *testing.T, privateKeyHex string) string {
	t.Helper()
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		t.Fatalf("parse private key for wallet address: %v", err)
	}
	return crypto.PubkeyToAddress(privateKey.PublicKey).Hex()
}

func performAuthorizedJSONRequest(t *testing.T, handler http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func performAuthorizedJSONRequestFromIP(t *testing.T, handler http.Handler, method, path, token, ip string, body any) *httptest.ResponseRecorder {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Forwarded-For", ip)
	req.RemoteAddr = ip + ":12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func createGroupAndGetID(t *testing.T, handler http.Handler, token, name string) int64 {
	t.Helper()

	rec := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/groups", token, map[string]string{
		"name":        name,
		"description": name + " description",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected create group to return 201, got %d: %s", rec.Code, rec.Body.String())
	}

	body := decodeJSONBody(t, rec)
	groupID, ok := body["id"].(float64)
	if !ok || groupID <= 0 {
		t.Fatalf("expected create group response to include id, got %v", body["id"])
	}
	return int64(groupID)
}

func TestWalletChallengeRejectsInvalidAddress(t *testing.T) {
	handler := newTestServer(t)

	rec := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{"walletAddress": "not-a-wallet"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid wallet challenge, got %d", rec.Code)
	}
	body := decodeJSONBody(t, rec)
	if body["error"] != "invalid wallet address" {
		t.Fatalf("unexpected wallet challenge error: %v", body)
	}
}

func TestWalletVerifyRejectsInvalidSignature(t *testing.T) {
	handler := newTestServer(t)

	challenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": aliceDemoWallet,
	})
	if challenge.Code != http.StatusOK {
		t.Fatalf("expected wallet challenge to succeed, got %d: %s", challenge.Code, challenge.Body.String())
	}

	rec := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": aliceDemoWallet,
		"signature":     "0xdeadbeef",
	})
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected invalid signature to return 401, got %d", rec.Code)
	}
	body := decodeJSONBody(t, rec)
	if body["error"] != "wallet verification failed" {
		t.Fatalf("unexpected invalid-signature error body: %v", body)
	}
}

func TestMemberProfileByWalletRequiresAuthentication(t *testing.T) {
	handler := newTestServer(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/members/profile?walletAddress="+aliceDemoWallet, nil)
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated wallet profile lookup to return 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMemberProfileByWalletRejectsOtherWallets(t *testing.T) {
	handler := newTestServer(t)
	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")

	req := httptest.NewRequest(http.MethodGet, "/api/members/profile?walletAddress="+bobDemoWallet, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected cross-wallet profile lookup to return 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestWalletVerifyReturnsInactiveSubscriptionForUnpaidMember(t *testing.T) {
	handler := newTestServer(t)

	challenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": aliceDemoWallet,
	})
	if challenge.Code != http.StatusOK {
		t.Fatalf("expected wallet challenge to succeed, got %d: %s", challenge.Code, challenge.Body.String())
	}
	challengeBody := decodeJSONBody(t, challenge)
	message, ok := challengeBody["message"].(string)
	if !ok || message == "" {
		t.Fatalf("expected challenge message, got %v", challengeBody["message"])
	}

	rec := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": aliceDemoWallet,
		"signature":     signWalletMessage(t, aliceDemoPrivateKey, message),
		"displayName":   "Alice",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected wallet verify to succeed, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decodeJSONBody(t, rec)
	member, ok := body["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected member payload, got %T", body["member"])
	}
	if member["subscriptionActive"] != false {
		t.Fatalf("expected unpaid member subscriptionActive false, got %v", member["subscriptionActive"])
	}
	if body["dailyLoginRewardGranted"] != true {
		t.Fatalf("expected first login of the day to grant daily login reward, got %v", body["dailyLoginRewardGranted"])
	}
	if member["claimableProposalTickets"] != float64(1) {
		t.Fatalf("expected first login of the day to add one claimable proposal ticket, got %v", member["claimableProposalTickets"])
	}
}

func TestWalletVerifyOnlyGrantsDailyLoginRewardOncePerDay(t *testing.T) {
	handler := newTestServer(t)

	firstChallenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": bobDemoWallet,
	})
	if firstChallenge.Code != http.StatusOK {
		t.Fatalf("expected first challenge to succeed, got %d: %s", firstChallenge.Code, firstChallenge.Body.String())
	}
	firstMessage, ok := decodeJSONBody(t, firstChallenge)["message"].(string)
	if !ok || firstMessage == "" {
		t.Fatalf("expected first challenge message, got %v", decodeJSONBody(t, firstChallenge)["message"])
	}
	firstVerify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": bobDemoWallet,
		"signature":     signWalletMessage(t, bobDemoPrivateKey, firstMessage),
		"displayName":   "Bob",
	})
	if firstVerify.Code != http.StatusOK {
		t.Fatalf("expected first verify to succeed, got %d: %s", firstVerify.Code, firstVerify.Body.String())
	}
	firstBody := decodeJSONBody(t, firstVerify)
	if firstBody["dailyLoginRewardGranted"] != true {
		t.Fatalf("expected first login to grant daily reward, got %v", firstBody["dailyLoginRewardGranted"])
	}
	firstMember, ok := firstBody["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected first member payload, got %T", firstBody["member"])
	}
	if firstMember["claimableProposalTickets"] != float64(1) {
		t.Fatalf("expected first login to leave one claimable proposal ticket, got %v", firstMember["claimableProposalTickets"])
	}

	secondChallenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": bobDemoWallet,
	})
	if secondChallenge.Code != http.StatusOK {
		t.Fatalf("expected second challenge to succeed, got %d: %s", secondChallenge.Code, secondChallenge.Body.String())
	}
	secondMessage, ok := decodeJSONBody(t, secondChallenge)["message"].(string)
	if !ok || secondMessage == "" {
		t.Fatalf("expected second challenge message, got %v", decodeJSONBody(t, secondChallenge)["message"])
	}
	secondVerify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": bobDemoWallet,
		"signature":     signWalletMessage(t, bobDemoPrivateKey, secondMessage),
		"displayName":   "Bob",
	})
	if secondVerify.Code != http.StatusOK {
		t.Fatalf("expected second verify to succeed, got %d: %s", secondVerify.Code, secondVerify.Body.String())
	}
	secondBody := decodeJSONBody(t, secondVerify)
	if secondBody["dailyLoginRewardGranted"] != false {
		t.Fatalf("expected second login on same day to skip daily reward, got %v", secondBody["dailyLoginRewardGranted"])
	}
	secondMember, ok := secondBody["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected second member payload, got %T", secondBody["member"])
	}
	if secondMember["claimableProposalTickets"] != float64(1) {
		t.Fatalf("expected second login to keep same one claimable proposal ticket, got %v", secondMember["claimableProposalTickets"])
	}
}

func TestSubscriptionPayActivatesAndExtendsMemberForThirtyDays(t *testing.T) {
	handler := newTestServer(t)

	challenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": aliceDemoWallet,
	})
	if challenge.Code != http.StatusOK {
		t.Fatalf("expected wallet challenge to succeed, got %d: %s", challenge.Code, challenge.Body.String())
	}
	challengeBody := decodeJSONBody(t, challenge)
	message, ok := challengeBody["message"].(string)
	if !ok || message == "" {
		t.Fatalf("expected challenge message, got %v", challengeBody["message"])
	}
	verify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": aliceDemoWallet,
		"signature":     signWalletMessage(t, aliceDemoPrivateKey, message),
		"displayName":   "Alice",
	})
	if verify.Code != http.StatusOK {
		t.Fatalf("expected wallet verify to succeed, got %d: %s", verify.Code, verify.Body.String())
	}
	verifyBody := decodeJSONBody(t, verify)
	token, ok := verifyBody["token"].(string)
	if !ok || token == "" {
		t.Fatalf("expected token for subscription test, got %v", verifyBody["token"])
	}

	initialMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", token, nil)
	if initialMe.Code != http.StatusOK {
		t.Fatalf("expected initial member fetch to return 200, got %d: %s", initialMe.Code, initialMe.Body.String())
	}
	initialBody := decodeJSONBody(t, initialMe)
	if initialBody["subscriptionActive"] != false {
		t.Fatalf("expected initial subscriptionActive false, got %v", initialBody["subscriptionActive"])
	}

	firstPay := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/subscription/pay", token, map[string]any{
		"tokenAmount": 99,
	})
	if firstPay.Code != http.StatusOK {
		t.Fatalf("expected first subscription payment to succeed, got %d: %s", firstPay.Code, firstPay.Body.String())
	}
	firstPayBody := decodeJSONBody(t, firstPay)
	if firstPayBody["subscriptionActive"] != true {
		t.Fatalf("expected subscription payment response to activate subscription, got %v", firstPayBody["subscriptionActive"])
	}
	firstExpiryRaw, ok := firstPayBody["subscriptionExpires"].(string)
	if !ok || firstExpiryRaw == "" {
		t.Fatalf("expected subscription expiry string, got %v", firstPayBody["subscriptionExpires"])
	}
	firstExpiry, err := time.Parse(time.RFC3339, firstExpiryRaw)
	if err != nil {
		t.Fatalf("parse first expiry: %v", err)
	}
	if firstExpiry.Before(time.Now().UTC().Add(29 * 24 * time.Hour)) {
		t.Fatalf("expected first expiry about 30 days in the future, got %s", firstExpiryRaw)
	}

	secondPay := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/subscription/pay", token, map[string]any{
		"tokenAmount": 99,
	})
	if secondPay.Code != http.StatusOK {
		t.Fatalf("expected second subscription payment to succeed, got %d: %s", secondPay.Code, secondPay.Body.String())
	}
	secondPayBody := decodeJSONBody(t, secondPay)
	secondExpiryRaw, ok := secondPayBody["subscriptionExpires"].(string)
	if !ok || secondExpiryRaw == "" {
		t.Fatalf("expected second subscription expiry string, got %v", secondPayBody["subscriptionExpires"])
	}
	secondExpiry, err := time.Parse(time.RFC3339, secondExpiryRaw)
	if err != nil {
		t.Fatalf("parse second expiry: %v", err)
	}
	if !secondExpiry.After(firstExpiry.Add(29 * 24 * time.Hour)) {
		t.Fatalf("expected second payment to extend expiry by about 30 more days, first=%s second=%s", firstExpiryRaw, secondExpiryRaw)
	}

	refreshedMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", token, nil)
	if refreshedMe.Code != http.StatusOK {
		t.Fatalf("expected refreshed member fetch to return 200, got %d: %s", refreshedMe.Code, refreshedMe.Body.String())
	}
	refreshedBody := decodeJSONBody(t, refreshedMe)
	if refreshedBody["subscriptionActive"] != true {
		t.Fatalf("expected refreshed subscriptionActive true, got %v", refreshedBody["subscriptionActive"])
	}
}

func TestProtectedRoutesRejectUnsubscribedMembers(t *testing.T) {
	handler := newTestServer(t)

	challenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": bobDemoWallet,
	})
	if challenge.Code != http.StatusOK {
		t.Fatalf("expected wallet challenge to succeed, got %d: %s", challenge.Code, challenge.Body.String())
	}
	challengeBody := decodeJSONBody(t, challenge)
	message, ok := challengeBody["message"].(string)
	if !ok || message == "" {
		t.Fatalf("expected challenge message, got %v", challengeBody["message"])
	}
	verify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": bobDemoWallet,
		"signature":     signWalletMessage(t, bobDemoPrivateKey, message),
		"displayName":   "Bob",
	})
	if verify.Code != http.StatusOK {
		t.Fatalf("expected wallet verify to succeed, got %d: %s", verify.Code, verify.Body.String())
	}
	verifyBody := decodeJSONBody(t, verify)
	token, ok := verifyBody["token"].(string)
	if !ok || token == "" {
		t.Fatalf("expected token for unsubscribed member, got %v", verifyBody["token"])
	}

	createGroup := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/groups", token, map[string]string{
		"name":        "未訂閱群組",
		"description": "should fail",
	})
	if createGroup.Code != http.StatusForbidden {
		t.Fatalf("expected unsubscribed create-group to return 403, got %d: %s", createGroup.Code, createGroup.Body.String())
	}
	body := decodeJSONBody(t, createGroup)
	if body["error"] != "subscription required" {
		t.Fatalf("unexpected subscription gate error body: %v", body)
	}
}

func TestWalletVerifyDoesNotCreateDuplicateMemberForExistingWallet(t *testing.T) {
	appStore := testpg.OpenStore(t, models.ContractInfo{})
	handler := NewServer(config.Config{}, appStore, nil).Routes()

	firstChallenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": aliceDemoWallet,
	})
	if firstChallenge.Code != http.StatusOK {
		t.Fatalf("expected first challenge to succeed, got %d: %s", firstChallenge.Code, firstChallenge.Body.String())
	}
	firstChallengeBody := decodeJSONBody(t, firstChallenge)
	firstMessage, ok := firstChallengeBody["message"].(string)
	if !ok || firstMessage == "" {
		t.Fatalf("expected first challenge message, got %v", firstChallengeBody["message"])
	}

	firstVerify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": aliceDemoWallet,
		"signature":     signWalletMessage(t, aliceDemoPrivateKey, firstMessage),
		"displayName":   "Alice",
	})
	if firstVerify.Code != http.StatusOK {
		t.Fatalf("expected first verify to succeed, got %d: %s", firstVerify.Code, firstVerify.Body.String())
	}
	firstVerifyBody := decodeJSONBody(t, firstVerify)
	firstMember, ok := firstVerifyBody["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected first member payload, got %T", firstVerifyBody["member"])
	}
	if firstVerifyBody["created"] != false {
		t.Fatalf("expected existing seeded wallet to log in without creating member, got %v", firstVerifyBody["created"])
	}
	firstMemberID, ok := firstMember["id"].(float64)
	if !ok {
		t.Fatalf("expected first member id, got %v", firstMember["id"])
	}

	secondChallenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": aliceDemoWallet,
	})
	if secondChallenge.Code != http.StatusOK {
		t.Fatalf("expected second challenge to succeed, got %d: %s", secondChallenge.Code, secondChallenge.Body.String())
	}
	secondChallengeBody := decodeJSONBody(t, secondChallenge)
	secondMessage, ok := secondChallengeBody["message"].(string)
	if !ok || secondMessage == "" {
		t.Fatalf("expected second challenge message, got %v", secondChallengeBody["message"])
	}

	secondVerify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": aliceDemoWallet,
		"signature":     signWalletMessage(t, aliceDemoPrivateKey, secondMessage),
		"displayName":   "Different Name Should Not Re-register",
	})
	if secondVerify.Code != http.StatusOK {
		t.Fatalf("expected second verify to succeed as login, got %d: %s", secondVerify.Code, secondVerify.Body.String())
	}
	secondVerifyBody := decodeJSONBody(t, secondVerify)
	secondMember, ok := secondVerifyBody["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected second member payload, got %T", secondVerifyBody["member"])
	}
	if secondVerifyBody["created"] != false {
		t.Fatalf("expected existing wallet to avoid duplicate registration, got %v", secondVerifyBody["created"])
	}
	secondMemberID, ok := secondMember["id"].(float64)
	if !ok {
		t.Fatalf("expected second member id, got %v", secondMember["id"])
	}
	if secondMemberID != firstMemberID {
		t.Fatalf("expected same member id on repeated wallet verify, first=%v second=%v", firstMemberID, secondMemberID)
	}

	count, err := appStore.MemberCount()
	if err != nil {
		t.Fatalf("count members after repeated wallet verify: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected no duplicate member rows for existing wallet, got member count %d", count)
	}
}

func TestListUsageAppliesServerSideLimitCap(t *testing.T) {
	appStore := testpg.OpenStore(t, models.ContractInfo{})
	handler := NewServer(config.Config{}, appStore, nil).Routes()

	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	member, err := appStore.MemberByWallet(aliceDemoWallet)
	if err != nil {
		t.Fatalf("load member by wallet: %v", err)
	}
	for i := 0; i < maxUsageLimit+25; i++ {
		if err := appStore.LogUsage(member.ID, 0, "vote", "token", "debit", "1", "cap test", strconv.Itoa(i)); err != nil {
			t.Fatalf("log usage %d: %v", i, err)
		}
	}

	rec := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me/usage?limit=9999", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected usage list to return 200, got %d: %s", rec.Code, rec.Body.String())
	}
	items := decodeJSONArrayBody(t, rec)
	if len(items) != maxUsageLimit {
		t.Fatalf("expected usage list to be capped at %d items, got %d", maxUsageLimit, len(items))
	}
}

func TestRegistrationInviteRewardsCanBeClaimedByInviterAndInvitee(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	aliceMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", aliceToken, nil)
	if aliceMe.Code != http.StatusOK {
		t.Fatalf("expected alice member fetch to return 200, got %d: %s", aliceMe.Code, aliceMe.Body.String())
	}
	aliceBody := decodeJSONBody(t, aliceMe)
	aliceInviteCode, ok := aliceBody["registrationInviteCode"].(string)
	if !ok || aliceInviteCode == "" {
		t.Fatalf("expected alice registration invite code, got %v", aliceBody["registrationInviteCode"])
	}

	daveWallet := walletAddressFromPrivateKey(t, daveDemoPrivateKey)
	daveChallenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": daveWallet,
	})
	if daveChallenge.Code != http.StatusOK {
		t.Fatalf("expected dave challenge to succeed, got %d: %s", daveChallenge.Code, daveChallenge.Body.String())
	}
	daveChallengeBody := decodeJSONBody(t, daveChallenge)
	daveMessage, ok := daveChallengeBody["message"].(string)
	if !ok || daveMessage == "" {
		t.Fatalf("expected dave challenge message, got %v", daveChallengeBody["message"])
	}

	daveVerify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": daveWallet,
		"signature":     signWalletMessage(t, daveDemoPrivateKey, daveMessage),
		"displayName":   "Dave",
		"inviteCode":    aliceInviteCode,
	})
	if daveVerify.Code != http.StatusCreated {
		t.Fatalf("expected dave verify to create member, got %d: %s", daveVerify.Code, daveVerify.Body.String())
	}
	daveVerifyBody := decodeJSONBody(t, daveVerify)
	daveToken, ok := daveVerifyBody["token"].(string)
	if !ok || daveToken == "" {
		t.Fatalf("expected dave token, got %v", daveVerifyBody["token"])
	}
	daveMember, ok := daveVerifyBody["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected dave member payload, got %T", daveVerifyBody["member"])
	}
	if daveMember["claimableProposalTickets"] != float64(2) {
		t.Fatalf("expected dave to receive 2 claimable proposal tickets (daily login + invite), got %+v", daveMember)
	}

	aliceAfterInvite := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", aliceToken, nil)
	if aliceAfterInvite.Code != http.StatusOK {
		t.Fatalf("expected alice member fetch after invite to return 200, got %d: %s", aliceAfterInvite.Code, aliceAfterInvite.Body.String())
	}
	aliceAfterBody := decodeJSONBody(t, aliceAfterInvite)
	if aliceAfterBody["claimableProposalTickets"] != float64(2) {
		t.Fatalf("expected alice to receive 2 claimable proposal tickets (daily login + invite), got %+v", aliceAfterBody)
	}

	daveClaim := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/members/tickets/claim", daveToken, map[string]any{})
	if daveClaim.Code != http.StatusOK {
		t.Fatalf("expected dave claim to return 200, got %d: %s", daveClaim.Code, daveClaim.Body.String())
	}
	daveClaimBody := decodeJSONBody(t, daveClaim)
	if daveClaimBody["claimedProposalTickets"] != float64(2) {
		t.Fatalf("expected dave claim response to report two proposal tickets, got %+v", daveClaimBody)
	}
	daveClaimMember, ok := daveClaimBody["member"].(map[string]any)
	if !ok {
		t.Fatalf("expected claimed member payload, got %T", daveClaimBody["member"])
	}
	if daveClaimMember["proposalTicketCount"] != float64(2) {
		t.Fatalf("expected dave proposal ticket count to be 2 after claim, got %+v", daveClaimMember)
	}
	if daveClaimMember["claimableProposalTickets"] != float64(0) {
		t.Fatalf("expected dave claimable proposal tickets to be cleared after claim, got %+v", daveClaimMember)
	}
}

func TestProposalTicketIsConsumedBeforeTokenBalance(t *testing.T) {
	appStore := testpg.OpenStore(t, models.ContractInfo{})
	handler := NewServer(config.Config{}, appStore, nil).Routes()

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, aliceToken, "票券測試群組")

	aliceMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", aliceToken, nil)
	if aliceMe.Code != http.StatusOK {
		t.Fatalf("expected alice member fetch to return 200, got %d: %s", aliceMe.Code, aliceMe.Body.String())
	}
	aliceInviteCode, ok := decodeJSONBody(t, aliceMe)["registrationInviteCode"].(string)
	if !ok || aliceInviteCode == "" {
		t.Fatalf("expected alice registration invite code, got %v", decodeJSONBody(t, aliceMe)["registrationInviteCode"])
	}

	groupRec := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/groups/"+strconv.FormatInt(groupID, 10), aliceToken, nil)
	if groupRec.Code != http.StatusOK {
		t.Fatalf("expected group fetch to return 200, got %d: %s", groupRec.Code, groupRec.Body.String())
	}
	groupInviteCode, ok := decodeJSONBody(t, groupRec)["inviteCode"].(string)
	if !ok || groupInviteCode == "" {
		t.Fatalf("expected group invite code, got %v", decodeJSONBody(t, groupRec)["inviteCode"])
	}

	daveWallet := walletAddressFromPrivateKey(t, daveDemoPrivateKey)
	daveChallenge := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/challenge", map[string]string{
		"walletAddress": daveWallet,
	})
	if daveChallenge.Code != http.StatusOK {
		t.Fatalf("expected dave challenge to succeed, got %d: %s", daveChallenge.Code, daveChallenge.Body.String())
	}
	daveMessage, ok := decodeJSONBody(t, daveChallenge)["message"].(string)
	if !ok || daveMessage == "" {
		t.Fatalf("expected dave challenge message, got %v", decodeJSONBody(t, daveChallenge)["message"])
	}
	daveVerify := performJSONRequest(t, handler, http.MethodPost, "/auth/wallet/verify", map[string]string{
		"walletAddress": daveWallet,
		"signature":     signWalletMessage(t, daveDemoPrivateKey, daveMessage),
		"displayName":   "Dave",
		"inviteCode":    aliceInviteCode,
	})
	if daveVerify.Code != http.StatusCreated {
		t.Fatalf("expected dave verify to create member, got %d: %s", daveVerify.Code, daveVerify.Body.String())
	}
	daveVerifyBody := decodeJSONBody(t, daveVerify)
	daveToken, ok := daveVerifyBody["token"].(string)
	if !ok || daveToken == "" {
		t.Fatalf("expected dave token, got %v", daveVerifyBody["token"])
	}

	subscribeDave := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/subscription/pay", daveToken, map[string]any{
		"tokenAmount": 99,
	})
	if subscribeDave.Code != http.StatusOK {
		t.Fatalf("expected dave subscription payment to return 200, got %d: %s", subscribeDave.Code, subscribeDave.Body.String())
	}

	claimDave := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/members/tickets/claim", daveToken, map[string]any{})
	if claimDave.Code != http.StatusOK {
		t.Fatalf("expected dave ticket claim to return 200, got %d: %s", claimDave.Code, claimDave.Body.String())
	}

	joinDave := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/join/"+groupInviteCode, daveToken, nil)
	if joinDave.Code != http.StatusOK {
		t.Fatalf("expected dave join group to return 200, got %d: %s", joinDave.Code, joinDave.Body.String())
	}

	createProposal := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", aliceToken, map[string]any{
		"title":           "票券不扣 token 測試",
		"description":     "票券測試",
		"groupId":         groupID,
		"merchantId":      "shop-bento",
		"maxOptions":      5,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if createProposal.Code != http.StatusCreated {
		t.Fatalf("expected create proposal to return 201, got %d: %s", createProposal.Code, createProposal.Body.String())
	}
	var proposal models.Proposal
	if err := json.Unmarshal(createProposal.Body.Bytes(), &proposal); err != nil {
		t.Fatalf("decode proposal response: %v", err)
	}

	beforeOptionMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", daveToken, nil)
	if beforeOptionMe.Code != http.StatusOK {
		t.Fatalf("expected dave member fetch before option to return 200, got %d: %s", beforeOptionMe.Code, beforeOptionMe.Body.String())
	}
	beforeOptionBody := decodeJSONBody(t, beforeOptionMe)
	beforeOptionTokens := beforeOptionBody["tokenBalance"]

	addOption := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals/"+strconv.FormatInt(proposal.ID, 10)+"/options", daveToken, map[string]any{
		"merchantId": "shop-hotpot",
	})
	if addOption.Code != http.StatusCreated {
		t.Fatalf("expected add option to return 201, got %d: %s", addOption.Code, addOption.Body.String())
	}

	afterOptionMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", daveToken, nil)
	if afterOptionMe.Code != http.StatusOK {
		t.Fatalf("expected dave member fetch after option to return 200, got %d: %s", afterOptionMe.Code, afterOptionMe.Body.String())
	}
	afterOptionBody := decodeJSONBody(t, afterOptionMe)
	if afterOptionBody["tokenBalance"] != beforeOptionTokens {
		t.Fatalf("expected proposal ticket to avoid token deduction, before=%v after=%v", beforeOptionTokens, afterOptionBody["tokenBalance"])
	}
	if afterOptionBody["proposalTicketCount"] != float64(1) {
		t.Fatalf("expected proposal ticket count to decrement from 2 to 1, got %v", afterOptionBody["proposalTicketCount"])
	}
}

func TestCreateProposalConsumesTokenWhenNoInitialMerchantIsProvided(t *testing.T) {
	handler := newTestServer(t)
	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, token, "提案扣 token 群組")

	beforeMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", token, nil)
	if beforeMe.Code != http.StatusOK {
		t.Fatalf("expected member fetch before proposal to return 200, got %d: %s", beforeMe.Code, beforeMe.Body.String())
	}
	beforeBody := decodeJSONBody(t, beforeMe)
	beforeTokens, ok := beforeBody["tokenBalance"].(float64)
	if !ok {
		t.Fatalf("expected numeric token balance before proposal, got %v", beforeBody["tokenBalance"])
	}

	createProposal := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", token, map[string]any{
		"title":           "只建立 round",
		"groupId":         groupID,
		"maxOptions":      5,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if createProposal.Code != http.StatusCreated {
		t.Fatalf("expected proposal create without merchant to return 201, got %d: %s", createProposal.Code, createProposal.Body.String())
	}

	afterMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", token, nil)
	if afterMe.Code != http.StatusOK {
		t.Fatalf("expected member fetch after proposal to return 200, got %d: %s", afterMe.Code, afterMe.Body.String())
	}
	afterBody := decodeJSONBody(t, afterMe)
	afterTokens, ok := afterBody["tokenBalance"].(float64)
	if !ok {
		t.Fatalf("expected numeric token balance after proposal, got %v", afterBody["tokenBalance"])
	}
	if afterTokens != beforeTokens-1 {
		t.Fatalf("expected proposal round creation without merchant to consume one token, before=%v after=%v", beforeTokens, afterTokens)
	}
}

func TestCreateProposalWithSeedMerchantOnlyConsumesOneTotalToken(t *testing.T) {
	handler := newTestServer(t)
	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, token, "提案首店家群組")

	beforeMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", token, nil)
	if beforeMe.Code != http.StatusOK {
		t.Fatalf("expected member fetch before proposal create to return 200, got %d: %s", beforeMe.Code, beforeMe.Body.String())
	}
	beforeBody := decodeJSONBody(t, beforeMe)
	beforeTokens, ok := beforeBody["tokenBalance"].(float64)
	if !ok {
		t.Fatalf("expected numeric token balance before proposal create, got %v", beforeBody["tokenBalance"])
	}

	createProposal := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", token, map[string]any{
		"title":           "建立並帶第一家店",
		"groupId":         groupID,
		"merchantId":      "shop-bento",
		"maxOptions":      5,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if createProposal.Code != http.StatusCreated {
		t.Fatalf("expected proposal create with merchant to return 201, got %d: %s", createProposal.Code, createProposal.Body.String())
	}

	afterMe := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/members/me", token, nil)
	if afterMe.Code != http.StatusOK {
		t.Fatalf("expected member fetch after proposal create to return 200, got %d: %s", afterMe.Code, afterMe.Body.String())
	}
	afterBody := decodeJSONBody(t, afterMe)
	afterTokens, ok := afterBody["tokenBalance"].(float64)
	if !ok {
		t.Fatalf("expected numeric token balance after proposal create, got %v", afterBody["tokenBalance"])
	}
	if afterTokens != beforeTokens-1 {
		t.Fatalf("expected proposal create with seeded merchant to consume exactly one token overall, before=%v after=%v", beforeTokens, afterTokens)
	}
}

func TestAdminIndexerSyncRequiresAdminRole(t *testing.T) {
	handler := newTestServer(t)

	bobToken := loginAndGetToken(t, handler, "bob@example.com", "demo1234")
	rec := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/admin/indexer/sync", bobToken, map[string]any{})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin admin sync, got %d", rec.Code)
	}

	body := decodeJSONBody(t, rec)
	if body["error"] != "admin access required" {
		t.Fatalf("unexpected non-admin error body: %v", body)
	}
}

func TestAdminIndexerSyncAllowsAdminRequests(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	rec := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/admin/indexer/sync", aliceToken, map[string]any{})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected admin request to reach handler and fail with 400 when indexer is unavailable, got %d", rec.Code)
	}

	body := decodeJSONBody(t, rec)
	if body["error"] != "indexer unavailable" {
		t.Fatalf("unexpected admin sync response body: %v", body)
	}
}

func TestLoginRateLimitBlocksRepeatedAttemptsFromSameIP(t *testing.T) {
	handler := newTestServer(t)
	const ip = "203.0.113.10"

	challenge := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/challenge", ip, map[string]string{
		"walletAddress": aliceDemoWallet,
	})
	if challenge.Code != http.StatusOK {
		t.Fatalf("expected challenge setup to return 200, got %d: %s", challenge.Code, challenge.Body.String())
	}

	for attempt := 0; attempt < loginRateLimitMax; attempt++ {
		rec := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/verify", ip, map[string]string{
			"walletAddress": aliceDemoWallet,
			"signature":     "0xdeadbeef",
		})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected attempt %d to return 401, got %d", attempt+1, rec.Code)
		}
	}

	blocked := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/verify", ip, map[string]string{
		"walletAddress": aliceDemoWallet,
		"signature":     "0xdeadbeef",
	})
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("expected rate-limited login to return 429, got %d", blocked.Code)
	}
	if blocked.Header().Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header on rate-limited login response")
	}
	body := decodeJSONBody(t, blocked)
	if body["error"] != "too many requests, please try again later" {
		t.Fatalf("unexpected rate-limit error body: %v", body)
	}
}

func TestWalletChallengeRateLimitBlocksRepeatedAttemptsFromSameIP(t *testing.T) {
	handler := newTestServer(t)
	const ip = "203.0.113.20"

	for attempt := 0; attempt < registerRateLimitMax; attempt++ {
		rec := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/challenge", ip, map[string]string{
			"walletAddress": "not-a-wallet",
		})
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected wallet-challenge attempt %d to return 400, got %d", attempt+1, rec.Code)
		}
	}

	blocked := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/challenge", ip, map[string]string{
		"walletAddress": "not-a-wallet",
	})
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("expected rate-limited wallet challenge to return 429, got %d", blocked.Code)
	}
	body := decodeJSONBody(t, blocked)
	if body["error"] != "too many requests, please try again later" {
		t.Fatalf("unexpected wallet-challenge rate-limit error body: %v", body)
	}
}

func TestConfigurableLoginRateLimitUsesConfiguredThreshold(t *testing.T) {
	handler := newTestServerWithConfig(t, config.Config{
		RateLimit: config.RateLimitConfig{
			Login: config.EndpointRateLimit{
				MaxRequests:   2,
				WindowSeconds: 60,
			},
		},
	})
	const ip = "203.0.113.30"

	challenge := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/challenge", ip, map[string]string{
		"walletAddress": aliceDemoWallet,
	})
	if challenge.Code != http.StatusOK {
		t.Fatalf("expected challenge setup to return 200, got %d: %s", challenge.Code, challenge.Body.String())
	}

	for attempt := 0; attempt < 2; attempt++ {
		rec := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/verify", ip, map[string]string{
			"walletAddress": aliceDemoWallet,
			"signature":     "0xdeadbeef",
		})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected configured login attempt %d to return 401, got %d", attempt+1, rec.Code)
		}
	}

	blocked := performJSONRequestFromIP(t, handler, http.MethodPost, "/auth/wallet/verify", ip, map[string]string{
		"walletAddress": aliceDemoWallet,
		"signature":     "0xdeadbeef",
	})
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("expected configured login rate limit to return 429, got %d", blocked.Code)
	}
}

func TestPendingTransactionFlowIsScopedToCurrentMember(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	bobToken := loginAndGetToken(t, handler, "bob@example.com", "demo1234")
	const txHash = "0xfeedbeef"

	created := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/transactions", aliceToken, map[string]any{
		"proposalId":    1,
		"action":        "place_order",
		"txHash":        txHash,
		"walletAddress": "0x0000000000000000000000000000000000000A11",
		"relatedOrder":  "0xorderhash",
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("expected transaction create to return 201, got %d: %s", created.Code, created.Body.String())
	}
	createdBody := decodeJSONBody(t, created)
	if createdBody["txHash"] != txHash {
		t.Fatalf("expected created transaction txHash %s, got %v", txHash, createdBody["txHash"])
	}
	if createdBody["action"] != "place_order" {
		t.Fatalf("expected created transaction action place_order, got %v", createdBody["action"])
	}

	listed := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/transactions?limit=8", aliceToken, nil)
	if listed.Code != http.StatusOK {
		t.Fatalf("expected transaction list to return 200, got %d: %s", listed.Code, listed.Body.String())
	}
	listBody := decodeJSONArrayBody(t, listed)
	if len(listBody) != 1 {
		t.Fatalf("expected exactly one transaction for alice, got %d", len(listBody))
	}
	if listBody[0]["txHash"] != txHash {
		t.Fatalf("expected listed transaction txHash %s, got %v", txHash, listBody[0]["txHash"])
	}

	fetched := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/transactions/"+txHash, aliceToken, nil)
	if fetched.Code != http.StatusOK {
		t.Fatalf("expected transaction fetch to return 200, got %d: %s", fetched.Code, fetched.Body.String())
	}
	fetchedBody := decodeJSONBody(t, fetched)
	if fetchedBody["txHash"] != txHash {
		t.Fatalf("expected fetched transaction txHash %s, got %v", txHash, fetchedBody["txHash"])
	}

	otherMemberFetch := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/transactions/"+txHash, bobToken, nil)
	if otherMemberFetch.Code != http.StatusNotFound {
		t.Fatalf("expected other member fetch to return 404, got %d: %s", otherMemberFetch.Code, otherMemberFetch.Body.String())
	}

	otherMemberList := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/transactions?limit=8", bobToken, nil)
	if otherMemberList.Code != http.StatusOK {
		t.Fatalf("expected other member list to return 200, got %d: %s", otherMemberList.Code, otherMemberList.Body.String())
	}
	otherListBody := decodeJSONArrayBody(t, otherMemberList)
	if len(otherListBody) != 0 {
		t.Fatalf("expected bob to see no alice transactions, got %d entries", len(otherListBody))
	}
}

func TestCreateProposalCanSeedFirstMerchantOption(t *testing.T) {
	handler := newTestServer(t)
	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, token, "午餐群組")

	rec := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", token, map[string]any{
		"title":           "信義總部中餐投票",
		"description":     "信義總部中餐局",
		"mealPeriod":      oppositeTestMealPeriod(),
		"groupId":         groupID,
		"merchantId":      "shop-bento",
		"maxOptions":      5,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected create proposal with merchant to return 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var proposal models.Proposal
	if err := json.Unmarshal(rec.Body.Bytes(), &proposal); err != nil {
		t.Fatalf("decode proposal response: %v", err)
	}
	if proposal.MealPeriod != currentTestMealPeriod() {
		t.Fatalf("expected current meal period %s, got %s", currentTestMealPeriod(), proposal.MealPeriod)
	}
	if len(proposal.Options) != 1 {
		t.Fatalf("expected proposal to include one seeded merchant option, got %d", len(proposal.Options))
	}
	if proposal.Options[0].MerchantID != "shop-bento" {
		t.Fatalf("expected first merchant option shop-bento, got %s", proposal.Options[0].MerchantID)
	}
}

func TestOrderSignUsesChainProposalIDForSignatureHash(t *testing.T) {
	appStore := testpg.OpenStore(t, models.ContractInfo{})

	chainClient, err := blockchain.NewClient(config.ChainConfig{
		ChainID:            11155111,
		OrderContract:      "0x00000000000000000000000000000000000000A1",
		MembershipToken:    "0x00000000000000000000000000000000000000B2",
		PlatformTreasury:   "0x00000000000000000000000000000000000000C3",
		SignatureExpirySec: 300,
	})
	if err != nil {
		t.Fatalf("create blockchain client: %v", err)
	}

	handler := NewServer(config.Config{}, appStore, chainClient).Routes()
	memberSvc := service.NewMemberService(appStore)
	alice, _, err := memberSvc.Login("alice@example.com", "demo1234")
	if err != nil {
		t.Fatalf("login alice via service: %v", err)
	}

	now := time.Now().UTC()
	err = appStore.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 50,
			BlockHash:   "0xchainproposal",
			TxHash:      "0xchainproposal",
			LogIndex:    0,
			EventName:   "ProposalCreated",
			ProposalID:  42,
			PayloadJSON: mustJSON(t, map[string]any{
				"creator":          aliceDemoWallet,
				"proposalDeadline": now.Add(-90 * time.Minute).Unix(),
				"voteDeadline":     now.Add(-60 * time.Minute).Unix(),
				"orderDeadline":    now.Add(30 * time.Minute).Unix(),
			}),
		},
		{
			BlockNumber: 50,
			BlockHash:   "0xchainoption",
			TxHash:      "0xchainoption",
			LogIndex:    1,
			EventName:   "OptionAdded",
			ProposalID:  42,
			PayloadJSON: mustJSON(t, map[string]any{
				"optionIndex": 0,
				"merchantId":  "shop-hotpot",
				"proposer":    aliceDemoWallet,
				"cost":        10,
			}),
		},
		{
			BlockNumber: 51,
			BlockHash:   "0xchainfinalized",
			TxHash:      "0xchainfinalized",
			LogIndex:    0,
			EventName:   "VoteFinalized",
			ProposalID:  42,
			PayloadJSON: mustJSON(t, map[string]any{
				"winnerOptionIndex": 0,
				"merchantId":        "shop-hotpot",
				"weightedVotes":     12,
			}),
		},
	}, 51, "")
	if err != nil {
		t.Fatalf("seed chain-backed proposal: %v", err)
	}

	var localProposalID int64
	for _, proposal := range appStore.ListProposals() {
		if proposal.ChainProposalID != nil && *proposal.ChainProposalID == 42 {
			localProposalID = proposal.ID
			break
		}
	}
	if localProposalID == 0 {
		t.Fatalf("expected imported local proposal for chain proposal 42")
	}
	group, err := appStore.CreateGroup(alice.ID, "鏈上點餐群組", "鏈上點餐群組")
	if err != nil {
		t.Fatalf("create group for order-sign test: %v", err)
	}
	if err := appStore.SetProposalGroupID(localProposalID, group.ID); err != nil {
		t.Fatalf("link proposal to group: %v", err)
	}

	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	rec := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/orders/sign", token, map[string]any{
		"proposalId": localProposalID,
		"items": map[string]int64{
			"hotpot-set": 1,
		},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected order sign to succeed, got %d: %s", rec.Code, rec.Body.String())
	}

	var body struct {
		Quote     models.OrderQuote     `json:"quote"`
		Signature models.OrderSignature `json:"signature"`
		Order     models.Order          `json:"order"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode order sign response: %v", err)
	}

	expectedHash := computeOrderHash(42, alice.ID, body.Quote.Items)
	unexpectedHash := computeOrderHash(localProposalID, alice.ID, body.Quote.Items)
	if body.Signature.OrderHash != expectedHash {
		t.Fatalf("expected order hash %s signed against chain proposal id, got %s", expectedHash, body.Signature.OrderHash)
	}
	if body.Signature.OrderHash == unexpectedHash {
		t.Fatalf("expected order hash to avoid local proposal id %d", localProposalID)
	}
	if body.Order.OrderHash != expectedHash {
		t.Fatalf("expected persisted order hash %s, got %s", expectedHash, body.Order.OrderHash)
	}
}

func TestOrderSignAllowsLocalProposalOrderingWithoutChainMapping(t *testing.T) {
	appStore := testpg.OpenStore(t, models.ContractInfo{})

	handler := NewServer(config.Config{}, appStore, nil).Routes()
	memberSvc := service.NewMemberService(appStore)
	alice, _, err := memberSvc.Login("alice@example.com", "demo1234")
	if err != nil {
		t.Fatalf("login alice via service: %v", err)
	}

	group, err := appStore.CreateGroup(alice.ID, "本地点餐群組", "本地点餐群組")
	if err != nil {
		t.Fatalf("create local-order group: %v", err)
	}

	now := time.Now().UTC()
	proposal, err := appStore.CreateProposal(
		alice.ID,
		"本地午餐局",
		"",
		"all",
		"lunch",
		now.In(time.Local).Format("2006-01-02"),
		5,
		"Alice",
		now.Add(-90*time.Minute),
		now.Add(-30*time.Minute),
		now.Add(30*time.Minute),
	)
	if err != nil {
		t.Fatalf("create local proposal: %v", err)
	}
	if err := appStore.SetProposalGroupID(proposal.ID, group.ID); err != nil {
		t.Fatalf("link local proposal to group: %v", err)
	}
	option, err := appStore.InsertProposalOption(proposal.ID, alice.ID, "shop-hotpot", "湯潮火鍋", "Alice", 0, false)
	if err != nil {
		t.Fatalf("insert winning option: %v", err)
	}
	if option.ID == 0 {
		t.Fatal("expected inserted option id")
	}
	if err := appStore.AdvanceProposalStage(proposal.ID, "ordering"); err != nil {
		t.Fatalf("advance local proposal to ordering: %v", err)
	}

	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	rec := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/orders/sign", token, map[string]any{
		"proposalId": proposal.ID,
		"items": map[string]int64{
			"hotpot-set": 1,
		},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected local order sign to succeed, got %d: %s", rec.Code, rec.Body.String())
	}

	var body struct {
		Quote     models.OrderQuote     `json:"quote"`
		Signature models.OrderSignature `json:"signature"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode local order sign response: %v", err)
	}

	expectedHash := computeOrderHash(proposal.ID, alice.ID, body.Quote.Items)
	if body.Signature.OrderHash != expectedHash {
		t.Fatalf("expected local order hash %s, got %s", expectedHash, body.Signature.OrderHash)
	}
	finalize := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/orders/finalize", token, map[string]any{
		"proposalId": proposal.ID,
		"items": map[string]int64{
			"hotpot-set": 1,
		},
		"signature": body.Signature,
	})
	if finalize.Code != http.StatusCreated {
		t.Fatalf("expected local order finalize to succeed, got %d: %s", finalize.Code, finalize.Body.String())
	}

	var order models.Order
	if err := json.Unmarshal(finalize.Body.Bytes(), &order); err != nil {
		t.Fatalf("decode local finalize order response: %v", err)
	}
	if order.Status != "paid_local" {
		t.Fatalf("expected local order status paid_local, got %s", order.Status)
	}
	if order.MemberName != "Alice" {
		t.Fatalf("expected local order member name Alice, got %q", order.MemberName)
	}
}

func TestProposalVisibilityIsScopedToMemberGroups(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	bobToken := loginAndGetToken(t, handler, "bob@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, aliceToken, "只給 Alice 的群組")

	created := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", aliceToken, map[string]any{
		"title":           "Alice 專用提案",
		"description":     "只有群組成員能看到",
		"groupId":         groupID,
		"merchantId":      "shop-bento",
		"maxOptions":      3,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("expected create scoped proposal to return 201, got %d: %s", created.Code, created.Body.String())
	}

	var proposal models.Proposal
	if err := json.Unmarshal(created.Body.Bytes(), &proposal); err != nil {
		t.Fatalf("decode created proposal: %v", err)
	}

	aliceList := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/proposals", aliceToken, nil)
	if aliceList.Code != http.StatusOK {
		t.Fatalf("expected alice proposal list to return 200, got %d: %s", aliceList.Code, aliceList.Body.String())
	}
	if len(decodeJSONArrayBody(t, aliceList)) != 1 {
		t.Fatalf("expected alice to see her group's proposal")
	}

	bobList := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/proposals", bobToken, nil)
	if bobList.Code != http.StatusOK {
		t.Fatalf("expected bob proposal list to return 200, got %d: %s", bobList.Code, bobList.Body.String())
	}
	if len(decodeJSONArrayBody(t, bobList)) != 0 {
		t.Fatalf("expected bob to see no proposals outside his groups")
	}

	bobGet := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/proposals/"+strconv.FormatInt(proposal.ID, 10), bobToken, nil)
	if bobGet.Code != http.StatusForbidden {
		t.Fatalf("expected bob proposal fetch to return 403, got %d: %s", bobGet.Code, bobGet.Body.String())
	}
	body := decodeJSONBody(t, bobGet)
	if body["error"] != "forbidden" {
		t.Fatalf("unexpected forbidden error body: %v", body)
	}
}

func TestProposalActionsRequireJoiningAGroupFirst(t *testing.T) {
	handler := newTestServer(t)

	bobToken := loginAndGetToken(t, handler, "bob@example.com", "demo1234")
	created := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", bobToken, map[string]any{
		"title":           "沒有群組的提案",
		"description":     "應該被擋下",
		"merchantId":      "shop-bento",
		"maxOptions":      3,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if created.Code != http.StatusBadRequest {
		t.Fatalf("expected create proposal without group to return 400, got %d: %s", created.Code, created.Body.String())
	}
	body := decodeJSONBody(t, created)
	if body["error"] != "join a group first" {
		t.Fatalf("unexpected no-group error body: %v", body)
	}
}

func TestCreateProposalUsesCurrentRoundAndRejectsSecondProposer(t *testing.T) {
	handler := newTestServer(t)
	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, token, "一日兩輪群組")

	firstCreated := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", token, map[string]any{
		"title":           "本輪投票",
		"description":     "由系統依目前時間決定餐別",
		"mealPeriod":      oppositeTestMealPeriod(),
		"proposalDate":    "2099-01-01",
		"groupId":         groupID,
		"maxOptions":      5,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if firstCreated.Code != http.StatusCreated {
		t.Fatalf("expected first current-round proposal create to return 201, got %d: %s", firstCreated.Code, firstCreated.Body.String())
	}

	var firstProposal models.Proposal
	if err := json.Unmarshal(firstCreated.Body.Bytes(), &firstProposal); err != nil {
		t.Fatalf("decode first proposal: %v", err)
	}
	if firstProposal.MealPeriod != currentTestMealPeriod() {
		t.Fatalf("expected server to use current meal period %s, got %s", currentTestMealPeriod(), firstProposal.MealPeriod)
	}
	if firstProposal.ProposalDate != time.Now().In(time.Local).Format("2006-01-02") {
		t.Fatalf("expected server to use today's date, got %s", firstProposal.ProposalDate)
	}

	duplicateCurrentRound := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", token, map[string]any{
		"title":           "第二位發起者",
		"description":     "不應建立",
		"mealPeriod":      currentTestMealPeriod(),
		"proposalDate":    "2099-12-31",
		"groupId":         groupID,
		"maxOptions":      5,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if duplicateCurrentRound.Code != http.StatusBadRequest {
		t.Fatalf("expected duplicate current-round proposal create to return 400, got %d: %s", duplicateCurrentRound.Code, duplicateCurrentRound.Body.String())
	}
	body := decodeJSONBody(t, duplicateCurrentRound)
	if body["error"] != "this group already has a proposer for the current round" {
		t.Fatalf("unexpected duplicate-round error body: %v", body)
	}
}

func TestCreateProposalValidatesTitleAndOptionRange(t *testing.T) {
	handler := newTestServer(t)
	token := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, token, "提案驗證群組")

	missingTitle := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", token, map[string]any{
		"title":           "   ",
		"groupId":         groupID,
		"maxOptions":      5,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if missingTitle.Code != http.StatusBadRequest {
		t.Fatalf("expected missing title proposal create to return 400, got %d: %s", missingTitle.Code, missingTitle.Body.String())
	}
	if decodeJSONBody(t, missingTitle)["error"] != "title is required" {
		t.Fatalf("unexpected missing-title error body: %s", missingTitle.Body.String())
	}

	invalidMaxOptions := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/proposals", token, map[string]any{
		"title":           "候選數太少",
		"groupId":         groupID,
		"maxOptions":      2,
		"proposalMinutes": 30,
		"voteMinutes":     30,
		"orderMinutes":    30,
	})
	if invalidMaxOptions.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid maxOptions proposal create to return 400, got %d: %s", invalidMaxOptions.Code, invalidMaxOptions.Body.String())
	}
	if decodeJSONBody(t, invalidMaxOptions)["error"] != "maxOptions must be between 3 and 10" {
		t.Fatalf("unexpected invalid-maxOptions error body: %s", invalidMaxOptions.Body.String())
	}
}

func TestLeaveGroupRemovesNonOwnerMembership(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	bobToken := loginAndGetToken(t, handler, "bob@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, aliceToken, "可退出群組")

	groupRec := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/groups/"+strconv.FormatInt(groupID, 10), aliceToken, nil)
	if groupRec.Code != http.StatusOK {
		t.Fatalf("expected owner group fetch to return 200, got %d: %s", groupRec.Code, groupRec.Body.String())
	}
	groupBody := decodeJSONBody(t, groupRec)
	inviteCode, ok := groupBody["inviteCode"].(string)
	if !ok || inviteCode == "" {
		t.Fatalf("expected invite code in group payload, got %v", groupBody["inviteCode"])
	}

	joined := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/join/"+inviteCode, bobToken, nil)
	if joined.Code != http.StatusOK {
		t.Fatalf("expected join group to return 200, got %d: %s", joined.Code, joined.Body.String())
	}

	left := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/groups/"+strconv.FormatInt(groupID, 10)+"/leave", bobToken, map[string]any{})
	if left.Code != http.StatusOK {
		t.Fatalf("expected leave group to return 200, got %d: %s", left.Code, left.Body.String())
	}

	groupsRec := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/groups", bobToken, nil)
	if groupsRec.Code != http.StatusOK {
		t.Fatalf("expected list groups after leave to return 200, got %d: %s", groupsRec.Code, groupsRec.Body.String())
	}
	groupsBody := decodeJSONArrayBody(t, groupsRec)
	if len(groupsBody) != 0 {
		t.Fatalf("expected bob to have no groups after leaving, got %d", len(groupsBody))
	}
}

func TestLeaveGroupRejectsOwnerExit(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, aliceToken, "擁有者不能退出")
	bobToken := loginAndGetToken(t, handler, "bob@example.com", "demo1234")
	groupRec := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/groups/"+strconv.FormatInt(groupID, 10), aliceToken, nil)
	inviteCode := decodeJSONBody(t, groupRec)["inviteCode"].(string)
	joined := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/join/"+inviteCode, bobToken, nil)
	if joined.Code != http.StatusOK {
		t.Fatalf("expected bob to join group, got %d: %s", joined.Code, joined.Body.String())
	}

	left := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/groups/"+strconv.FormatInt(groupID, 10)+"/leave", aliceToken, map[string]any{})
	if left.Code != http.StatusBadRequest {
		t.Fatalf("expected owner leave group to return 400, got %d: %s", left.Code, left.Body.String())
	}
	body := decodeJSONBody(t, left)
	if body["error"] != "group owner cannot leave while other members remain" {
		t.Fatalf("unexpected owner-leave error body: %v", body)
	}
}

func TestGroupInviteCodeIsDeterministicForGroup(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, aliceToken, "固定邀請碼群組")

	groupRec := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/groups/"+strconv.FormatInt(groupID, 10), aliceToken, nil)
	if groupRec.Code != http.StatusOK {
		t.Fatalf("expected get group to return 200, got %d: %s", groupRec.Code, groupRec.Body.String())
	}
	groupBody := decodeJSONBody(t, groupRec)
	inviteCode, ok := groupBody["inviteCode"].(string)
	if !ok || inviteCode == "" {
		t.Fatalf("expected invite code in group payload, got %v", groupBody["inviteCode"])
	}
	expectedCode := "group-" + strconv.FormatInt(groupID, 10)
	if inviteCode != expectedCode {
		t.Fatalf("expected deterministic invite code %s, got %s", expectedCode, inviteCode)
	}

	inviteRec := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/groups/"+strconv.FormatInt(groupID, 10)+"/invite", aliceToken, map[string]any{})
	if inviteRec.Code != http.StatusCreated {
		t.Fatalf("expected create invite to return 201, got %d: %s", inviteRec.Code, inviteRec.Body.String())
	}
	inviteBody := decodeJSONBody(t, inviteRec)
	if inviteBody["inviteCode"] != expectedCode {
		t.Fatalf("expected repeated invite code %s, got %v", expectedCode, inviteBody["inviteCode"])
	}
}

func TestLeaveGroupAllowsOwnerExitWhenTheyAreSoleMemberAndDeletesGroup(t *testing.T) {
	handler := newTestServer(t)

	aliceToken := loginAndGetToken(t, handler, "alice@example.com", "demo1234")
	groupID := createGroupAndGetID(t, handler, aliceToken, "只剩擁有者可刪群")

	left := performAuthorizedJSONRequest(t, handler, http.MethodPost, "/groups/"+strconv.FormatInt(groupID, 10)+"/leave", aliceToken, map[string]any{})
	if left.Code != http.StatusOK {
		t.Fatalf("expected sole owner leave group to return 200, got %d: %s", left.Code, left.Body.String())
	}
	body := decodeJSONBody(t, left)
	if body["deleted"] != true {
		t.Fatalf("expected deleted=true body, got %v", body)
	}

	groupRec := performAuthorizedJSONRequest(t, handler, http.MethodGet, "/groups/"+strconv.FormatInt(groupID, 10), aliceToken, nil)
	if groupRec.Code != http.StatusForbidden {
		t.Fatalf("expected deleted group access to be forbidden, got %d: %s", groupRec.Code, groupRec.Body.String())
	}
}

func mustJSON(t *testing.T, payload map[string]any) string {
	t.Helper()

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal json payload: %v", err)
	}
	return string(body)
}
