# MealVote 前端重設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將主頁（index.html）和點餐頁（order.html）從左側 sidebar 佈局重設計為頂部導覽列 + 緊湊卡片列表的暖系精緻風格。

**Architecture:** 全面重寫 `styles.css`（新增 topnav、proposal-card、org-strip 等 class），同步更新 `main.js` 和 `order.js` 中所有 DOM 生成函式的 HTML 字串，使 class 名稱與新 CSS 對應。業務邏輯（API 呼叫、state、區塊鏈）完全不動。

**Tech Stack:** Vanilla JS、原生 CSS（無框架）、Manrope + Noto Sans TC 字型

---

## File Map

| 檔案 | 動作 | 說明 |
|------|------|------|
| `frontend/src/styles.css` | 全面重寫 | 新設計 class 系統 |
| `frontend/src/main.js` | 修改視覺層函式 | 保留所有業務邏輯函式不動 |
| `frontend/src/order.js` | 修改 `render()` 及其子函式 | 保留所有業務邏輯函式不動 |
| `frontend/index.html` | 不動 | shell 由 JS 生成 |
| `frontend/order.html` | 不動 | shell 由 JS 生成 |

---

## Task 1: 重寫 styles.css — 基礎 token 與 reset

**Files:**
- Modify: `frontend/src/styles.css`（全部替換）

- [ ] **Step 1: 備份舊 CSS**

```bash
cp frontend/src/styles.css frontend/src/styles.css.bak
```

- [ ] **Step 2: 寫入新 CSS 基礎 token、reset 與 body**

將 `frontend/src/styles.css` 全部替換為以下內容（後續 Task 會繼續 append）：

```css
:root {
  --bg: #f5f1e8;
  --paper: rgba(255, 252, 246, 0.88);
  --line: rgba(83, 60, 39, 0.15);
  --ink: #2b1e15;
  --muted: #7a6654;
  --accent: #bf5d36;
  --accent-soft: #f1c7a9;
  --green: #3d8a5c;
  --shadow: 0 8px 32px rgba(75, 48, 24, 0.1);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, rgba(255, 233, 198, 0.8), transparent 28%),
    radial-gradient(circle at bottom right, rgba(220, 133, 88, 0.22), transparent 22%),
    linear-gradient(135deg, #f6f0e6 0%, #efe4d0 100%);
  font-family: "Noto Sans TC", sans-serif;
}

a { color: inherit; text-decoration: none; }

button, input, select, textarea { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
```

- [ ] **Step 3: 驗證**

```bash
cd frontend && python3 -m http.server 4173
```

在瀏覽器開 http://localhost:4173/index.html — 頁面應顯示暖色背景（不會空白）。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles.css frontend/src/styles.css.bak
git commit -m "style: init new css token system, keep old as .bak"
```

---

## Task 2: Topnav CSS

**Files:**
- Modify: `frontend/src/styles.css`（append）

- [ ] **Step 1: 在 styles.css 末尾加入 topnav 相關 class**

```css
/* ── Topnav ─────────────────────────────── */
.topnav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 52px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 252, 246, 0.95);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(12px);
}

.topnav-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.topnav-logo {
  font-family: "Manrope", sans-serif;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: -0.02em;
  color: var(--ink);
  white-space: nowrap;
}

.topnav-tabs {
  display: flex;
  gap: 2px;
}

.topnav-tab {
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 0.8rem;
  transition: background 150ms, color 150ms;
}

.topnav-tab:hover {
  background: rgba(83, 60, 39, 0.07);
  color: var(--ink);
}

.topnav-tab.active {
  background: var(--ink);
  color: #fff9f1;
  font-weight: 700;
}

.topnav-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topnav-user-meta {
  text-align: right;
  line-height: 1.3;
}

.topnav-user-meta span {
  display: block;
  font-size: 0.72rem;
  color: var(--muted);
}

.topnav-user-meta strong {
  display: block;
  font-size: 0.72rem;
  color: var(--accent);
  font-weight: 700;
}

.topnav-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.8rem;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
}

.topnav-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

/* Topnav for order page (simpler) */
.topnav-back {
  font-size: 0.8rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

.topnav-divider {
  width: 1px;
  height: 16px;
  background: var(--line);
}

.topnav-title {
  font-family: "Manrope", sans-serif;
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--ink);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: add topnav css classes"
```

---

## Task 3: Org Strip、主頁 Shell、Sidebar CSS

**Files:**
- Modify: `frontend/src/styles.css`（append）

- [ ] **Step 1: 加入 org-strip、page-shell、sidebar 相關 class**

```css
/* ── Org Strip ───────────────────────────── */
.org-strip {
  padding: 8px 24px;
  border-bottom: 1px solid rgba(83, 60, 39, 0.08);
  background: rgba(255, 252, 246, 0.6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.org-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.org-pill {
  border-radius: 999px;
  border: 1px solid rgba(83, 60, 39, 0.2);
  background: transparent;
  color: var(--muted);
  padding: 4px 12px;
  font-size: 0.75rem;
  transition: background 150ms, color 150ms;
}

.org-pill.active {
  background: var(--ink);
  color: #fff9f1;
  border-color: var(--ink);
  font-weight: 700;
}

.btn-new-proposal {
  border: none;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  transition: opacity 150ms;
}

.btn-new-proposal:hover { opacity: 0.88; }

/* ── Page Shell ──────────────────────────── */
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 52px auto 1fr;
}

.page-content {
  padding: 16px 24px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
  align-items: start;
}

/* ── Sidebar ─────────────────────────────── */
.sidebar {
  display: grid;
  gap: 8px;
}

.sidebar-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
}

.sidebar-card-title {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--ink);
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-item span {
  display: block;
  font-size: 0.68rem;
  color: var(--muted);
  margin-bottom: 2px;
}

.stat-item strong {
  font-family: "Manrope", sans-serif;
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--ink);
}

.leaderboard-list {
  display: grid;
  gap: 7px;
}

.leaderboard-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.leaderboard-row-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.leaderboard-rank {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--accent);
  min-width: 14px;
}

.leaderboard-rank.dim { color: var(--muted); }

.leaderboard-name {
  font-size: 0.82rem;
  color: var(--ink);
}

.leaderboard-pts {
  font-size: 0.75rem;
  color: var(--muted);
}

.wallet-address {
  font-size: 0.72rem;
  color: var(--ink);
  font-weight: 600;
  word-break: break-all;
}

.wallet-meta {
  font-size: 0.68rem;
  color: var(--muted);
  margin-top: 4px;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: add org-strip, page-shell, sidebar css"
```

---

## Task 4: Proposal Card CSS

**Files:**
- Modify: `frontend/src/styles.css`（append）

- [ ] **Step 1: 加入 proposal list 與 proposal card CSS**

```css
/* ── Proposal List ───────────────────────── */
.proposal-list {
  display: grid;
  gap: 8px;
}

.section-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 2px;
  margin-top: 4px;
}

.section-label:first-child { margin-top: 0; }

/* ── Proposal Card ───────────────────────── */
.proposal-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
  display: grid;
  gap: 10px;
  transition: box-shadow 150ms;
}

.proposal-card.voting   { border-color: rgba(191, 93, 54, 0.25); }
.proposal-card.ordering { border-color: rgba(61, 138, 92, 0.25); }
.proposal-card.dim      { opacity: 0.8; }

.proposal-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.proposal-card-info { flex: 1; min-width: 0; }

.proposal-card-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.status-badge {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.status-badge.voting   { color: var(--accent);  background: rgba(191, 93, 54, 0.1); }
.status-badge.ordering { color: var(--green);   background: rgba(61, 138, 92, 0.1); }
.status-badge.upcoming { color: var(--muted);   background: rgba(83, 60, 39, 0.07); }
.status-badge.ended    { color: var(--muted);   background: rgba(83, 60, 39, 0.07); }

.proposal-card-date {
  font-size: 0.68rem;
  color: var(--muted);
}

.proposal-card-title {
  font-weight: 800;
  font-size: 0.92rem;
  color: var(--ink);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proposal-card-subtitle {
  font-size: 0.72rem;
  color: var(--muted);
  margin-top: 2px;
}

/* ── Vote bars ───────────────────────────── */
.vote-bars {
  display: grid;
  gap: 5px;
}

.vote-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vote-bar-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink);
  min-width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vote-bar-track {
  flex: 1;
  height: 5px;
  background: rgba(83, 60, 39, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.vote-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
}

.vote-bar-fill.secondary { background: rgba(191, 93, 54, 0.3); }

.vote-bar-pct {
  font-size: 0.72rem;
  color: var(--muted);
  min-width: 30px;
  text-align: right;
}

/* ── Card action buttons ─────────────────── */
.btn-primary {
  border: none;
  background: var(--ink);
  color: #fff9f1;
  border-radius: 10px;
  padding: 6px 14px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  transition: opacity 150ms;
}

.btn-primary:hover { opacity: 0.85; }

.btn-ordering {
  border: none;
  background: var(--green);
  color: #fff;
  border-radius: 10px;
  padding: 6px 14px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.btn-ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 10px;
  padding: 5px 12px;
  font-size: 0.75rem;
  transition: border-color 150ms;
}

.btn-ghost:hover { border-color: var(--ink); color: var(--ink); }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: add proposal card and vote bar css"
```

---

## Task 5: 新增提案表單、Dialog、Utility CSS

**Files:**
- Modify: `frontend/src/styles.css`（append）

- [ ] **Step 1: 加入 create-proposal form、dialog、flash、responsive CSS**

```css
/* ── Create Proposal Form ────────────────── */
.create-proposal-panel {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 20px;
  display: grid;
  gap: 16px;
}

.create-proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.create-proposal-eyebrow {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.create-proposal-title {
  font-family: "Manrope", sans-serif;
  font-weight: 800;
  font-size: 1.05rem;
  color: var(--ink);
  margin: 0;
}

.form-divider {
  height: 1px;
  background: rgba(83, 60, 39, 0.1);
}

.form-stack { display: grid; gap: 12px; }

.form-row {
  display: grid;
  gap: 5px;
}

.form-row label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
}

.form-row input,
.form-row select,
.form-row textarea {
  width: 100%;
  border: 1px solid rgba(83, 60, 39, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.88rem;
  background: rgba(255, 255, 255, 0.7);
  color: var(--ink);
}

.form-row textarea { resize: none; }

.form-cols-2 { grid-template-columns: 1fr 1fr; gap: 10px; display: grid; }
.form-cols-3 { grid-template-columns: 1fr 1fr 1fr; gap: 10px; display: grid; }

.candidate-list { display: grid; gap: 6px; }

.candidate-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(83, 60, 39, 0.12);
  border-radius: 10px;
  padding: 9px 12px;
}

.candidate-item-info strong { display: block; font-size: 0.85rem; color: var(--ink); }
.candidate-item-info small  { font-size: 0.7rem; color: var(--muted); }

.btn-remove {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.8rem;
  cursor: pointer;
}

.candidate-add-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.candidate-add-row select { flex: 1; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-submit {
  border: none;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  padding: 9px 24px;
  font-size: 0.85rem;
  font-weight: 700;
}

.btn-cancel {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 9px 20px;
  font-size: 0.85rem;
}

.sidebar-help-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
}

.sidebar-help-steps { display: grid; gap: 8px; }

.sidebar-help-step {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 0.78rem;
  color: var(--muted);
}

.sidebar-help-step span:first-child {
  color: var(--accent);
  font-weight: 800;
  min-width: 16px;
}

.sidebar-onchain-card {
  background: rgba(191, 93, 54, 0.07);
  border: 1px solid rgba(191, 93, 54, 0.2);
  border-radius: 14px;
  padding: 14px 16px;
}

.sidebar-onchain-title {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--accent);
  margin-bottom: 6px;
}

.sidebar-onchain-body { font-size: 0.78rem; color: var(--muted); line-height: 1.5; }

/* ── Order Page ──────────────────────────── */
.order-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 52px 1fr;
}

.order-content {
  padding: 16px 24px;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 16px;
  align-items: start;
}

.order-menu-panel { display: grid; gap: 10px; }

.winner-banner {
  background: linear-gradient(135deg, rgba(191,93,54,0.12), rgba(255,252,246,0.6));
  border: 1px solid rgba(191, 93, 54, 0.2);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.winner-banner-left {}
.winner-banner-eyebrow { font-size: 0.68rem; font-weight: 800; color: var(--accent); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 3px; }
.winner-banner-name { font-family: "Manrope", sans-serif; font-size: 1rem; font-weight: 800; color: var(--ink); margin: 0; }
.winner-banner-sub { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }

.winner-banner-right { text-align: right; }
.winner-banner-deadline-label { font-size: 0.68rem; color: var(--muted); }
.winner-banner-deadline-time { font-family: "Manrope", sans-serif; font-size: 1.1rem; font-weight: 800; color: var(--accent); }

.category-tabs { display: flex; gap: 6px; }

.category-tab {
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 0.78rem;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  transition: background 150ms, color 150ms;
}

.category-tab.active { background: var(--ink); color: #fff9f1; border-color: var(--ink); font-weight: 700; }

.menu-list { display: grid; gap: 7px; }

.menu-item-card {
  background: var(--paper);
  border: 1px solid rgba(83, 60, 39, 0.12);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.menu-item-info { flex: 1; }
.menu-item-name { font-size: 0.88rem; font-weight: 700; color: var(--ink); }
.menu-item-desc { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }

.menu-item-right { display: flex; align-items: center; gap: 10px; }
.menu-item-price { font-size: 0.88rem; font-weight: 700; color: var(--ink); min-width: 56px; text-align: right; }

.qty-control { display: flex; align-items: center; gap: 6px; }

.qty-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms;
}

.qty-btn.inc { background: var(--ink); border-color: var(--ink); color: #fff9f1; }

.qty-value {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ink);
  min-width: 20px;
  text-align: center;
}

.order-summary-panel {
  display: grid;
  gap: 8px;
  position: sticky;
  top: 68px;
}

.order-summary-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  display: grid;
  gap: 12px;
}

.order-summary-title { font-size: 0.8rem; font-weight: 800; color: var(--ink); }

.order-line-list { display: grid; gap: 8px; }

.order-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.82rem;
  color: var(--ink);
}

.order-line strong { font-weight: 700; }

.order-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.order-total span { font-size: 0.88rem; font-weight: 800; color: var(--ink); }
.order-total strong { font-family: "Manrope", sans-serif; font-size: 1.1rem; font-weight: 800; color: var(--ink); }

.order-note-label { font-size: 0.72rem; font-weight: 700; color: var(--muted); margin-bottom: 5px; }

.order-note-input {
  width: 100%;
  border: 1px solid rgba(83, 60, 39, 0.18);
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 0.82rem;
  background: rgba(255, 255, 255, 0.65);
  color: var(--ink);
  resize: none;
  height: 60px;
}

.btn-place-order {
  width: 100%;
  border: none;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  padding: 12px;
  font-size: 0.88rem;
  font-weight: 800;
}

.btn-place-order:disabled { opacity: 0.5; }

.order-metamask-hint { font-size: 0.7rem; color: var(--muted); text-align: center; }

.tx-status-card {
  background: rgba(61, 138, 92, 0.08);
  border: 1px solid rgba(61, 138, 92, 0.2);
  border-radius: 12px;
  padding: 11px 14px;
}

.tx-status-title { font-size: 0.72rem; font-weight: 800; color: var(--green); margin-bottom: 3px; }
.tx-status-body  { font-size: 0.75rem; color: var(--muted); }

/* ── Misc ────────────────────────────────── */
.flash-banner {
  margin: 8px 24px 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(191, 93, 54, 0.12);
  color: var(--accent);
  font-size: 0.85rem;
}

.demo-tag {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(201, 106, 50, 0.12);
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
}

.muted-text { color: var(--muted); }

.result-box {
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: rgba(255, 248, 240, 0.8);
  overflow: auto;
  white-space: pre-wrap;
  font-size: 0.85rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid var(--line);
}

.status-pill.pending   { background: rgba(219, 158, 91, 0.18); }
.status-pill.confirmed { background: rgba(80, 156, 100, 0.18); }

dialog {
  border: 0;
  padding: 0;
  background: transparent;
}

dialog::backdrop {
  background: rgba(35, 20, 11, 0.45);
  backdrop-filter: blur(8px);
}

/* ── Responsive ──────────────────────────── */
@media (max-width: 1080px) {
  .page-content,
  .order-content {
    grid-template-columns: 1fr;
  }

  .topnav-tabs { display: none; }

  .form-cols-2,
  .form-cols-3 { grid-template-columns: 1fr; }
}

@keyframes drift {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: 刪除舊的 .bak 檔（已確認不需要）後 commit**

```bash
rm frontend/src/styles.css.bak
git add frontend/src/styles.css
git commit -m "style: complete new css — order page, form, responsive"
```

---

## Task 6: 更新 main.js — renderAppPage() 與 renderTopNav()

**Files:**
- Modify: `frontend/src/main.js`

**背景：** 目前 `renderAppPage()`（line 681）生成 `site-shell > site-header.panel + page-stack` 結構。要改為 `app-shell > topnav + org-strip + page-content`。

- [ ] **Step 1: 在 main.js 加入 renderTopNav() 函式（在 renderAppPage 之前插入）**

找到 `function renderAppPage()` 這行（約 line 681），在它前面插入：

```javascript
function renderTopNav() {
  const tabs = [
    { id: "proposal",     label: "🗳 投票" },
    { id: "voting",       label: "🗳 投票期" },
    { id: "ordering",     label: "🍱 點餐" },
    { id: "transactions", label: "📋 交易" },
    { id: "leaderboard",  label: "🏆 排行榜" },
  ];
  // collapse voting/proposal/ordering into 3 visible tabs
  const visibleTabs = [
    { id: "proposal",     label: "🗳 投票" },
    { id: "ordering",     label: "🍱 點餐" },
    { id: "transactions", label: "📋 交易" },
    { id: "leaderboard",  label: "🏆 排行榜" },
  ];
  const activeTab = state.appTab;
  const member = state.member;
  return `
    <nav class="topnav">
      <div class="topnav-left">
        <span class="topnav-logo">MealVote</span>
        <div class="topnav-tabs">
          ${visibleTabs.map(tab => `
            <button
              class="topnav-tab ${activeTab === tab.id || (tab.id === "proposal" && activeTab === "voting") ? "active" : ""}"
              data-app-tab="${tab.id}"
            >${tab.label}</button>
          `).join("")}
        </div>
      </div>
      <div class="topnav-right">
        ${member ? `
          <div class="topnav-user-meta">
            <span>${member.displayName}</span>
            <strong>${member.points} pts · ${member.tokenBalance} tok</strong>
          </div>
          <button class="topnav-avatar" data-open-profile>
            <img src="${member.avatarUrl}" alt="${member.displayName}" />
          </button>
        ` : `
          <a class="btn-ghost" href="./login.html">登入</a>
        `}
        <button class="btn-ghost" data-connect-wallet>MetaMask</button>
      </div>
    </nav>
  `;
}
```

- [ ] **Step 2: 替換 renderAppPage() 函式體**

找到 `function renderAppPage()` 並將整個函式替換為：

```javascript
function renderAppPage() {
  const proposal = proposalById(state.activeProposalId);
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopNav()}
      ${renderOrgStrip()}
      <div class="page-content">
        ${renderProposalList(proposal)}
        ${renderMainSidebar()}
      </div>
    </div>
    ${state.flash ? `<div class="flash-banner">${state.flash}</div>` : ""}
    <dialog id="profile-modal"></dialog>
  `;
  bindUI();
}
```

- [ ] **Step 3: 驗證頁面可正常載入（topnav 顯示）**

```bash
cd frontend && python3 -m http.server 4173
# 開啟 http://localhost:4173/index.html
# 確認：頂部出現 topnav，logo + 標籤 + 右側用戶資訊
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/main.js
git commit -m "feat: replace app shell with topnav layout"
```

---

## Task 7: 更新 main.js — renderOrgStrip()

**Files:**
- Modify: `frontend/src/main.js`

- [ ] **Step 1: 插入 renderOrgStrip() 函式（緊接在 renderTopNav() 後面）**

```javascript
function renderOrgStrip() {
  const orgs = ORGANIZATIONS;
  const current = state.organization;
  return `
    <div class="org-strip">
      <div class="org-pills">
        ${orgs.map(org => `
          <button
            class="org-pill ${org.id === current ? "active" : ""}"
            data-set-org="${org.id}"
          >${org.label}</button>
        `).join("")}
      </div>
      ${state.member ? `<button class="btn-new-proposal" data-app-tab="proposal" href="#proposal">＋ 新增提案</button>` : ""}
    </div>
  `;
}
```

- [ ] **Step 2: 確認 `data-set-org` 事件在 bindUI() 中已有處理。用 Grep 確認：**

```bash
grep -n "set-org\|setOrg\|organization" frontend/src/main.js | head -20
```

如果找到 `data-set-org` 的 handler，跳過；如果只有 `data-organization` 之類的舊 attribute，在 `bindUI()` 中找到對應的 `querySelector` 或事件綁定，將 attribute name 更新為 `data-set-org`。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.js
git commit -m "feat: add org strip with new-proposal button"
```

---

## Task 8: 更新 main.js — renderProposalList() 與 renderProposalCard()

**Files:**
- Modify: `frontend/src/main.js`

**背景：** 目前提案由 `renderStageStandalonePage()` / `renderAppBody()` 路由處理。要改為統一的提案列表，依狀態分組（進行中/即將/已結束）。

- [ ] **Step 1: 插入 renderProposalList() 和 renderProposalCard() 函式**

在 `renderOrgStrip()` 後面插入：

```javascript
function renderProposalList(activeProposal) {
  if (!state.member) {
    return `
      <div class="proposal-list">
        <div class="sidebar-card">
          <p class="muted-text">請先<a href="./login.html">登入</a>以查看提案。</p>
        </div>
      </div>
    `;
  }

  if (state.appTab === "proposal" && state.stagePage === "create") {
    return renderCreateProposalForm();
  }

  const proposals = state.proposals.length > 0 ? state.proposals : (activeProposal ? [activeProposal] : []);
  const org = state.organization;
  const filtered = proposals.filter(p => !org || p.merchantGroup === org || !p.merchantGroup);

  const voting   = filtered.filter(p => p.status === "voting");
  const ordering = filtered.filter(p => p.status === "ordering");
  const upcoming = filtered.filter(p => p.status === "pending" || p.status === "upcoming");
  const ended    = filtered.filter(p => p.status === "closed"  || p.status === "settled" || p.status === "finalized");

  const active = [...voting, ...ordering];

  const sections = [];
  if (active.length > 0) {
    sections.push(`<div class="section-label">進行中 · ${active.length}</div>`);
    sections.push(...active.map(p => renderProposalCard(p)));
  }
  if (upcoming.length > 0) {
    sections.push(`<div class="section-label">即將開始 · ${upcoming.length}</div>`);
    sections.push(...upcoming.map(p => renderProposalCard(p)));
  }
  if (ended.length > 0) {
    sections.push(`<div class="section-label">已結束 · ${ended.length}</div>`);
    sections.push(...ended.map(p => renderProposalCard(p)));
  }
  if (sections.length === 0) {
    sections.push(`<p class="muted-text">目前沒有提案。</p>`);
  }

  return `<div class="proposal-list">${sections.join("")}</div>`;
}

function renderProposalCard(proposal) {
  const isVoting   = proposal.status === "voting";
  const isOrdering = proposal.status === "ordering";
  const isEnded    = proposal.status === "closed" || proposal.status === "settled" || proposal.status === "finalized";

  let statusBadge = "";
  let statusClass = "";
  let dateHint = "";
  let actionBtn = "";
  let voteBarsHtml = "";

  if (isVoting) {
    statusClass = "voting";
    statusBadge = `<span class="status-badge voting">投票中</span>`;
    dateHint = proposal.voteDeadline ? `截止 ${formatClock(proposal.voteDeadline)} · 已有 ${totalVotes(proposal)} 票` : "";
    actionBtn = `<button class="btn-primary" data-app-tab="voting" data-proposal-id="${proposal.id}">投票</button>`;
    voteBarsHtml = renderVoteBars(proposal);
  } else if (isOrdering) {
    statusClass = "ordering";
    statusBadge = `<span class="status-badge ordering">點餐中</span>`;
    const winner = proposal.options?.find(o => o.id === proposal.winnerOptionId);
    dateHint = `截止 ${formatClock(proposal.orderDeadline)} · 冠軍：${winner?.merchantName || ""}`;
    actionBtn = `<a class="btn-ordering" href="./order.html?proposalId=${proposal.id}">點餐 →</a>`;
  } else if (isEnded) {
    statusClass = "dim";
    const winner = proposal.options?.find(o => o.id === proposal.winnerOptionId);
    statusBadge = `<span class="status-badge ended">已結束</span>`;
    dateHint = winner ? `🏆 ${winner.merchantName}` : "";
    actionBtn = `<button class="btn-ghost" data-app-tab="ordering" data-proposal-id="${proposal.id}">結果</button>`;
  } else {
    statusBadge = `<span class="status-badge upcoming">即將開始</span>`;
    dateHint = proposal.proposalDeadline ? formatClock(proposal.proposalDeadline) + " 開始" : "";
    actionBtn = `<button class="btn-ghost" data-app-tab="proposal" data-proposal-id="${proposal.id}">查看</button>`;
  }

  return `
    <div class="proposal-card ${statusClass}">
      <div class="proposal-card-top">
        <div class="proposal-card-info">
          <div class="proposal-card-badges">
            ${statusBadge}
            <span class="proposal-card-date">${dateHint}</span>
          </div>
          <p class="proposal-card-title">${proposal.title}</p>
        </div>
        ${actionBtn}
      </div>
      ${voteBarsHtml}
    </div>
  `;
}

function renderVoteBars(proposal) {
  if (!proposal.options || proposal.options.length === 0) return "";
  const total = totalVotes(proposal);
  if (total === 0) return "";
  const sorted = [...proposal.options].sort((a, b) => b.weightedVotes - a.weightedVotes);
  return `
    <div class="vote-bars">
      ${sorted.map((opt, i) => {
        const pct = total > 0 ? Math.round((opt.weightedVotes / total) * 100) : 0;
        return `
          <div class="vote-bar-row">
            <span class="vote-bar-label">${opt.merchantName}</span>
            <div class="vote-bar-track">
              <div class="vote-bar-fill ${i > 0 ? "secondary" : ""}" style="width:${pct}%"></div>
            </div>
            <span class="vote-bar-pct">${pct}%</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function totalVotes(proposal) {
  return (proposal.options || []).reduce((sum, o) => sum + (o.weightedVotes || 0), 0);
}
```

- [ ] **Step 2: 驗證提案列表顯示**

```bash
# 在瀏覽器 http://localhost:4173/index.html
# 確認：提案卡片出現，進行中/已結束分組正確
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.js
git commit -m "feat: render proposal list with status-grouped cards"
```

---

## Task 9: 更新 main.js — renderMainSidebar()

**Files:**
- Modify: `frontend/src/main.js`

- [ ] **Step 1: 插入 renderMainSidebar() 函式**

找到（或替換）`renderMemberSidebar()` 函式，在其後插入：

```javascript
function renderMainSidebar() {
  const member = state.member;
  const leaderboard = state.leaderboard.slice(0, 3);

  const statsCard = member ? `
    <div class="sidebar-card">
      <div class="stats-grid">
        <div class="stat-item">
          <span>我的積分</span>
          <strong>${member.points}</strong>
        </div>
        <div class="stat-item">
          <span>Token 餘額</span>
          <strong>${member.tokenBalance}</strong>
        </div>
      </div>
    </div>
  ` : "";

  const lbRows = leaderboard.map((entry, i) => `
    <div class="leaderboard-row">
      <div class="leaderboard-row-left">
        <span class="leaderboard-rank ${i > 0 ? "dim" : ""}">${entry.rank}</span>
        <span class="leaderboard-name">${entry.displayName}</span>
      </div>
      <span class="leaderboard-pts">${entry.points} pts</span>
    </div>
  `).join("");

  const lbCard = leaderboard.length > 0 ? `
    <div class="sidebar-card">
      <div class="sidebar-card-title">排行榜</div>
      <div class="leaderboard-list">${lbRows}</div>
    </div>
  ` : "";

  const walletCard = member ? `
    <div class="sidebar-card">
      <div class="sidebar-card-title" style="margin-bottom:4px">錢包</div>
      <div class="wallet-address">${state.wallet.account || member.walletAddress || "尚未連接"}</div>
      <div class="wallet-meta">${state.contractInfo ? renderChainMode() : ""} ${state.wallet.balanceWei !== "0" ? formatEth(state.wallet.balanceWei) : ""}</div>
      ${!state.wallet.account ? `<button class="btn-ghost" style="margin-top:8px;width:100%" data-connect-wallet>連結 MetaMask</button>` : ""}
    </div>
  ` : "";

  return `<aside class="sidebar">${statsCard}${lbCard}${walletCard}</aside>`;
}
```

- [ ] **Step 2: 驗證側邊欄**

```bash
# 在瀏覽器確認：右側顯示積分/Token + 排行榜 + 錢包卡片
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.js
git commit -m "feat: add main sidebar with stats, leaderboard, wallet"
```

---

## Task 10: 更新 main.js — renderCreateProposalForm()

**Files:**
- Modify: `frontend/src/main.js`

**背景：** 原 `renderCreateProposalForm()`（約 line 979）需改用新 CSS class。

- [ ] **Step 1: 找到 renderCreateProposalForm() 並全部替換**

```bash
grep -n "renderCreateProposalForm" frontend/src/main.js
```

將整個 `function renderCreateProposalForm()` 替換為：

```javascript
function renderCreateProposalForm() {
  const orgs = ORGANIZATIONS;
  const catalog = MERCHANT_PROPOSAL_CATALOG;
  const candidates = state.proposals
    .flatMap(p => p.options || [])
    .map(o => ({ id: o.merchantId, name: o.merchantName }));
  const allMerchants = [...new Map([...catalog, ...candidates].map(m => [m.id, m])).values()];

  return `
    <div class="page-content" style="grid-template-columns:1fr 280px">
      <div class="create-proposal-panel">
        <div class="create-proposal-header">
          <div>
            <div class="create-proposal-eyebrow">建立提案</div>
            <h3 class="create-proposal-title">新增餐廳投票</h3>
          </div>
          <button class="btn-ghost" data-app-tab="proposal">✕</button>
        </div>
        <div class="form-divider"></div>
        <form id="create-proposal-form" class="form-stack">
          <div class="form-row">
            <label for="cp-title">提案標題</label>
            <input id="cp-title" name="title" type="text" placeholder="午間便當選擇 — 信義 3/28" required />
          </div>
          <div class="form-cols-2">
            <div class="form-row">
              <label for="cp-org">部門</label>
              <select id="cp-org" name="organization">
                ${orgs.map(o => `<option value="${o.id}">${o.label}</option>`).join("")}
              </select>
            </div>
            <div class="form-row">
              <label for="cp-period">餐期</label>
              <select id="cp-period" name="mealPeriod">
                <option value="lunch">午餐</option>
                <option value="dinner">晚餐</option>
              </select>
            </div>
          </div>
          <div class="form-cols-3">
            <div class="form-row">
              <label for="cp-proposal-dl">提案截止</label>
              <input id="cp-proposal-dl" name="proposalDeadline" type="datetime-local" required />
            </div>
            <div class="form-row">
              <label for="cp-vote-dl">投票截止</label>
              <input id="cp-vote-dl" name="voteDeadline" type="datetime-local" required />
            </div>
            <div class="form-row">
              <label for="cp-order-dl">點餐截止</label>
              <input id="cp-order-dl" name="orderDeadline" type="datetime-local" required />
            </div>
          </div>
          <div class="form-divider"></div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span style="font-size:0.8rem;font-weight:800;color:var(--ink)">候選餐廳</span>
              <span class="muted-text" style="font-size:0.72rem" id="candidate-count"></span>
            </div>
            <div class="candidate-list" id="candidate-list"></div>
            <div class="candidate-add-row" style="margin-top:8px">
              <select id="candidate-select">
                <option value="">＋ 選擇餐廳加入...</option>
                ${allMerchants.map(m => `<option value="${m.id}" data-name="${m.name || m.merchantName}">${m.name || m.merchantName}</option>`).join("")}
              </select>
              <button type="button" class="btn-primary" id="candidate-add-btn">加入</button>
            </div>
          </div>
          <div class="form-divider"></div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" data-app-tab="proposal">取消</button>
            <button type="submit" class="btn-submit">建立提案</button>
          </div>
        </form>
      </div>
      <div class="sidebar">
        <div class="sidebar-help-card">
          <div class="sidebar-card-title">建立說明</div>
          <div class="sidebar-help-steps">
            ${["填寫提案標題，選擇部門與餐期","設定三個截止時間（提案→投票→點餐）","加入至少 2 家候選餐廳","建立後可選擇是否上鏈（On-chain 模式）"]
              .map((s, i) => `<div class="sidebar-help-step"><span>${i+1}</span><span>${s}</span></div>`)
              .join("")}
          </div>
        </div>
        <div class="sidebar-onchain-card">
          <div class="sidebar-onchain-title">On-chain 模式</div>
          <div class="sidebar-onchain-body">建立後可透過 MetaMask 將提案上鏈，投票結果將永久記錄在 Sepolia 測試網。</div>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: 確認點擊「＋ 新增提案」後進入表單**

在瀏覽器點擊 org-strip 的「＋ 新增提案」按鈕，確認表單出現。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.js
git commit -m "feat: redesign create proposal form"
```

---

## Task 11: 更新 order.js — render()、renderCartSummary()

**Files:**
- Modify: `frontend/src/order.js`

**背景：** 目前 `render()`（line 224）用舊 class（`order-page-shell`, `hero`, `order-layout` 等）。全部換新 class。

- [ ] **Step 1: 找到 render() 函式並替換**

將 `function render()` 整個替換為：

```javascript
function render() {
  const winner = currentWinner();
  const subtotal = cartSubtotalWei();
  const existingOrder = myExistingOrder();

  app.innerHTML = `
    <div class="order-shell">
      ${renderOrderTopNav(winner)}
      <div class="order-content">
        <section class="order-menu-panel">
          ${renderWinnerBanner(winner)}
          <div class="category-tabs">
            <button class="category-tab active">全部</button>
            <button class="category-tab">主食</button>
            <button class="category-tab">飲料</button>
            <button class="category-tab">加點</button>
          </div>
          <div class="menu-list">
            ${(state.merchant?.menu || []).map(item => renderMenuItem(item)).join("")}
          </div>
          ${state.flash ? `<div class="flash-banner">${state.flash}</div>` : ""}
        </section>
        <aside class="order-summary-panel">
          ${renderOrderSummaryCard(subtotal, existingOrder)}
          ${renderTxStatusCard(existingOrder)}
        </aside>
      </div>
    </div>
  `;

  bindUI();
}

function renderOrderTopNav(winner) {
  return `
    <nav class="topnav">
      <div class="topnav-left">
        <a class="topnav-back" href="./index.html#ordering">← 返回</a>
        <div class="topnav-divider"></div>
        <span class="topnav-title">${winner?.merchantName || state.merchant?.name || "點餐"}</span>
        <span class="status-badge ordering">點餐中</span>
        ${state.demoMode ? `<span class="demo-tag">Demo</span>` : ""}
      </div>
      <div class="topnav-right">
        <span style="font-size:0.72rem;color:var(--muted)">截止 <strong style="color:var(--ink)">${formatClock(state.proposal?.orderDeadline)}</strong></span>
        <button class="btn-ghost" id="connect-wallet">MetaMask</button>
      </div>
    </nav>
  `;
}

function renderWinnerBanner(winner) {
  if (!winner) return "";
  const total = (state.proposal?.options || []).reduce((s, o) => s + (o.weightedVotes || 0), 0);
  const pct = total > 0 ? Math.round((winner.weightedVotes / total) * 100) : 0;
  return `
    <div class="winner-banner">
      <div class="winner-banner-left">
        <div class="winner-banner-eyebrow">🏆 投票冠軍</div>
        <p class="winner-banner-name">${winner.merchantName}</p>
        <p class="winner-banner-sub">${state.proposal?.title || ""} · ${pct}% 得票</p>
      </div>
      <div class="winner-banner-right">
        <div class="winner-banner-deadline-label">點餐截止</div>
        <div class="winner-banner-deadline-time">${formatClock(state.proposal?.orderDeadline)}</div>
      </div>
    </div>
  `;
}

function renderMenuItem(item) {
  const qty = Number(state.cart[item.id] || 0);
  return `
    <div class="menu-item-card">
      <div class="menu-item-info">
        <div class="menu-item-name">${item.name}</div>
        <div class="menu-item-desc">${item.description || ""}</div>
      </div>
      <div class="menu-item-right">
        <span class="menu-item-price">${formatEth(item.priceWei)}</span>
        <div class="qty-control">
          <button type="button" class="qty-btn" data-qty-dec="${item.id}">−</button>
          <span class="qty-value" data-qty-display="${item.id}">${qty}</span>
          <button type="button" class="qty-btn inc" data-qty-inc="${item.id}">＋</button>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: 替換 renderCartSummary() 並加入 renderOrderSummaryCard() 和 renderTxStatusCard()**

找到 `function renderCartSummary()` 並在其後加入（保留原 `renderCartSummary` 不動，作為內部 helper）：

```javascript
function renderOrderSummaryCard(subtotal, existingOrder) {
  const items = cartEntries();
  const hasItems = items.length > 0;
  const hasExisting = !!existingOrder;

  return `
    <div class="order-summary-card">
      <div class="order-summary-title">訂單摘要</div>
      <div class="order-line-list">
        ${hasItems
          ? items.map(item => `
              <div class="order-line">
                <span>${item.name} ×${item.quantity}</span>
                <strong>${formatEth(BigInt(item.priceWei) * BigInt(item.quantity))}</strong>
              </div>`).join("")
          : `<p class="muted-text" style="font-size:0.82rem">尚未選擇餐點</p>`
        }
      </div>
      ${hasItems ? `
        <div class="order-total">
          <span>合計</span>
          <strong>${formatEth(subtotal)}</strong>
        </div>
      ` : ""}
      <div>
        <div class="order-note-label">備註（選填）</div>
        <textarea class="order-note-input" id="order-note" placeholder="例：不要洋蔥"></textarea>
      </div>
      <button type="button" id="submit-order" class="btn-place-order" ${!hasItems ? "disabled" : ""}>
        確認下單${chainModeSuffix()}
      </button>
      <div class="order-metamask-hint">下單後需透過 MetaMask 簽署交易</div>
    </div>
  `;
}

function renderTxStatusCard(existingOrder) {
  if (!existingOrder) return "";
  return `
    <div class="tx-status-card">
      <div class="tx-status-title">已下單</div>
      <div class="tx-status-body">${existingOrder.txHash
        ? `Tx: ${shortenHash(existingOrder.txHash)}`
        : "訂單已提交"
      }</div>
    </div>
  `;
}
```

- [ ] **Step 3: 確認 `data-qty-dec` / `data-qty-inc` 在 bindUI() 中的 handler 使用 `data-qty-display` 更新 qty span**

```bash
grep -n "qty-dec\|qty-inc\|qty-item\|qty-display" frontend/src/order.js
```

舊版用 `input[data-qty-item]` 更新，新版改用 `span[data-qty-display]`。找到 bindUI() 中的數量更新邏輯，將 `querySelector(\`input[data-qty-item="${id}"]\`)` 改為 `querySelector(\`[data-qty-display="${id}"]\`)`，並將 `.value =` 改為 `.textContent =`。

- [ ] **Step 4: 驗證點餐頁**

```bash
# 開 http://localhost:4173/order.html?proposalId=101
# 確認：topnav + winner banner + 菜單卡片 + 右側訂單摘要均正確顯示
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/order.js
git commit -m "feat: redesign order page with new topnav and menu cards"
```

---

## Task 12: 清理舊 CSS class 引用、最終驗證

**Files:**
- Modify: `frontend/src/main.js`（移除殘留舊 class）
- Modify: `frontend/src/order.js`（移除殘留舊 class）

- [ ] **Step 1: 找出 main.js 中殘留的舊 class（不再使用的）**

```bash
grep -n "site-shell\|site-header\|page-stack\|quick-access-panel\|quick-access-grid\|header-row\|header-actions\|shell\b\|workspace\b" frontend/src/main.js | head -30
```

對於每一個找到的舊 class，檢查它是否在新 styles.css 中仍存在。若不存在，找到該 DOM 生成位置並更新 class 名稱為對應的新 class（或移除）。

- [ ] **Step 2: 找出 order.js 中殘留的舊 class**

```bash
grep -n "order-page-shell\|order-page-top\|hero\b\|hero-copy\|hero-grid\|metric\b\|order-layout\|order-menu-panel\|order-summary-panel\|summary-card\|note-block" frontend/src/order.js | head -20
```

對每個找到的舊 class，確認是否已在 Task 11 的 render() 中被換掉。若有殘留（來自 renderExistingOrder、renderSignedPreview 等），更新為對應的新 class。

- [ ] **Step 3: 全面瀏覽器驗證**

```bash
# 在 http://localhost:4173 依序驗證：
# 1. index.html — 主頁（未登入狀態）：topnav 顯示「登入」按鈕
# 2. index.html — Demo mode：提案列表分組正確
# 3. index.html — 點擊「＋ 新增提案」：表單出現
# 4. order.html?proposalId=101 — Demo mode：菜單 + 數量控制 + 訂單摘要
# 5. 手機寬度（< 1080px）：雙欄變單欄，topnav tabs 消失
```

- [ ] **Step 4: 最終 Commit**

```bash
git add frontend/src/main.js frontend/src/order.js
git commit -m "chore: clean up legacy css class references"
```

---

## Self-Review

**Spec coverage 確認：**
- ✅ 暖系精緻風格 → Task 1-5 全新 CSS token
- ✅ 頂部導覽列 → Task 6 renderTopNav()
- ✅ 緊湊高效密度 → proposal-card 14px padding、menu-item-card 12px padding
- ✅ 主頁提案列表（分組） → Task 8
- ✅ 新增提案表單 → Task 10
- ✅ 右側 sidebar → Task 9
- ✅ 點餐頁 → Task 11
- ✅ 響應式 → Task 5 末尾 @media
- ✅ 業務邏輯不動 → 所有 API/state/blockchain 函式未被修改

**Type consistency：**
- `renderTopNav()` 在 Task 6 定義，在 renderAppPage() 呼叫 ✅
- `renderOrgStrip()` 在 Task 7 定義，在 renderAppPage() 呼叫 ✅
- `renderProposalList()` 在 Task 8 定義，在 renderAppPage() 呼叫 ✅
- `renderMainSidebar()` 在 Task 9 定義，在 renderAppPage() 呼叫 ✅
- `renderOrderTopNav()` / `renderWinnerBanner()` / `renderMenuItem()` 在 Task 11 定義，在 render() 呼叫 ✅
- `renderOrderSummaryCard()` / `renderTxStatusCard()` 在 Task 11 定義，在 render() 呼叫 ✅
