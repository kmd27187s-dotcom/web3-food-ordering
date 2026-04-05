# MealVote Landing Page Design Spec

## Overview

A bilingual (Traditional Chinese primary, English secondary) landing page for MealVote targeting office teams. Goal: drive user signups. Visual direction: warm earthy palette with subtle blockchain/tech cues. Layout: full-viewport hero with app preview mockup.

The landing page will be a new `landing.html` file in `frontend/`, using the same vanilla HTML/CSS/JS approach as the rest of the app (no build tools, no framework).

## Visual Direction

**Warm + Subtle Tech** — keeps the existing app's earthy palette (beige, terracotta, brown) but adds professional structure and subtle blockchain iconography.

- Background: `#faf7f2` → `#f0ebe0` gradient
- Text: `#2b1e15` (ink), `#7a6654` (muted)
- Accent: `#bf5d36` (terracotta), `#f1c7a9` (soft peach)
- Success: `#3d8a5c`
- Fonts: Manrope (headings/logo), Noto Sans TC (body/Chinese text)
- Rounded corners (14-24px), subtle borders, warm shadows
- Blockchain cues: small chain icon next to logo, subtle iconography in feature cards

## Page Sections

### 1. Sticky Nav

Fixed top navigation bar with backdrop blur.

**3 states based on auth:**

| State | Left | Right |
|-------|------|-------|
| Visitor (not logged in) | MealVote ⛓ logo, nav links (功能 / 如何運作 / 關於) | 登入 / 註冊 buttons |
| Logged in, no wallet | MealVote ⛓ logo, nav links | 連結錢包 button + 登出 |
| Logged in + wallet | MealVote ⛓ logo, nav links | Wallet address (truncated `0x1a2b...3c4d`) + Token balance (`💰 150 MV`) + 登出 |

**Auth flow:** Register first → then connect MetaMask wallet (separate steps).

- 登入/註冊 buttons open inline forms or modals
- 連結錢包 triggers MetaMask connection
- Nav links smooth-scroll to corresponding page sections

### 2. Hero (Full Viewport)

Split layout, vertically centered.

**Left side:**
- Headline: `不再為午餐爭論不休`
- Subheadline: `鏈上投票，公平透明，一鍵訂餐`
- Primary CTA: `免費註冊` button (dark bg `#2b1e15`, light text) → opens registration
- Secondary CTA: `了解更多` (outlined) → smooth scroll to features

**Right side:**
- App mockup styled as a card/phone frame with warm shadow
- Mini tab bar showing: 提案 / 投票 / 訂餐 / 紀錄 / 排行榜 / 群組
- 提案 tab active by default, showing a sample proposal with:
  - Restaurant options (e.g. 🍜 牛肉麵, 🍱 便當)
  - Vote percentage bars with animation (bars filling up)
- Mockup is decorative/static, not interactive

### 3. Feature Highlights (6 Cards)

Two rows of 3 cards on desktop (stacks on mobile). Each card has an icon, title, and one-line description.

| Icon | Title | Description |
|------|-------|-------------|
| 🗳 | 鏈上投票 | 透明公平的區塊鏈投票機制 |
| ⚡ | 一鍵訂餐 | 投票結果出爐，直接下單 |
| 👥 | 群組管理 | 建立團隊，各自獨立運作 |
| 📋 | 交易紀錄 | 所有訂單鏈上可查 |
| 🏆 | 排行榜 | 積分獎勵，激勵團隊參與 |
| ⛓ | 鏈上驗證 | MetaMask 錢包連結，結果不可竄改 |

Cards use white background with subtle border and warm shadow. Hover: slight lift + shadow increase.

### 4. How It Works (4 Steps)

Horizontal flow on desktop (vertical on mobile). Numbered circles connected by arrows/lines.

| Step | Title | Description |
|------|-------|-------------|
| 1 | 提案 | 團隊成員提名餐廳選項 |
| 2 | 投票 | 使用代幣加權投票 |
| 3 | 訂餐 | 勝出餐廳，一鍵下單 |
| 4 | 結算 | 鏈上記錄，獎勵發放 |

Numbered circles use `#f1c7a9` (soft peach) background.

### 5. Blockchain Explainer

Two-column section.

**Left:** Heading `為什麼用區塊鏈？`

**Right:** 3 bullet points with icons:
- 🔒 **不可竄改** — 投票結果上鏈，無法篡改
- 👁 **公開透明** — 任何人皆可驗證
- 🪙 **代幣治理** — 持幣越多，投票權重越高

### 6. Registration Form (Inline)

Centered section with warm background.

**Fields:**
- 顯示名稱 (Display Name) — text input
- Email — email input
- 密碼 (Password) — password input

**CTA:** `免費註冊` button (full width, `#2b1e15` background)

**Below form:** `已有帳號？登入` link → opens login modal (keeps user on the landing page)

Registration submits to the existing backend `POST /register` endpoint.

### 7. Footer

Three-column layout.

- **Left:** MealVote logo + `© 2026 MealVote`
- **Center:** Links — 功能 / 如何運作 / 關於
- **Right:** Language toggle (中文 / EN)

## Technical Details

### File Structure
- `frontend/landing.html` — the landing page HTML
- `frontend/src/landing.js` — landing page JS (auth state, MetaMask connection, registration form, smooth scroll)
- `frontend/src/landing.css` — landing page styles (or extend `styles.css`)

### API Integration
- `POST /register` — registration form submission
- `POST /login` — login form/modal
- `POST /logout` — logout button
- Wallet connection uses ethers.js (already available via CDN in the project)
- Token balance read from the MembershipToken contract after wallet connection

### Responsive Behavior
- **Desktop (>1024px):** Side-by-side hero, 3-column feature cards, horizontal steps
- **Tablet (768-1024px):** Stacked hero, 2-column cards, horizontal steps
- **Mobile (<768px):** Fully stacked layout, single-column cards, vertical steps

### No Build Tools
Consistent with the existing frontend — static HTML/CSS/JS served directly. No npm, no bundler.
