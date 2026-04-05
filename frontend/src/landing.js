// landing.js — MealVote landing page JavaScript
// Standalone module: no imports from main.js

/* ── Constants ──────────────────────────────────────────── */
const TOKEN_KEY = "mealvote.token";
const API_BASE_KEY = "mealvote.apiBase";
const DAILY_LOGIN_REWARD_STORAGE_KEY = "mealvote.dailyLoginRewardGranted";
const DAILY_LOGIN_REWARD_QUERY_KEY = "dailyReward";

/* ── State ──────────────────────────────────────────────── */
const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  member: null,
  wallet: {
    account: "",
    balanceWei: "0",
  },
};

let apiBase = "";

/* ── API Base Detection ─────────────────────────────────── */
function buildApiBaseCandidates() {
  const stored = localStorage.getItem(API_BASE_KEY) || "";
  const hostname = window.location.hostname || "localhost";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return Array.from(
    new Set(
      [
        stored,
        `${protocol}//${hostname}:8080`,
        "http://localhost:8080",
        "http://127.0.0.1:8080",
      ].filter(Boolean)
    )
  );
}

async function detectApiBase() {
  const stored = localStorage.getItem(API_BASE_KEY);
  if (stored) {
    // Quick verify stored base first
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1500);
      const response = await fetch(`${stored}/health`, { signal: controller.signal });
      window.clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.status === "ok") {
        apiBase = stored;
        return;
      }
    } catch {
      // fall through to full candidate list
    }
  }

  const candidates = buildApiBaseCandidates();
  for (const base of candidates) {
    if (!base) continue;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(`${base}/health`, { signal: controller.signal });
      window.clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.status === "ok") {
        apiBase = base;
        localStorage.setItem(API_BASE_KEY, base);
        return;
      }
    } catch {
      window.clearTimeout(timeout);
    }
  }
}

/* ── Request Helper ─────────────────────────────────────── */
async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const base = apiBase || localStorage.getItem(API_BASE_KEY) || "http://localhost:8080";
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { message: await response.text().catch(() => "") };

  if (!response.ok) {
    const msg = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ── Auth Functions ─────────────────────────────────────── */
function persistToken(token) {
  state.token = token || "";
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function buildPostAuthPath(member, granted) {
  const basePath = member?.subscriptionActive ? "./index.html#ordering" : "./login.html#subscribe";
  if (!granted) return basePath;
  const [base, hash = ""] = basePath.split("#");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${DAILY_LOGIN_REWARD_QUERY_KEY}=1${hash ? `#${hash}` : ""}`;
}

async function loadSession() {
  if (!state.token) return;
  try {
    state.member = await request("/members/me");
  } catch {
    state.member = null;
    persistToken("");
  }
}

async function handleWalletAuth(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  try {
    if (!state.wallet.account) {
      await connectWallet();
    }
    if (!state.wallet.account) {
      throw new Error("請先連結 MetaMask。");
    }
    const challenge = await request("/auth/wallet/challenge", {
      method: "POST",
      body: JSON.stringify({ walletAddress: state.wallet.account }),
    });
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [challenge.message, state.wallet.account],
    });
    const result = await request("/auth/wallet/verify", {
      method: "POST",
      body: JSON.stringify({
        walletAddress: state.wallet.account,
        signature,
        displayName: String(payload.displayName || "").trim(),
        inviteCode: String(payload.inviteCode || "").trim(),
      }),
    });
    if (result.dailyLoginRewardGranted) {
      sessionStorage.setItem(DAILY_LOGIN_REWARD_STORAGE_KEY, "1");
    } else {
      sessionStorage.removeItem(DAILY_LOGIN_REWARD_STORAGE_KEY);
    }
    persistToken(result.token);
    state.member = result.member;
    window.location.href = buildPostAuthPath(result.member, Boolean(result.dailyLoginRewardGranted));
  } catch (err) {
    showFlash(form.id === "login-form" ? "login-flash" : "register-flash", err.message || "錢包簽名登入失敗。", "error");
  }
}

function logout() {
  persistToken("");
  state.member = null;
  state.wallet.account = "";
  state.wallet.balanceWei = "0";
  renderNav();
}

/* ── MetaMask Wallet ────────────────────────────────────── */
async function connectWallet() {
  if (!window.ethereum) {
    alert("請先安裝 MetaMask 錢包擴充功能。");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const account = accounts[0];
    if (!account) return;
    state.wallet.account = account;
    await loadTokenBalance();
    renderNav();
  } catch (err) {
    console.error("Wallet connection failed:", err);
    alert(err.message || "錢包連結失敗，請稍後再試。");
  }
}

async function loadTokenBalance() {
  if (!state.wallet.account) return;
  try {
    const contractInfo = await request("/contract-info");
    const tokenAddress = contractInfo?.membershipTokenAddress;
    if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
      state.wallet.balanceWei = "0";
      return;
    }
    const { ethers } = await import("https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const abi = ["function balanceOf(address owner) view returns (uint256)"];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const balance = await contract.balanceOf(state.wallet.account);
    state.wallet.balanceWei = balance.toString();
  } catch (err) {
    console.error("Failed to load token balance:", err);
    state.wallet.balanceWei = "0";
  }
}

function formatTokenBalance() {
  const wei = BigInt(state.wallet.balanceWei || "0");
  const whole = wei / BigInt("1000000000000000000");
  return whole.toString();
}

/* ── UI Helpers ─────────────────────────────────────────── */
function showFlash(id, message, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = "lp-flash";
  if (type === "error") {
    el.classList.add("lp-flash-error");
  } else if (type === "success") {
    el.classList.add("lp-flash-success");
  }
  el.hidden = false;
  window.setTimeout(() => {
    el.hidden = true;
    el.textContent = "";
    el.className = "lp-flash";
  }, 5000);
}

function openLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.hidden = false;
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.hidden = true;
}

function truncateAddress(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ── Nav Rendering ──────────────────────────────────────── */
function renderNav() {
  const navAuth = document.getElementById("nav-auth");
  if (!navAuth) return;

  if (!state.member) {
    // Visitor state: show 登入 + 註冊 buttons
    navAuth.innerHTML = `
      <button class="lp-btn" id="nav-login-btn">登入</button>
      <button class="lp-btn lp-btn-primary" id="nav-register-btn">註冊</button>
    `;
    document.getElementById("nav-login-btn")?.addEventListener("click", openLoginModal);
    document.getElementById("nav-register-btn")?.addEventListener("click", () => {
      document.getElementById("register")?.scrollIntoView({ behavior: "smooth" });
    });
    return;
  }

  if (!state.wallet.account) {
    // Logged in, no wallet
    navAuth.innerHTML = `
      <button class="lp-btn" id="nav-connect-btn">連結錢包</button>
      <button class="lp-btn" id="nav-logout-btn">登出</button>
    `;
    document.getElementById("nav-connect-btn")?.addEventListener("click", connectWallet);
    document.getElementById("nav-logout-btn")?.addEventListener("click", logout);
    return;
  }

  // Logged in + wallet connected
  const balance = formatTokenBalance();
  navAuth.innerHTML = `
    <span class="lp-wallet-chip">${truncateAddress(state.wallet.account)}</span>
    <span class="lp-token-badge">🪙 ${balance} MVT</span>
    <button class="lp-btn" id="nav-logout-btn">登出</button>
  `;
  document.getElementById("nav-logout-btn")?.addEventListener("click", logout);
}

/* ── Smooth Scroll ──────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('[data-action="scroll-register"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("register")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* ── Boot ───────────────────────────────────────────────── */
async function boot() {
  await detectApiBase();
  await loadSession();

  if (state.member?.walletAddress) {
    state.wallet.account = state.member.walletAddress;
    await loadTokenBalance();
  }

  renderNav();
  initSmoothScroll();

  // Bind registration form
  document.getElementById("register-form")?.addEventListener("submit", handleWalletAuth);

  // Bind login form
  document.getElementById("login-form")?.addEventListener("submit", handleWalletAuth);
  document.querySelectorAll("[data-connect-wallet]").forEach((button) => {
    button.addEventListener("click", connectWallet);
  });

  // Bind modal open/close
  document.getElementById("open-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    openLoginModal();
  });
  document.getElementById("close-login")?.addEventListener("click", closeLoginModal);

  // Close modal on overlay click
  document.getElementById("login-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      closeLoginModal();
    }
  });
}

boot();
