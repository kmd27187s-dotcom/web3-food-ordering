package handlers

import (
	"encoding/json"
	"net/http"

	"voting-backend/blockchain"
)

type Handler struct {
	bc *blockchain.Client
}

func New(bc *blockchain.Client) *Handler {
	return &Handler{bc: bc}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) GetContractInfo(w http.ResponseWriter, r *http.Request) {
	info, err := h.bc.GetContractInfo(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (h *Handler) GetAllProposals(w http.ResponseWriter, r *http.Request) {
	proposals, err := h.bc.GetAllProposals(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, proposals)
}

// TODO: 實作 GetProposal handler
// 需求：
//  1. 從 URL 路徑取得 proposal id（使用 r.PathValue("id")）
//  2. 將 id 字串轉成 uint64（使用 strconv.ParseUint）
//  3. 呼叫 h.bc.GetProposal(r.Context(), id) 取得提案
//  4. 回傳 JSON（使用 writeJSON）
//  5. 錯誤時回傳適當的 HTTP status code
func (h *Handler) GetProposal(w http.ResponseWriter, r *http.Request) {
	// 請在這裡實作
	writeError(w, http.StatusNotImplemented, "GetProposal not implemented yet")
}

// TODO: 實作 HasVoted handler
// 需求：
//  1. 從 URL 路徑取得 proposal id（使用 r.PathValue("id")）
//  2. 從 query parameter 取得 voter 地址（使用 r.URL.Query().Get("voter")）
//  3. 驗證 voter 不為空
//  4. 呼叫 h.bc.HasVoted(r.Context(), id, voter) 查詢
//  5. 回傳 JSON 格式 {"hasVoted": true/false}
func (h *Handler) HasVoted(w http.ResponseWriter, r *http.Request) {
	// 請在這裡實作
	writeError(w, http.StatusNotImplemented, "HasVoted not implemented yet")
}
