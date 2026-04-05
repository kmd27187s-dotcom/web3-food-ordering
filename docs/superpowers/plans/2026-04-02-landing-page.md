# MealVote Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual landing page that drives user signups, featuring a full-viewport hero with app mockup, feature highlights, how-it-works section, blockchain explainer, inline registration, and auth-aware sticky nav with MetaMask wallet connection.

**Architecture:** New `landing.html` + `landing.js` + `landing.css` files in `frontend/`. Reuses existing backend auth endpoints (`/auth/register`, `/auth/login`, `/members/wallet/link`, `/members/me`). Uses the same vanilla JS SPA pattern, CSS custom properties, and ethers.js CDN import as the existing app.

**Tech Stack:** Vanilla HTML/CSS/JS, CSS custom properties, ethers.js (CDN), existing Go backend REST API.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/landing.html` | Create | Landing page HTML shell — sticky nav, hero, features, how-it-works, blockchain explainer, registration form, footer |
| `frontend/src/landing.js` | Create | Landing page JS — API base detection, auth state management, registration/login form handlers, MetaMask wallet connection, token balance display, smooth scroll, login modal |
| `frontend/src/landing.css` | Create | Landing page styles — hero layout, feature cards, step flow, blockchain section, registration form, responsive breakpoints, login modal |

---

### Task 1: Landing Page HTML Shell

**Files:**
- Create: `frontend/landing.html`

- [ ] **Step 1: Create `landing.html` with head and empty body structure**

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MealVote — 團隊訂餐，鏈上投票</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Noto+Sans+TC:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./src/landing.css" />
  </head>
  <body>
    <!-- Section 1: Sticky Nav -->
    <nav class="lp-nav" id="lp-nav">
      <div class="lp-nav-inner">
        <a href="#" class="lp-logo">MealVote<span class="lp-logo-chain">⛓</span></a>
        <div class="lp-nav-links">
          <a href="#features">功能</a>
          <a href="#how-it-works">如何運作</a>
          <a href="#blockchain">關於</a>
        </div>
        <div class="lp-nav-auth" id="nav-auth">
          <!-- JS renders auth state here -->
        </div>
      </div>
    </nav>

    <!-- Section 2: Hero -->
    <section class="lp-hero" id="hero">
      <div class="lp-hero-inner">
        <div class="lp-hero-text">
          <h1>不再為午餐<br />爭論不休</h1>
          <p class="lp-hero-sub">鏈上投票，公平透明，一鍵訂餐<br /><span class="lp-hero-sub-en">On-chain voting, fair & transparent, one-click ordering</span></p>
          <div class="lp-hero-cta">
            <button class="lp-btn-primary" data-action="scroll-register">免費註冊</button>
            <a href="#features" class="lp-btn-outline">了解更多</a>
          </div>
        </div>
        <div class="lp-hero-mockup">
          <div class="lp-mockup-frame">
            <div class="lp-mockup-tabs">
              <span class="lp-mockup-tab active">提案</span>
              <span class="lp-mockup-tab">投票</span>
              <span class="lp-mockup-tab">訂餐</span>
              <span class="lp-mockup-tab">紀錄</span>
              <span class="lp-mockup-tab">排行榜</span>
              <span class="lp-mockup-tab">群組</span>
            </div>
            <div class="lp-mockup-body">
              <div class="lp-mockup-title">今日午餐提案</div>
              <div class="lp-mockup-option">
                <span>🍜 牛肉麵 — 老王牛肉麵館</span>
                <div class="lp-mockup-bar-wrap">
                  <div class="lp-mockup-bar" style="--pct:67%">
                    <span>67%</span>
                  </div>
                </div>
              </div>
              <div class="lp-mockup-option">
                <span>🍱 便當 — 池上飯包</span>
                <div class="lp-mockup-bar-wrap">
                  <div class="lp-mockup-bar accent" style="--pct:33%">
                    <span>33%</span>
                  </div>
                </div>
              </div>
              <div class="lp-mockup-voters">
                <div class="lp-mockup-avatar">A</div>
                <div class="lp-mockup-avatar">B</div>
                <div class="lp-mockup-avatar">C</div>
                <span class="lp-mockup-voter-text">3 位成員已投票</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3: Feature Highlights -->
    <section class="lp-features" id="features">
      <h2>為什麼選擇 MealVote？</h2>
      <p class="lp-section-sub">Why MealVote?</p>
      <div class="lp-features-grid">
        <div class="lp-feature-card">
          <div class="lp-feature-icon">🗳</div>
          <h3>鏈上投票</h3>
          <p>透明公平的區塊鏈投票機制</p>
        </div>
        <div class="lp-feature-card">
          <div class="lp-feature-icon">⚡</div>
          <h3>一鍵訂餐</h3>
          <p>投票結果出爐，直接下單</p>
        </div>
        <div class="lp-feature-card">
          <div class="lp-feature-icon">👥</div>
          <h3>群組管理</h3>
          <p>建立團隊，各自獨立運作</p>
        </div>
        <div class="lp-feature-card">
          <div class="lp-feature-icon">📋</div>
          <h3>交易紀錄</h3>
          <p>所有訂單鏈上可查</p>
        </div>
        <div class="lp-feature-card">
          <div class="lp-feature-icon">🏆</div>
          <h3>排行榜</h3>
          <p>積分獎勵，激勵團隊參與</p>
        </div>
        <div class="lp-feature-card">
          <div class="lp-feature-icon">⛓</div>
          <h3>鏈上驗證</h3>
          <p>MetaMask 錢包連結，結果不可竄改</p>
        </div>
      </div>
    </section>

    <!-- Section 4: How It Works -->
    <section class="lp-how" id="how-it-works">
      <h2>如何運作？</h2>
      <p class="lp-section-sub">How it works</p>
      <div class="lp-steps">
        <div class="lp-step">
          <div class="lp-step-num">1</div>
          <h3>提案</h3>
          <p>團隊成員提名餐廳選項</p>
        </div>
        <div class="lp-step-arrow">→</div>
        <div class="lp-step">
          <div class="lp-step-num">2</div>
          <h3>投票</h3>
          <p>使用代幣加權投票</p>
        </div>
        <div class="lp-step-arrow">→</div>
        <div class="lp-step">
          <div class="lp-step-num">3</div>
          <h3>訂餐</h3>
          <p>勝出餐廳，一鍵下單</p>
        </div>
        <div class="lp-step-arrow">→</div>
        <div class="lp-step">
          <div class="lp-step-num">4</div>
          <h3>結算</h3>
          <p>鏈上記錄，獎勵發放</p>
        </div>
      </div>
    </section>

    <!-- Section 5: Blockchain Explainer -->
    <section class="lp-blockchain" id="blockchain">
      <div class="lp-blockchain-inner">
        <div class="lp-blockchain-left">
          <h2>為什麼用區塊鏈？</h2>
          <p class="lp-section-sub">Why blockchain?</p>
        </div>
        <div class="lp-blockchain-right">
          <div class="lp-blockchain-point">
            <span class="lp-blockchain-icon">🔒</span>
            <div>
              <h3>不可竄改</h3>
              <p>投票結果上鏈，無法篡改</p>
            </div>
          </div>
          <div class="lp-blockchain-point">
            <span class="lp-blockchain-icon">👁</span>
            <div>
              <h3>公開透明</h3>
              <p>任何人皆可驗證</p>
            </div>
          </div>
          <div class="lp-blockchain-point">
            <span class="lp-blockchain-icon">🪙</span>
            <div>
              <h3>代幣治理</h3>
              <p>持幣越多，投票權重越高</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 6: Registration Form -->
    <section class="lp-register" id="register">
      <h2>立即開始</h2>
      <p class="lp-section-sub">Get started — it's free</p>
      <form id="register-form" class="lp-register-form" autocomplete="off">
        <input name="displayName" placeholder="顯示名稱 Display Name" autocomplete="off" required />
        <input name="email" type="email" placeholder="Email" autocomplete="off" required />
        <input name="password" type="password" placeholder="密碼 Password" autocomplete="new-password" required />
        <button type="submit" class="lp-btn-primary lp-btn-full">免費註冊</button>
      </form>
      <p class="lp-register-login">已有帳號？<a href="#" id="open-login">登入</a></p>
      <div id="register-flash" class="lp-flash" hidden></div>
    </section>

    <!-- Login Modal -->
    <div class="lp-modal-overlay" id="login-modal" hidden>
      <div class="lp-modal">
        <button class="lp-modal-close" id="close-login">&times;</button>
        <h2>登入</h2>
        <form id="login-form" class="lp-register-form" autocomplete="off">
          <input name="email" type="email" placeholder="Email" autocomplete="off" required />
          <input name="password" type="password" placeholder="密碼 Password" autocomplete="current-password" required />
          <button type="submit" class="lp-btn-primary lp-btn-full">登入</button>
        </form>
        <div id="login-flash" class="lp-flash" hidden></div>
      </div>
    </div>

    <!-- Section 7: Footer -->
    <footer class="lp-footer">
      <div class="lp-footer-inner">
        <div class="lp-footer-brand">MealVote<span class="lp-logo-chain">⛓</span> <span class="lp-footer-copy">© 2026 MealVote</span></div>
        <div class="lp-footer-links">
          <a href="#features">功能</a>
          <a href="#how-it-works">如何運作</a>
          <a href="#blockchain">關於</a>
        </div>
        <div class="lp-footer-lang" id="lang-toggle">
          <button class="lp-lang-btn active" data-lang="zh">中文</button>
          <button class="lp-lang-btn" data-lang="en">EN</button>
        </div>
      </div>
    </footer>

    <script type="module" src="./src/landing.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Verify the file renders in browser**

Run: `open http://localhost:4173/landing.html` (after starting `python3 -m http.server 4173` in `frontend/`)

Expected: Raw unstyled HTML content visible with all sections.

- [ ] **Step 3: Commit**

```bash
git add frontend/landing.html
git commit -m "feat: add landing page HTML shell with all sections"
```

---

### Task 2: Landing Page CSS — Layout & Design System

**Files:**
- Create: `frontend/src/landing.css`

- [ ] **Step 1: Create `landing.css` with CSS custom properties and global resets**

```css
/* ── Design tokens (matching app palette) ── */
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

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--ink);
  background: linear-gradient(135deg, #faf7f2 0%, #f0ebe0 100%);
  font-family: "Noto Sans TC", sans-serif;
  scroll-behavior: smooth;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

h1,
h2,
h3 {
  font-family: "Manrope", sans-serif;
  margin: 0;
}

/* ── Buttons ── */
.lp-btn-primary {
  border: none;
  background: var(--ink);
  color: #fff9f1;
  border-radius: 10px;
  padding: 10px 24px;
  font-size: 0.95rem;
  font-weight: 700;
  white-space: nowrap;
  transition: opacity 150ms;
}

.lp-btn-primary:hover {
  opacity: 0.85;
}

.lp-btn-outline {
  display: inline-block;
  border: 1.5px solid var(--ink);
  background: transparent;
  color: var(--ink);
  border-radius: 10px;
  padding: 9px 24px;
  font-size: 0.95rem;
  font-weight: 700;
  transition: background 150ms;
}

.lp-btn-outline:hover {
  background: rgba(43, 30, 21, 0.06);
}

.lp-btn-full {
  width: 100%;
  padding: 12px;
  font-size: 1rem;
}
```

- [ ] **Step 2: Add sticky nav styles**

```css
/* ── Sticky Nav ── */
.lp-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(250, 247, 242, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}

.lp-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lp-logo {
  font-family: "Manrope", sans-serif;
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--ink);
}

.lp-logo-chain {
  font-size: 0.7em;
  margin-left: 2px;
  color: var(--accent);
}

.lp-nav-links {
  display: flex;
  gap: 24px;
  font-size: 0.85rem;
  color: var(--muted);
}

.lp-nav-links a:hover {
  color: var(--ink);
}

.lp-nav-auth {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lp-nav-btn {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 999px;
  white-space: nowrap;
  transition: background 150ms, border-color 150ms;
}

.lp-nav-btn:hover {
  background: rgba(83, 60, 39, 0.07);
  border-color: var(--accent);
}

.lp-nav-btn-accent {
  background: var(--ink);
  color: #fff9f1;
  border-color: var(--ink);
}

.lp-nav-btn-accent:hover {
  opacity: 0.85;
  background: var(--ink);
}

.lp-wallet-chip {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  background: rgba(83, 60, 39, 0.06);
  padding: 4px 10px;
  border-radius: 999px;
}

.lp-token-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--green);
  background: rgba(61, 138, 92, 0.1);
  padding: 4px 10px;
  border-radius: 999px;
}
```

- [ ] **Step 3: Add hero styles**

```css
/* ── Hero ── */
.lp-hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 80px 24px 40px;
}

.lp-hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 60px;
}

.lp-hero-text {
  flex: 1;
}

.lp-hero-text h1 {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 16px;
}

.lp-hero-sub {
  font-size: 1.1rem;
  color: var(--muted);
  line-height: 1.6;
  margin: 0 0 28px;
}

.lp-hero-sub-en {
  font-size: 0.85rem;
  opacity: 0.7;
}

.lp-hero-cta {
  display: flex;
  gap: 12px;
}

.lp-hero-mockup {
  flex: 0.85;
}

.lp-mockup-frame {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.lp-mockup-tabs {
  display: flex;
  border-bottom: 1px solid var(--line);
  padding: 0 4px;
}

.lp-mockup-tab {
  padding: 10px 12px;
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: color 150ms;
}

.lp-mockup-tab.active {
  color: var(--ink);
  font-weight: 700;
  border-bottom-color: var(--accent);
}

.lp-mockup-body {
  padding: 20px;
}

.lp-mockup-title {
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 14px;
}

.lp-mockup-option {
  margin-bottom: 10px;
  font-size: 0.82rem;
}

.lp-mockup-option span {
  display: block;
  margin-bottom: 4px;
}

.lp-mockup-bar-wrap {
  height: 22px;
  background: rgba(83, 60, 39, 0.06);
  border-radius: 6px;
  overflow: hidden;
}

.lp-mockup-bar {
  height: 100%;
  width: var(--pct);
  background: var(--green);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
  animation: barGrow 1.2s ease-out;
}

.lp-mockup-bar.accent {
  background: var(--accent);
}

@keyframes barGrow {
  from {
    width: 0;
  }
  to {
    width: var(--pct);
  }
}

.lp-mockup-voters {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  font-size: 0.72rem;
  color: var(--muted);
}

.lp-mockup-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--accent);
}
```

- [ ] **Step 4: Add feature cards styles**

```css
/* ── Features ── */
.lp-features {
  padding: 80px 24px;
  text-align: center;
}

.lp-features h2 {
  font-size: 2rem;
  margin-bottom: 4px;
}

.lp-section-sub {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0 0 40px;
}

.lp-features-grid {
  max-width: 1000px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.lp-feature-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 28px 20px;
  text-align: center;
  transition: transform 150ms, box-shadow 150ms;
}

.lp-feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow);
}

.lp-feature-icon {
  font-size: 2rem;
  margin-bottom: 12px;
}

.lp-feature-card h3 {
  font-size: 1rem;
  margin-bottom: 6px;
}

.lp-feature-card p {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0;
}
```

- [ ] **Step 5: Add how-it-works styles**

```css
/* ── How It Works ── */
.lp-how {
  padding: 80px 24px;
  text-align: center;
  background: rgba(255, 252, 246, 0.5);
}

.lp-how h2 {
  font-size: 2rem;
  margin-bottom: 4px;
}

.lp-steps {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 12px;
}

.lp-step {
  flex: 1;
  text-align: center;
}

.lp-step-num {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-family: "Manrope", sans-serif;
  font-size: 1.2rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.lp-step h3 {
  font-size: 1rem;
  margin-bottom: 4px;
}

.lp-step p {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0;
}

.lp-step-arrow {
  color: var(--accent-soft);
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 10px;
}
```

- [ ] **Step 6: Add blockchain explainer styles**

```css
/* ── Blockchain Explainer ── */
.lp-blockchain {
  padding: 80px 24px;
}

.lp-blockchain-inner {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  gap: 60px;
  align-items: flex-start;
}

.lp-blockchain-left {
  flex: 0.4;
}

.lp-blockchain-left h2 {
  font-size: 2rem;
  margin-bottom: 4px;
}

.lp-blockchain-right {
  flex: 0.6;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.lp-blockchain-point {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.lp-blockchain-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(191, 93, 54, 0.08);
  border-radius: 12px;
}

.lp-blockchain-point h3 {
  font-size: 0.95rem;
  margin-bottom: 2px;
}

.lp-blockchain-point p {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0;
}
```

- [ ] **Step 7: Add registration form and login modal styles**

```css
/* ── Registration ── */
.lp-register {
  padding: 80px 24px;
  text-align: center;
  background: rgba(255, 252, 246, 0.5);
}

.lp-register h2 {
  font-size: 2rem;
  margin-bottom: 4px;
}

.lp-register-form {
  max-width: 400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lp-register-form input {
  border: 1px solid var(--line);
  background: white;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 150ms;
}

.lp-register-form input:focus {
  border-color: var(--accent);
}

.lp-register-login {
  margin-top: 16px;
  font-size: 0.85rem;
  color: var(--muted);
}

.lp-register-login a {
  color: var(--accent);
  font-weight: 600;
}

.lp-register-login a:hover {
  text-decoration: underline;
}

.lp-flash {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(191, 93, 54, 0.12);
  color: var(--accent);
  font-size: 0.85rem;
}

.lp-flash.success {
  background: rgba(61, 138, 92, 0.12);
  color: var(--green);
}

/* ── Login Modal ── */
.lp-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(43, 30, 21, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lp-modal-overlay[hidden] {
  display: none;
}

.lp-modal {
  background: white;
  border-radius: 20px;
  padding: 36px;
  width: 100%;
  max-width: 420px;
  box-shadow: var(--shadow);
  position: relative;
}

.lp-modal h2 {
  font-size: 1.4rem;
  margin-bottom: 20px;
  text-align: center;
}

.lp-modal-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--muted);
  padding: 4px;
}

.lp-modal-close:hover {
  color: var(--ink);
}
```

- [ ] **Step 8: Add footer and responsive styles**

```css
/* ── Footer ── */
.lp-footer {
  border-top: 1px solid var(--line);
  padding: 24px;
}

.lp-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lp-footer-brand {
  font-family: "Manrope", sans-serif;
  font-weight: 800;
  font-size: 1rem;
}

.lp-footer-copy {
  font-weight: 400;
  font-size: 0.75rem;
  color: var(--muted);
  margin-left: 8px;
}

.lp-footer-links {
  display: flex;
  gap: 20px;
  font-size: 0.82rem;
  color: var(--muted);
}

.lp-footer-links a:hover {
  color: var(--ink);
}

.lp-footer-lang {
  display: flex;
  gap: 4px;
}

.lp-lang-btn {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  transition: background 150ms;
}

.lp-lang-btn.active {
  background: var(--ink);
  color: #fff9f1;
  border-color: var(--ink);
}

/* ── Responsive ── */

/* Tablet */
@media (max-width: 1024px) {
  .lp-hero-inner {
    flex-direction: column;
    text-align: center;
  }

  .lp-hero-text h1 {
    font-size: 2.2rem;
  }

  .lp-hero-cta {
    justify-content: center;
  }

  .lp-hero-mockup {
    width: 100%;
    max-width: 480px;
  }

  .lp-features-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .lp-blockchain-inner {
    flex-direction: column;
    text-align: center;
  }

  .lp-blockchain-right {
    align-items: center;
  }

  .lp-blockchain-point {
    text-align: left;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .lp-nav-links {
    display: none;
  }

  .lp-hero-text h1 {
    font-size: 1.8rem;
  }

  .lp-features-grid {
    grid-template-columns: 1fr;
    max-width: 360px;
  }

  .lp-steps {
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .lp-step-arrow {
    transform: rotate(90deg);
    margin: 0;
  }

  .lp-footer-inner {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
}
```

- [ ] **Step 9: Verify the styled page renders correctly**

Run: Open `http://localhost:4173/landing.html` in browser.

Expected: Fully styled landing page with all sections visible, warm palette, responsive layout.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/landing.css
git commit -m "feat: add landing page styles with responsive layout"
```

---

### Task 3: Landing Page JavaScript — API & Auth

**Files:**
- Create: `frontend/src/landing.js`

- [ ] **Step 1: Create `landing.js` with API base detection and request helper**

```javascript
// ── Constants ──
const TOKEN_KEY = "mealvote.token";
const API_BASE_KEY = "mealvote.apiBase";

let apiBase = "";

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  member: null,
  wallet: { account: "", balanceWei: "0" },
};

// ── API Base Detection (same logic as main.js) ──
async function detectApiBase() {
  const stored = localStorage.getItem(API_BASE_KEY);
  if (stored) {
    apiBase = stored;
    return;
  }
  const proto = location.protocol;
  const host = location.hostname;
  const candidates = [
    `${proto}//${host}:8080`,
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        apiBase = url;
        return;
      }
    } catch {
      // try next
    }
  }
  apiBase = candidates[0];
}

// ── Request Helper ──
async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const res = await fetch(`${apiBase}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}
```

- [ ] **Step 2: Add auth functions (register, login, logout, session load)**

```javascript
// ── Auth ──
function persistToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    state.token = token;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    state.token = "";
  }
}

async function loadSession() {
  if (!state.token) return;
  try {
    const data = await request("/members/me");
    state.member = data;
  } catch {
    persistToken("");
    state.member = null;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    displayName: form.get("displayName"),
    email: form.get("email"),
    password: form.get("password"),
  };
  try {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    persistToken(data.token);
    state.member = data.member;
    showFlash("register-flash", "註冊成功！", "success");
    renderNav();
    // Scroll to top after successful registration
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    showFlash("register-flash", err.message || "註冊失敗");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "").trim();
  if (!email || !password) {
    showFlash("login-flash", "請輸入 Email 和密碼");
    return;
  }
  try {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    persistToken(data.token);
    state.member = data.member;
    closeLoginModal();
    renderNav();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    showFlash("login-flash", err.message || "登入失敗");
  }
}

function logout() {
  persistToken("");
  state.member = null;
  state.wallet = { account: "", balanceWei: "0" };
  renderNav();
}
```

- [ ] **Step 3: Add MetaMask wallet connection and token balance**

```javascript
// ── Wallet ──
async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    alert("請先安裝 MetaMask");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const account = accounts[0];
    state.wallet.account = account;

    // Link wallet to backend
    await request("/members/wallet/link", {
      method: "POST",
      body: JSON.stringify({ walletAddress: account }),
    });

    // Reload member to get updated wallet info
    await loadSession();
    await loadTokenBalance();
    renderNav();
  } catch (err) {
    console.error("Wallet connection failed:", err);
    alert("錢包連結失敗：" + (err.message || "Unknown error"));
  }
}

async function loadTokenBalance() {
  if (!state.wallet.account) return;
  try {
    // Try reading token balance from contract info endpoint
    const info = await request("/contract-info");
    if (info && info.membershipTokenAddress && window.ethereum) {
      const { ethers } = await import("https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
      const token = new ethers.Contract(info.membershipTokenAddress, erc20Abi, provider);
      state.wallet.balanceWei = (await token.balanceOf(state.wallet.account)).toString();
    }
  } catch {
    // Token balance unavailable — not critical
  }
}

function formatTokenBalance() {
  try {
    const wei = BigInt(state.wallet.balanceWei || "0");
    const whole = wei / BigInt(10 ** 18);
    return whole.toString();
  } catch {
    return "0";
  }
}
```

- [ ] **Step 4: Add UI helpers (flash messages, modal, smooth scroll, nav render)**

```javascript
// ── UI Helpers ──
function showFlash(id, message, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.className = "lp-flash" + (type === "success" ? " success" : "");
  setTimeout(() => {
    el.hidden = true;
  }, 5000);
}

function openLoginModal() {
  document.getElementById("login-modal").hidden = false;
}

function closeLoginModal() {
  document.getElementById("login-modal").hidden = true;
}

function truncateAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// ── Nav Rendering ──
function renderNav() {
  const container = document.getElementById("nav-auth");
  if (!state.member) {
    // Visitor state
    container.innerHTML = `
      <button class="lp-nav-btn" id="nav-login">登入</button>
      <button class="lp-nav-btn lp-nav-btn-accent" id="nav-register">註冊</button>
    `;
    container.querySelector("#nav-login").addEventListener("click", openLoginModal);
    container.querySelector("#nav-register").addEventListener("click", () => {
      document.getElementById("register").scrollIntoView({ behavior: "smooth" });
    });
    return;
  }

  const wallet = state.member.walletAddress || state.wallet.account;

  if (!wallet) {
    // Logged in, no wallet
    container.innerHTML = `
      <button class="lp-nav-btn" id="nav-connect-wallet">連結錢包</button>
      <button class="lp-nav-btn" id="nav-logout">登出</button>
    `;
    container.querySelector("#nav-connect-wallet").addEventListener("click", connectWallet);
    container.querySelector("#nav-logout").addEventListener("click", logout);
    return;
  }

  // Logged in + wallet connected
  const balance = formatTokenBalance();
  container.innerHTML = `
    <span class="lp-wallet-chip">${truncateAddress(wallet)}</span>
    <span class="lp-token-badge">💰 ${balance} MV</span>
    <button class="lp-nav-btn" id="nav-logout">登出</button>
  `;
  container.querySelector("#nav-logout").addEventListener("click", logout);
}

// ── Smooth scroll for CTA ──
function initSmoothScroll() {
  document.querySelectorAll("[data-action='scroll-register']").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("register").scrollIntoView({ behavior: "smooth" });
    });
  });
}
```

- [ ] **Step 5: Add boot function and event binding**

```javascript
// ── Boot ──
async function boot() {
  await detectApiBase();
  await loadSession();

  // If member has a wallet, restore wallet state
  if (state.member && state.member.walletAddress) {
    state.wallet.account = state.member.walletAddress;
    await loadTokenBalance();
  }

  renderNav();
  initSmoothScroll();

  // Form handlers
  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("login-form").addEventListener("submit", handleLogin);

  // Login modal
  document.getElementById("open-login").addEventListener("click", (e) => {
    e.preventDefault();
    openLoginModal();
  });
  document.getElementById("close-login").addEventListener("click", closeLoginModal);
  document.getElementById("login-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeLoginModal();
  });
}

boot();
```

- [ ] **Step 6: Verify registration flow works end-to-end**

Run: Start backend with `cd backend && go run .`, start frontend with `cd frontend && python3 -m http.server 4173`. Open `http://localhost:4173/landing.html`. Fill in registration form and submit.

Expected: Registration succeeds, nav updates to show "連結錢包" + "登出" buttons, flash shows success message.

- [ ] **Step 7: Verify login modal works**

Run: Click "已有帳號？登入" link, fill in credentials, submit.

Expected: Modal opens, login succeeds, modal closes, nav updates.

- [ ] **Step 8: Verify wallet connection works**

Run: Click "連結錢包" in nav (with MetaMask installed), approve connection.

Expected: Nav updates to show truncated wallet address + token balance + 登出.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/landing.js
git commit -m "feat: add landing page JS with auth, wallet connection, and nav state"
```

---

### Task 4: Final Integration & Polish

**Files:**
- Modify: `frontend/login.html` — add link to landing page
- Verify: `frontend/landing.html`, `frontend/src/landing.css`, `frontend/src/landing.js`

- [ ] **Step 1: Add a link from login.html to the landing page**

In `frontend/login.html`, find the login header section and add a "back to home" link. Read the file first to find the exact location.

Add this link at the top of the login card:

```html
<a href="./landing.html" style="font-size:0.82rem;color:var(--muted);">← 返回首頁</a>
```

- [ ] **Step 2: Update landing.js logout to stay on landing page**

Verify that the `logout()` function in `landing.js` does NOT redirect to `login.html` — it should stay on the landing page and just re-render the nav. (Already implemented correctly in Task 3.)

- [ ] **Step 3: Full page walkthrough test**

Run: Open `http://localhost:4173/landing.html` in browser.

Verify each section:
1. Sticky nav visible with 登入/註冊 buttons
2. Hero section with headline, subheadline, CTA buttons, app mockup with animated vote bars
3. Feature cards (6 cards, 2 rows of 3 on desktop)
4. How it works (4 horizontal steps with arrows)
5. Blockchain explainer (2-column layout)
6. Registration form (3 inputs + button)
7. Footer with links and language toggle

- [ ] **Step 4: Responsive test**

Run: Resize browser to tablet (1024px) and mobile (768px) widths.

Verify:
- Tablet: Hero stacks vertically, feature cards become 2-column
- Mobile: Nav links hidden, hero text smaller, feature cards single-column, steps vertical

- [ ] **Step 5: Commit all final changes**

```bash
git add frontend/login.html
git commit -m "feat: link login page back to landing page"
```
