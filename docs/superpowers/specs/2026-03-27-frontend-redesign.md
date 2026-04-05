# MealVote 前端重設計 Spec

**日期：** 2026-03-27
**範圍：** `frontend/index.html`、`frontend/order.html`、`frontend/src/styles.css`、`frontend/src/main.js`（視覺層）、`frontend/src/order.js`（視覺層）
**不在範圍：** `login.html`、後端邏輯、合約互動、API 呼叫、state 管理

---

## 設計決策

| 項目 | 決策 |
|------|------|
| 風格 | 暖系精緻 — 保留現有暖棕色 token，提升視覺層次 |
| 版面 | 頂部導覽列（取代左側 sidebar） |
| 密度 | 緊湊高效 — 同螢幕可見更多資訊 |
| 實作方式 | 方案 B：視覺全面重建（重寫 CSS + HTML 模板，不動業務邏輯） |

---

## 色彩 Token（保持不變）

```css
--bg: #f5f1e8
--paper: rgba(255, 252, 246, 0.88)
--line: rgba(83, 60, 39, 0.15)
--ink: #2b1e15
--muted: #7a6654
--accent: #bf5d36
--accent-soft: #f1c7a9
--green: #3d8a5c  /* 點餐中狀態 */
```

---

## 元件規範

### Topnav
- 高度 52px，`background: rgba(255,252,246,0.95)`，`backdrop-filter: blur(12px)`
- 左側：Logo（Manrope 800）+ 標籤群（投票 / 點餐 / 排行榜 / 交易）
- 右側：用戶名稱 + 積分/Token + 頭像圓形
- 活躍標籤：`background: var(--ink)`, `color: #fff9f1`, `border-radius: 999px`

### 提案卡片（ProposalCard）
- border-radius: 14px，padding: 14px 16px
- 三種狀態樣式：
  - **投票中**：border `rgba(191,93,54,0.25)`，狀態標籤橘底
  - **點餐中**：border `rgba(80,156,100,0.25)`，狀態標籤綠底，右上角「點餐 →」按鈕
  - **即將開始 / 已結束**：opacity 降低，border 較淡
- 投票中卡片：顯示各候選餐廳進度條（高度 5px）

### 部門 Strip
- 位於 topnav 下方，高度約 40px
- 左側：部門 pill 群
- 右側：「＋ 新增提案」按鈕（`background: #bf5d36`）

### 側邊資訊欄（主頁右欄，寬 300px）
- 積分 / Token 卡片（2 欄數字）
- 排行榜前三（含名次編號、用戶名、積分）
- 錢包卡片（地址縮寫、鏈名、ETH 餘額）

---

## 主頁（index.html）結構

```
<topnav>
<org-strip>  ← 部門切換 + 新增提案按鈕
<main style="display:grid; grid-template-columns: 1fr 300px; gap:16px; padding:16px 24px">
  <proposal-list>
    <section-label>進行中 · N</section-label>
    <ProposalCard status="voting" />
    <ProposalCard status="ordering" />
    <section-label>即將開始 · N</section-label>
    <ProposalCard status="upcoming" />
    <section-label>已結束 · N</section-label>
    <ProposalCard status="ended" /> × N
  </proposal-list>
  <sidebar>
    <stats-card />      ← 積分 + Token
    <leaderboard-card /> ← 前三名
    <wallet-card />
  </sidebar>
</main>
```

---

## 新增提案（Create Proposal）

呈現方式：在主頁主內容區取代提案列表（stage page，非 modal）。

### 表單欄位
1. 提案標題（text input）
2. 部門（select）
3. 餐期（select：午餐 / 晚餐）
4. 三個截止時間（datetime-local × 3）：提案截止、投票截止、點餐截止
5. 候選餐廳：已加入清單 + 下拉選擇新增

### 右側說明欄
- 四步驟操作說明
- On-chain 模式提示卡（橘色邊框）

---

## 點餐頁（order.html）結構

```
<topnav-order>  ← 返回按鈕 + 餐廳名 + 狀態標籤 + 截止時間
<main style="display:grid; grid-template-columns: 1fr 280px; gap:16px; padding:16px 24px">
  <menu-panel>
    <winner-banner />    ← 橘色漸層，顯示冠軍餐廳 + 得票率
    <category-tabs />    ← 全部 / 主食 / 飲料 / 加點
    <menu-list>
      <MenuItem />  × N  ← 名稱、描述、價格、數量控制（−/數字/＋）
    </menu-list>
  </menu-panel>
  <order-summary>        ← sticky
    <item-list />
    <total />
    <note-textarea />
    <submit-button />    ← 確認下單（bg: #bf5d36）
    <tx-status-hint />   ← 下單後顯示交易狀態
  </order-summary>
</main>
```

---

## 響應式斷點

`@media (max-width: 1080px)`：
- 主頁：雙欄改單欄（sidebar 移到列表下方）
- 點餐頁：雙欄改單欄（訂單摘要移到菜單下方）
- Topnav 標籤群收合為 icon only 或 hamburger

---

## 實作範圍說明

**要動的檔案：**
- `frontend/src/styles.css` — 全面重寫
- `frontend/index.html` — 更新 HTML 骨架（shell、topnav）
- `frontend/order.html` — 更新 HTML 骨架
- `frontend/src/main.js` — 更新 `renderShell()`、`renderTopNav()`、`renderProposalCard()`、`renderSidebar()` 等 DOM 生成函式的 HTML 字串，class 名稱與新 CSS 對應
- `frontend/src/order.js` — 更新 DOM 生成函式

**不動的：**
- API 呼叫、state 管理、錢包連線、區塊鏈互動、投票邏輯、後端相關
