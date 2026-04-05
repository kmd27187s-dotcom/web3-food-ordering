package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"mealvoting/backend/internal/models"
)

type memberContextKey string

const authenticatedMemberContextKey memberContextKey = "authenticated_member"

func sessionToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
}

func transactionHashFromRequest(r *http.Request) string {
	txHash := strings.TrimSpace(r.PathValue("txHash"))
	if txHash != "" {
		return txHash
	}
	return strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/transactions/"))
}

func withAuthenticatedMember(r *http.Request, member *models.Member) *http.Request {
	if member == nil {
		return r
	}
	return r.WithContext(context.WithValue(r.Context(), authenticatedMemberContextKey, member))
}

func authenticatedMember(r *http.Request) *models.Member {
	member, _ := r.Context().Value(authenticatedMemberContextKey).(*models.Member)
	return member
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

func anonymizeProposals(proposals []*models.Proposal, memberID int64) []*models.Proposal {
	items := make([]*models.Proposal, 0, len(proposals))
	for _, proposal := range proposals {
		items = append(items, anonymizeProposal(proposal, memberID))
	}
	return items
}

func anonymizeProposal(proposal *models.Proposal, memberID int64) *models.Proposal {
	if proposal == nil {
		return nil
	}
	copyProposal := *proposal
	copyProposal.CreatedBy = 0
	copyProposal.CreatedByName = ""
	copyProposal.CurrentVoteOptionID = 0
	copyProposal.CurrentVoteTokenAmount = 0
	copyProposal.CurrentVoteWeight = 0

	copyProposal.Options = make([]*models.ProposalOption, 0, len(proposal.Options))
	for _, option := range proposal.Options {
		copyProposal.Options = append(copyProposal.Options, anonymizeOption(option))
	}

	copyProposal.Votes = make([]*models.VoteRecord, 0, len(proposal.Votes))
	for _, vote := range proposal.Votes {
		if vote == nil {
			continue
		}
		if memberID > 0 && vote.MemberID == memberID {
			copyProposal.CurrentVoteOptionID = vote.OptionID
			copyProposal.CurrentVoteTokenAmount = vote.TokenAmount
			copyProposal.CurrentVoteWeight = vote.VoteWeight
		}
		copyVote := *vote
		copyVote.MemberID = 0
		copyVote.MemberName = ""
		copyVote.WalletHidden = true
		copyProposal.Votes = append(copyProposal.Votes, &copyVote)
	}

	return &copyProposal
}

func anonymizeOption(option *models.ProposalOption) *models.ProposalOption {
	if option == nil {
		return nil
	}
	copyOption := *option
	copyOption.ProposerMember = 0
	copyOption.ProposerName = ""
	return &copyOption
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
