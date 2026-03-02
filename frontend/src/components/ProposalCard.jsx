import { useState, useEffect, useMemo } from "react";

// TODO: 實作倒數計時 hook
// 需求：
//   1. 接收 deadline（unix timestamp）
//   2. 每秒更新一次
//   3. 計算剩餘時間（小時、分鐘、秒）
//   4. 如果已過期，回傳 "Ended"
//   5. 否則回傳格式化字串，例如 "2h 30m 15s"
function useCountdown(deadline) {
  // 請在這裡實作
  return "-- TODO --";
}

// TODO: 實作提案卡片元件
// Props:
//   - proposal: { id, title, description, creator, yesVotes, noVotes, deadline }
//   - account: 當前使用者錢包地址
//   - contract: ethers.js 合約實例（用來呼叫 hasVoted）
//   - onVote: function(proposalId, support) — 投票 callback
//   - disabled: boolean — 是否禁用按鈕
//
// 需求：
//   1. 顯示提案標題、描述、建立者地址（截斷顯示）
//   2. 顯示倒數計時（使用 useCountdown hook）
//   3. 顯示投票進度條（贊成 vs 反對比例）
//   4. 顯示 Yes / No 票數
//   5. 如果投票未結束且使用者未投票，顯示 Vote Yes / Vote No 按鈕
//   6. 如果使用者已投票，顯示 "You already voted"
//   7. 如果投票已結束，不顯示投票按鈕
//
// 提示：
//   - 用 contract.hasVoted(proposal.id, account) 查詢是否已投票
//   - CSS class 已經準備好：proposal-card, proposal-header, status-badge,
//     vote-bar, bar-track, bar-fill, vote-counts, vote-actions,
//     yes-btn, no-btn, voted-label, active, ended
export default function ProposalCard({
  proposal,
  account,
  contract,
  onVote,
  disabled,
}) {
  // 請在這裡實作

  return (
    <div className="proposal-card">
      <p>TODO: 實作提案卡片 — 提案 #{proposal.id} {proposal.title}</p>
    </div>
  );
}
