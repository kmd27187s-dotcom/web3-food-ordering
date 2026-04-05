const API_BASE_STORAGE_KEY = "mealvote.apiBase";
const SIDEBAR_PAGE_STORAGE_KEY = "mealvote.sidebarPage";
const TOKEN_STORAGE_KEY = "mealvote.token";
const ACTIVE_GROUP_ID_KEY = "mealvote.activeGroupId";
const DAILY_LOGIN_REWARD_STORAGE_KEY = "mealvote.dailyLoginRewardGranted";
const DAILY_LOGIN_REWARD_QUERY_KEY = "dailyReward";
const APPROX_TWD_PER_ETH = 120000;
const storedApiBase = localStorage.getItem(API_BASE_STORAGE_KEY) || "";
const API_BASE_CANDIDATES = buildApiBaseCandidates();
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const APP_PAGE = document.body.dataset.page || "app";
let ethersLibPromise = null;
let generatedContracts = null;
let activeApiBase = "";
let delegatedListenersBound = false;
let dailyRewardToastTimer = null;
const APP_TABS = ["proposal", "voting", "ordering", "records", "leaderboard", "member"];
const MERCHANT_PROPOSAL_CATALOG = [
  { id: "shop-bento", name: "午間便當室", organization: "taipei-xinyi", mealPeriod: "lunch" },
  { id: "shop-salad", name: "輕禾沙拉所", organization: "taipei-xinyi", mealPeriod: "lunch" },
  { id: "shop-hotpot", name: "湯潮火鍋", organization: "taipei-xinyi", mealPeriod: "dinner" },
  { id: "shop-nangang-bowl", name: "南港能量餐盒", organization: "taipei-nangang", mealPeriod: "lunch" },
  { id: "shop-nangang-ramen", name: "程式拉麵研究所", organization: "taipei-nangang", mealPeriod: "dinner" },
  { id: "shop-songshan-curry", name: "松山咖哩製造所", organization: "taipei-songshan", mealPeriod: "lunch" },
  { id: "shop-songshan-bbq", name: "夜場串燒局", organization: "taipei-songshan", mealPeriod: "dinner" },
];
const VOTING_ABI = [
  "function createProposal(string title, string description, string merchantGroup, uint256 proposalDeadline, uint256 voteDeadline, uint256 orderDeadline) returns (uint256)",
  "function subscribeMonthly()",
  "function addOption(uint256 proposalId, string merchantId, string merchantName)",
  "function vote(uint256 proposalId, uint256 optionIndex, uint256 tokenAmount)",
  "function placeOrder(uint256 proposalId, bytes32 orderHash, string note, uint256 amount, uint256 expiry, bytes sig) payable",
  "function cancelOrder(uint256 proposalId)",
  "function settleProposal(uint256 proposalId)",
];
const TOKEN_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const state = {
  token: localStorage.getItem(TOKEN_STORAGE_KEY) || "",
  member: null,
  contractInfo: null,
  proposals: [],
  activeProposalId: null,
  selectedMealPeriod: "lunch",
  selectedProposalDate: "",
  appTab: readAppTabFromHash(),
  stagePage: readStagePageFromHash(),
  sidebarPage: readSidebarPage(),
  leaderboard: [],
  pendingTransactions: [],
  usageRecords: [],
  demoMode: false,
  groups: [],
  activeGroupId: null,
  activeGroup: null,
  transactionDraft: {
    action: "place_order",
    txHash: "",
    proposalId: "",
    relatedOrder: "",
  },
  orderPreview: null,
  flash: "",
  selectedItems: {},
  wallet: {
    account: "",
    balanceWei: "0",
    chainId: "",
  },
  subscriptionPending: false,
  dailyLoginRewardPopupVisible: false,
};

const SUBSCRIPTION_COST = 99;

const demoMembers = [
  {
    id: 1,
    displayName: "Alice",
    email: "alice@example.com",
    points: 142,
    tokenBalance: 380,
    walletAddress: "",
    avatarUrl: createAvatarDataUrl("A", "#c96a32"),
  },
  {
    id: 2,
    displayName: "Bob",
    email: "bob@example.com",
    points: 108,
    tokenBalance: 290,
    walletAddress: "",
    avatarUrl: createAvatarDataUrl("B", "#4d7f68"),
  },
  {
    id: 3,
    displayName: "Carol",
    email: "carol@example.com",
    points: 91,
    tokenBalance: 240,
    walletAddress: "",
    avatarUrl: createAvatarDataUrl("C", "#8060b8"),
  },
];

const demoProfiles = {
  1: {
    member: demoMembers[0],
    rank: 1,
    buildings: [
      { name: "市場總部", level: 4, skin: "copper" },
      { name: "深夜食堂", level: 3, skin: "ember" },
    ],
    history: { proposalsCreated: 6, votesCast: 12, ordersSubmitted: 9 },
  },
  2: {
    member: demoMembers[1],
    rank: 2,
    buildings: [
      { name: "午餐塔樓", level: 3, skin: "sage" },
      { name: "點數倉庫", level: 2, skin: "granite" },
    ],
    history: { proposalsCreated: 4, votesCast: 10, ordersSubmitted: 8 },
  },
  3: {
    member: demoMembers[2],
    rank: 3,
    buildings: [
      { name: "投票工坊", level: 2, skin: "violet" },
      { name: "外送碼頭", level: 2, skin: "sand" },
    ],
    history: { proposalsCreated: 3, votesCast: 8, ordersSubmitted: 6 },
  },
};

const demoLeaderboard = demoMembers.map((member, index) => ({
  memberId: member.id,
  rank: index + 1,
  displayName: member.displayName,
  points: member.points,
}));

const demoProposals = [
  {
    id: 101,
    title: "信義區午餐局",
    description: "提案期與投票期都吃 token，勝出店家會開放全員點餐。",
    merchantGroup: "taipei-xinyi",
    status: "ordering",
    proposalDeadline: minutesFromNow(-90),
    voteDeadline: minutesFromNow(-30),
    orderDeadline: minutesFromNow(45),
    winnerOptionId: 1002,
    options: [
      { id: 1001, merchantId: "shop-bento", merchantName: "小滿便當", proposerName: "Alice", weightedVotes: 24 },
      { id: 1002, merchantId: "shop-hotpot", merchantName: "湯潮火鍋", proposerName: "Bob", weightedVotes: 37 },
      { id: 1003, merchantId: "shop-salad", merchantName: "綠洲沙拉", proposerName: "Carol", weightedVotes: 18 },
    ],
  },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createAvatarDataUrl(label, color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="24" fill="${color}" />
      <text x="50%" y="56%" text-anchor="middle" font-size="40" font-family="Manrope, Arial, sans-serif" fill="#fff7ef">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function buildApiBaseCandidates() {
  const pageHost = window.location.hostname || "localhost";
  const pageProtocol = window.location.protocol === "https:" ? "https:" : "http:";
  return Array.from(
    new Set(
      [
        storedApiBase,
        `${pageProtocol}//${pageHost}:8080`,
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://[::1]:8080",
      ].filter(Boolean)
    )
  );
}

const app = document.querySelector("#app");
if (app) {
  app.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:'Noto Sans TC',sans-serif;background:linear-gradient(135deg,#f6f0e6 0%,#efe4d0 100%);color:#2b1e15;">
      <div style="max-width:720px;background:rgba(255,252,246,.88);border:1px solid rgba(83,60,39,.15);border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(75,48,24,.1);">
        <strong style="display:block;font-size:20px;margin-bottom:8px;">MealVote 正在整理工作台</strong>
        <p style="margin:0;color:#7a6654;">提案、投票、點餐和會員側邊欄正在載入中。</p>
      </div>
    </div>
  `;
}

window.addEventListener("hashchange", () => {
  const tab = readAppTabFromHash();
  if (tab !== state.appTab) {
    state.appTab = tab;
    render();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const visualThesis = "像餐桌指揮台的暖色營運介面，保留鏈上交易的精準感。";
const contentPlan = "Hero = 今日提案狀態；Support = 投票與提名；Detail = 點餐與簽名；Final CTA = 排行榜與成就。";
const interactionThesis = "倒數區塊浮動、提案切換淡入、排行榜列 hover 位移。";

console.info({ visualThesis, contentPlan, interactionThesis });

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const preferredBase = activeApiBase || API_BASE_CANDIDATES[0] || "";
  const candidates = [preferredBase, ...API_BASE_CANDIDATES.filter((base) => base && base !== preferredBase)];
  let lastError = null;

  for (const base of candidates) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${base}${path}`, { ...options, headers, signal: controller.signal });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => ({}))
        : { raw: await response.text().catch(() => "") };
      if (!response.ok) {
        if (shouldRetryDifferentBase(response, data)) {
          lastError = new Error(`retry next base after ${response.status}`);
          continue;
        }
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      activeApiBase = base;
      localStorage.setItem(API_BASE_STORAGE_KEY, base);
      return data;
    } catch (error) {
      lastError = error;
      if (!shouldRetryNextBase(error)) {
        throw error;
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw normalizeNetworkError(lastError);
}

function shouldRetryNextBase(error) {
  const message = String(error?.message || "");
  return error?.name === "AbortError" || /fetch|network|load failed|timed out|timeout/i.test(message);
}

function shouldRetryDifferentBase(response, data) {
  if (!response) return false;
  const hasApiError = typeof data?.error === "string" && data.error.trim() !== "";
  if (hasApiError) {
    return false;
  }
  return response.status === 404 || response.status === 405 || response.status === 500;
}

function normalizeNetworkError(error) {
  if (error?.name === "AbortError") {
    return new Error("連線 backend 逾時");
  }
  const message = String(error?.message || "");
  if (/fetch|network|load failed/i.test(message)) {
    return new Error("目前無法連到 backend");
  }
  return error instanceof Error ? error : new Error("Request failed");
}

function resolveFormElement(source) {
  if (source instanceof HTMLFormElement) {
    return source;
  }
  if (source instanceof Element) {
    return source.closest("form");
  }
  return null;
}

function formDataFromEvent(event) {
  const form =
    resolveFormElement(event?.currentTarget) ||
    resolveFormElement(event?.target) ||
    resolveFormElement(document.activeElement);
  if (!form) {
    throw new Error("找不到可提交的表單，請重新整理頁面後再試一次。");
  }
  return new FormData(form);
}

async function boot() {
  await loadGeneratedContracts();
  await detectApiBase();
  const sessionResult = await Promise.allSettled([
    loadSession(),
    loadContractInfo(),
  ]);
  const hasSessionFailure = sessionResult.some((result) => result.status === "rejected");
  if (hasSessionFailure) {
    applyDemoFallback();
    state.flash = "目前讀不到 backend，已切換成前端 demo 模式。";
  }
  if (APP_PAGE !== "login" && state.member && !isSubscribed()) {
    window.location.href = "./login.html#subscribe";
    return;
  }
  if (APP_PAGE !== "login" && !state.member) {
    window.location.href = "./login.html";
    return;
  }
  const results = await Promise.allSettled([
    loadProposals(),
    loadLeaderboard(),
    loadPendingTransactions(),
    loadUsageRecords(),
  ]);
  const hasBootstrapFailure = results.some((result) => result.status === "rejected");
  if (hasBootstrapFailure) {
    applyDemoFallback();
    state.flash = "目前讀不到 backend，已切換成前端 demo 模式。";
  }
  await loadActiveGroup();
  consumeDailyLoginRewardNotice();
  startPendingTransactionPolling();
  render();
}

async function detectApiBase() {
  for (const base of API_BASE_CANDIDATES) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(`${base}/health`, { signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.status === "ok") {
        activeApiBase = base;
        localStorage.setItem(API_BASE_STORAGE_KEY, base);
        return true;
      }
    } catch {
      // Try the next candidate.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  activeApiBase = API_BASE_CANDIDATES[0] || "";
  return false;
}

function applyDemoFallback() {
  state.demoMode = true;
  if (!state.proposals.length) {
    state.proposals = structuredClone(demoProposals);
  }
  ensureActiveProposal();
  if (!state.leaderboard.length) {
    state.leaderboard = structuredClone(demoLeaderboard);
  }
}

async function loadGeneratedContracts() {
  try {
    const response = await fetch("./src/generated/contracts.json");
    if (!response.ok) {
      generatedContracts = null;
      return;
    }
    generatedContracts = await response.json();
  } catch {
    generatedContracts = null;
  }
}

async function loadSession() {
  if (!state.token) return;
  try {
    state.member = await request("/members/me");
  } catch {
    clearAuthState();
  }
}

async function loadActiveGroup() {
  state.groups = [];
  state.activeGroup = null;
  state.activeGroupId = null;
  if (!state.token) return;

  let groups = [];
  try {
    groups = toArray(await request("/groups"));
    state.groups = groups;
  } catch {
    state.groups = [];
    localStorage.removeItem(ACTIVE_GROUP_ID_KEY);
    return;
  }

  if (!groups.length) {
    localStorage.removeItem(ACTIVE_GROUP_ID_KEY);
    return;
  }

  const savedId = Number.parseInt(localStorage.getItem(ACTIVE_GROUP_ID_KEY) || "", 10);
  const preferredGroup = groups.find((group) => group.id === savedId) || groups[0];
  if (!preferredGroup) {
    localStorage.removeItem(ACTIVE_GROUP_ID_KEY);
    return;
  }

  try {
    const group = await request(`/groups/${preferredGroup.id}`);
    state.activeGroup = group;
    state.activeGroupId = group.id;
    localStorage.setItem(ACTIVE_GROUP_ID_KEY, String(group.id));
  } catch {
    localStorage.removeItem(ACTIVE_GROUP_ID_KEY);
  }
}

async function loadProposals() {
  if (!state.token) {
    state.proposals = [];
    state.activeProposalId = null;
    return;
  }
  state.proposals = toArray(await request("/proposals")).map(normalizeProposal);
  ensureActiveProposal();
}

async function refreshProposalByID(proposalID) {
  if (!proposalID) {
    await loadProposals();
    return;
  }
  const proposal = normalizeProposal(await request(`/proposals/${proposalID}`));
  const next = state.proposals.slice();
  const index = next.findIndex((item) => item.id === proposalID);
  if (index >= 0) {
    next[index] = proposal;
  } else {
    next.unshift(proposal);
  }
  state.proposals = next;
  state.activeProposalId = proposalID;
  ensureActiveProposal();
}

async function loadLeaderboard() {
  state.leaderboard = await request("/leaderboard");
}

async function loadContractInfo() {
  try {
    state.contractInfo = await request("/contract");
  } catch {
    state.contractInfo = generatedContracts
      ? {
          orderContract: generatedContracts.orderContract,
          tokenContract: generatedContracts.tokenContract,
          chainId: generatedContracts.chainId,
        }
      : null;
  }
}

async function loadPendingTransactions() {
  if (!state.token) {
    state.pendingTransactions = [];
    return;
  }
  try {
    state.pendingTransactions = toArray(await request("/transactions?limit=8"));
  } catch {
    state.pendingTransactions = [];
  }
}

async function loadUsageRecords() {
  if (!state.token) {
    state.usageRecords = [];
    return;
  }
  try {
    state.usageRecords = toArray(await request("/members/me/usage?limit=40"));
  } catch {
    state.usageRecords = [];
  }
}

async function createGroup(name, description) {
  return await request("/groups", {
    method: "POST",
    body: JSON.stringify({ name, description: description || "" }),
  });
}

async function joinGroup(inviteCode) {
  return await request(`/join/${inviteCode}`, { method: "POST" });
}

async function generateInvite(groupId) {
  return await request(`/groups/${groupId}/invite`, { method: "POST" });
}

async function leaveGroup(groupId) {
  return await request(`/groups/${groupId}/leave`, { method: "POST", body: "{}" });
}

async function claimTickets() {
  return await request("/members/tickets/claim", { method: "POST", body: "{}" });
}

async function claimFaucet() {
  return await request("/tokens/claim", { method: "POST" });
}

async function advanceProposalStage(proposalId, stage) {
  return await request(`/admin/proposals/${proposalId}/advance`, {
    method: "POST",
    body: JSON.stringify({ stage }),
  });
}

async function claimReward(proposalId) {
  return await request(`/proposals/${proposalId}/claim`, { method: "POST" });
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProposal(proposal) {
  return {
    ...proposal,
    options: toArray(proposal?.options).map(normalizeProposalOption),
    votes: toArray(proposal?.votes),
    orders: toArray(proposal?.orders),
  };
}

function normalizeProposalOption(option) {
  return {
    ...option,
    chainOptionIndex:
      typeof option?.chainOptionIndex === "number" && Number.isInteger(option.chainOptionIndex)
        ? option.chainOptionIndex
        : null,
  };
}

function hasChainProposalId(proposal) {
  return typeof proposal?.chainProposalId === "number" && Number.isInteger(proposal.chainProposalId) && proposal.chainProposalId >= 0;
}

function hasChainOptionIndex(option) {
  return typeof option?.chainOptionIndex === "number" && Number.isInteger(option.chainOptionIndex) && option.chainOptionIndex >= 0;
}

function canUseDirectChainProposalMode(proposal) {
  return canUseDirectChainMode() && hasChainProposalId(proposal);
}

function proposalById(id) {
  const proposals = visibleProposals();
  return (
    proposals.find((proposal) => proposal.id === id) ||
    proposalForSelection(normalizedSelectedMealPeriod(), normalizedSelectedProposalDate()) ||
    proposals[0] ||
    null
  );
}

function visibleProposals() {
  if (!state.activeGroupId) {
    return [];
  }
  const scoped = state.proposals.filter((p) => {
    if (!isVisibleProposal(p)) return false;
    if (state.activeGroupId) return p.groupId === state.activeGroupId;
    return true;
  });
  return scoped
    .slice()
    .sort((a, b) => {
      const dateCompare = proposalDateKey(b).localeCompare(proposalDateKey(a));
      if (dateCompare !== 0) return dateCompare;
      return (b.id || 0) - (a.id || 0);
    });
}

function ensureActiveProposal() {
  const proposals = visibleProposals();
  if (proposals.length === 0) {
    state.activeProposalId = null;
    return;
  }
  const selectedProposal = proposalForSelection(activeMealPeriod(), activeProposalDate());
  if (selectedProposal?.id) {
    state.activeProposalId = selectedProposal.id;
    return;
  }
  if (!proposals.some((proposal) => proposal.id === state.activeProposalId)) {
    state.activeProposalId = proposals[0].id;
  }
}

function formatEth(wei) {
  return `${(Number(wei) / 1e18).toFixed(4)} ETH`;
}

function weiToEthNumber(wei) {
  return Number(wei) / 1e18;
}

function formatApproxTWD(wei) {
  const amount = Math.round(weiToEthNumber(wei) * APPROX_TWD_PER_ETH);
  return `約 NT$${amount.toLocaleString("zh-TW")}`;
}

function formatPricePair(wei) {
  return `${formatEth(wei)} / ${formatApproxTWD(wei)}`;
}

function formatClock(dateString) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function stageLabel(status) {
  switch (status) {
    case "upcoming":
      return "待開始";
    case "proposing":
      return "提案期";
    case "voting":
      return "投票期";
    case "awaiting_finalization":
      return "等待定案";
    case "ordering":
      return "點餐期";
    case "awaiting_settlement":
      return "等待結算";
    case "settled":
      return "已結算";
    default:
      return status;
  }
}

function readStagePageFromHash() {
  const raw = String(window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (raw === "proposal" || raw === "voting" || raw === "ordering") {
    return raw;
  }
  return "";
}

function readAppTabFromHash() {
  const raw = String(window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (raw === "create") {
    return "proposal";
  }
  if (raw === "groups") {
    return "member";
  }
  if (raw === "order-system") {
    return "ordering";
  }
  if (raw === "transactions") {
    return "records";
  }
  if (APP_TABS.includes(raw)) {
    return raw;
  }
  return "proposal";
}

function readSidebarPage() {
  const value = localStorage.getItem(SIDEBAR_PAGE_STORAGE_KEY) || "member";
  if (value === "member" || value === "transactions" || value === "leaderboard") {
    return value;
  }
  return "member";
}

function currentMealPeriod(now = new Date()) {
  return now.getHours() < 12 ? "lunch" : "dinner";
}

function currentMealPeriodLabel(now = new Date()) {
  return currentMealPeriod(now) === "lunch" ? "中餐" : "晚餐";
}

function todayInputValue(now = new Date()) {
  return localDayKey(now);
}

function mealPeriodLabel(period) {
  return period === "dinner" ? "晚餐" : "中餐";
}

function activeMealPeriod() {
  const proposal = proposalForSelection(normalizedSelectedMealPeriod(), normalizedSelectedProposalDate()) || proposalById(state.activeProposalId);
  if (proposal?.mealPeriod) {
    return proposal.mealPeriod;
  }
  return normalizedSelectedMealPeriod();
}

function activeProposalDate() {
  const proposal = proposalById(state.activeProposalId);
  return proposal?.proposalDate || normalizedSelectedProposalDate();
}

function normalizedSelectedMealPeriod() {
  return currentMealPeriod();
}

function normalizedSelectedProposalDate() {
  return todayInputValue();
}

function availableProposalMerchants(mealPeriod = activeMealPeriod()) {
  return MERCHANT_PROPOSAL_CATALOG.filter((merchant) => merchant.mealPeriod === mealPeriod);
}

function availableAddOptionMerchants(proposal) {
  const proposed = new Set((proposal?.options || []).map((option) => option.merchantId));
  return availableProposalMerchants(proposal?.mealPeriod).filter((merchant) => !proposed.has(merchant.id));
}

function localDayKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function proposalDateKey(proposal) {
  return proposal?.proposalDate || localDayKey(proposal?.createdAt || proposal?.proposalDeadline || proposal?.voteDeadline || proposal?.orderDeadline);
}

function isVisibleProposal(proposal) {
  if (!proposal) return false;
  return proposalDateKey(proposal) >= localDayKey(new Date());
}

function proposalForSelection(mealPeriod, proposalDate) {
  const normalizedMeal = mealPeriod === "dinner" ? "dinner" : "lunch";
  const normalizedDate = proposalDate || todayInputValue();
  return visibleProposals().find(
    (proposal) => proposal.mealPeriod === normalizedMeal && proposalDateKey(proposal) === normalizedDate
  ) || null;
}

function proposingProposalForOrganization(mealPeriod = normalizedSelectedMealPeriod(), proposalDate = normalizedSelectedProposalDate()) {
  const proposal = proposalForSelection(mealPeriod, proposalDate);
  if (proposal?.status === "proposing") {
    return proposal;
  }
  return null;
}

function stagePageForStatus(status) {
  switch (status) {
    case "proposing":
      return "proposal";
    case "voting":
    case "awaiting_finalization":
      return "voting";
    case "ordering":
    case "awaiting_settlement":
    case "settled":
      return "ordering";
    default:
      return "proposal";
  }
}

function activeStagePage(proposal) {
  return state.stagePage || stagePageForStatus(proposal?.status);
}

function setStagePage(page) {
  state.stagePage = page;
  const nextHash = `#${page}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function setSidebarPage(page) {
  state.sidebarPage = page;
  localStorage.setItem(SIDEBAR_PAGE_STORAGE_KEY, page);
}

function setAppTab(tab) {
  state.appTab = tab;
  const nextHash = `#${tab}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function persistToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function clearAuthState() {
  persistToken("");
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  state.member = null;
  state.pendingTransactions = [];
  state.usageRecords = [];
  state.orderPreview = null;
  state.transactionDraft = {
    action: "place_order",
    txHash: "",
    proposalId: "",
    relatedOrder: "",
  };
}

function logoutAndRedirect() {
  clearAuthState();
  window.location.href = "./login.html";
}

function render() {
  if (APP_PAGE === "login") {
    renderLoginPage();
    return;
  }

  renderAppPage();
}

function renderLoginPage() {
  app.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <div class="login-header">
          <a href="./landing.html" style="font-size:0.82rem;color:var(--muted);">← 返回首頁</a>
          <strong class="login-logo">MealVote</strong>
          <p class="muted-text">群組投票點餐系統</p>
          ${state.demoMode ? `<small class="demo-tag">Demo data mode</small>` : ""}
        </div>
        ${state.flash ? `<div class="flash-banner">${escapeHtml(state.flash)}</div>` : ""}
        ${state.member ? renderLoggedInGateway() : renderAuthForms()}
      </div>
    </div>
    ${renderDailyLoginRewardDialog()}
  `;
  bindUI();
}

function isSubscribed() {
  return Boolean(state.member?.subscriptionActive);
}

function renderLoggedInGateway() {
  if (!isSubscribed()) {
    return renderSubscriptionGate();
  }
  return `
    <div class="rail-panel">
      ${renderMember(state.member)}
      <div class="wallet-chip">
        <span>Wallet</span>
        <strong>${escapeHtml(state.wallet.account || state.member.walletAddress || "尚未連接")}</strong>
        <small>${state.wallet.balanceWei !== "0" ? formatEth(state.wallet.balanceWei) : "尚未取得餘額"}</small>
        <small>${renderChainMode()}</small>
      </div>
      <div class="inline-actions">
        <a class="ghost-button order-link-button" href="./index.html#ordering">進入點餐系統</a>
        <button type="button" class="ghost-button" data-logout>登出</button>
      </div>
    </div>
  `;
}

function renderSubscriptionGate() {
  const walletConnected = !!state.wallet.account;
  return `
    <div class="subscription-gate">
      <h3>訂閱 MealVote</h3>
      <p class="muted-text">本系統為訂閱制，每月 <strong>${SUBSCRIPTION_COST} Token</strong>。第一次建立會員後，若尚未訂閱，需先付款才能使用提案、投票與點餐功能。</p>
      <div class="subscription-steps">
        <div class="sub-step ${walletConnected ? 'done' : 'active'}">
          <span class="sub-step-num">${walletConnected ? '✓' : '1'}</span>
          <div>
            <strong>連結 MetaMask 錢包</strong>
            <p>${walletConnected ? `已連結 ${state.wallet.account.slice(0,6)}...${state.wallet.account.slice(-4)}` : '請先連結你的錢包'}</p>
          </div>
        </div>
      <div class="sub-step ${walletConnected ? 'active' : 'pending'}">
        <span class="sub-step-num">2</span>
        <div>
          <strong>支付訂閱費用</strong>
          <p>${SUBSCRIPTION_COST} Token / 月，完成後會直接進入點餐系統</p>
        </div>
      </div>
    </div>
      ${!walletConnected ? `
        <button class="btn-primary btn-wallet-login" data-connect-wallet>🦊 連結 MetaMask 錢包</button>
      ` : `
        <button class="btn-primary" id="subscribe-btn" ${state.subscriptionPending ? 'disabled' : ''}>
          ${state.subscriptionPending ? '處理中...' : `支付 ${SUBSCRIPTION_COST} Token 開通訂閱`}
        </button>
      `}
      <button type="button" class="ghost-button" data-logout>登出</button>
    </div>
  `;
}

function appendDailyRewardFlag(path, granted) {
  if (!granted) return path;
  const [base, hash = ""] = path.split("#");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${DAILY_LOGIN_REWARD_QUERY_KEY}=1${hash ? `#${hash}` : ""}`;
}

function membershipLandingPath(granted = false) {
  const basePath = isSubscribed() ? "./index.html#ordering" : "./login.html#subscribe";
  return appendDailyRewardFlag(basePath, granted);
}

function redirectAfterAuth(granted = false) {
  window.location.href = membershipLandingPath(granted);
}

function rememberDailyLoginReward(granted) {
  if (granted) {
    sessionStorage.setItem(DAILY_LOGIN_REWARD_STORAGE_KEY, "1");
  } else {
    sessionStorage.removeItem(DAILY_LOGIN_REWARD_STORAGE_KEY);
  }
}

function hideDailyLoginRewardNotice() {
  state.dailyLoginRewardPopupVisible = false;
  if (dailyRewardToastTimer) {
    window.clearTimeout(dailyRewardToastTimer);
    dailyRewardToastTimer = null;
  }
}

function showDailyLoginRewardNotice() {
  state.dailyLoginRewardPopupVisible = true;
  if (dailyRewardToastTimer) {
    window.clearTimeout(dailyRewardToastTimer);
  }
  dailyRewardToastTimer = window.setTimeout(() => {
    state.dailyLoginRewardPopupVisible = false;
    dailyRewardToastTimer = null;
    render();
  }, 4200);
}

function consumeDailyLoginRewardNotice() {
  const currentUrl = new URL(window.location.href);
  const hasQueryFlag = currentUrl.searchParams.get(DAILY_LOGIN_REWARD_QUERY_KEY) === "1";
  if (hasQueryFlag) {
    currentUrl.searchParams.delete(DAILY_LOGIN_REWARD_QUERY_KEY);
    history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }
  if (hasQueryFlag || sessionStorage.getItem(DAILY_LOGIN_REWARD_STORAGE_KEY) === "1") {
    showDailyLoginRewardNotice();
    sessionStorage.removeItem(DAILY_LOGIN_REWARD_STORAGE_KEY);
  }
}

function renderTopNav() {
  const visibleTabs = [
    { id: "proposal",     label: "提案期" },
    { id: "voting",       label: "投票" },
    { id: "ordering",     label: "點餐" },
    { id: "records",      label: "紀錄" },
    { id: "leaderboard",  label: "排行榜" },
    { id: "member",       label: "會員" },
  ];
  const activeTab = state.appTab;
  const member = state.member;
  const groupIndicator = state.activeGroup
    ? `<span class="topnav-group-indicator" data-app-tab="member">${escapeHtml(state.activeGroup.name)}</span>`
    : (state.member ? `<span class="topnav-group-indicator no-group" data-app-tab="member">尚未加入群組</span>` : "");
  return `
    <nav class="topnav">
      <div class="topnav-left">
        <span class="topnav-logo">MealVote</span>
        ${groupIndicator}
        <div class="topnav-tabs">
          ${visibleTabs.map(tab => `
            <button
              class="topnav-tab ${activeTab === tab.id ? "active" : ""}"
              data-app-tab="${tab.id}"
            >${tab.label}</button>
          `).join("")}
        </div>
      </div>
      <div class="topnav-right">
        ${member ? `
          ${state.wallet.account
            ? `<span class="topnav-wallet-chip">${state.wallet.account.slice(0,6)}...${state.wallet.account.slice(-4)}</span>`
            : `<button class="topnav-connect-btn" data-connect-wallet>連結錢包</button>`
          }
          <span class="topnav-token-badge">${member.tokenBalance} MVT</span>
          ${member.tokenBalance === 0 ? `<button data-claim-faucet class="btn-primary" style="font-size:12px;padding:4px 10px">領取</button>` : ""}
          <button class="topnav-avatar" data-app-tab="member">
            <img src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(member.displayName)}" />
          </button>
          <button class="topnav-logout-btn" data-logout>登出</button>
        ` : `
          <a class="topnav-connect-btn" href="./landing.html">首頁</a>
          <a class="topnav-login-btn" href="./login.html">登入</a>
        `}
      </div>
    </nav>
  `;
}

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

  const proposals = state.proposals.length > 0 ? state.proposals : (activeProposal ? [activeProposal] : []);
  const filtered = proposals;

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
    dateHint = `截止 ${formatClock(proposal.orderDeadline)} · 冠軍：${escapeHtml(winner?.merchantName || "")}`;
    actionBtn = `<button class="btn-ordering" data-app-tab="ordering" data-proposal-id="${proposal.id}">點餐 →</button>`;
  } else if (isEnded) {
    statusClass = "dim";
    const winner = proposal.options?.find(o => o.id === proposal.winnerOptionId);
    statusBadge = `<span class="status-badge ended">已結束</span>`;
    dateHint = winner ? `🏆 ${escapeHtml(winner.merchantName)}` : "";
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
          <p class="proposal-card-title">${escapeHtml(proposal.title)}</p>
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
            <span class="vote-bar-label">${escapeHtml(opt.merchantName)}</span>
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

function renderMainSidebar() {
  return renderMemberSidebar();
}

function renderFaucetBanner() {
  return `
    <div class="faucet-banner">
      <span>你有 0 tokens — 領取 100 tokens 開始使用</span>
      <button data-claim-faucet class="btn-primary">領取 Tokens</button>
    </div>
  `;
}

function renderGroupPanel(showFullDetails = true) {
  const g = state.activeGroup;
  if (!g) return '';
  const otherGroups = (state.groups || []).filter((group) => group.id !== g.id);
  const canLeaveGroup = state.member && g.ownerMemberID !== state.member.id;
  const member = state.member || {};
  const claimableProposalTickets = Number(member.claimableProposalTickets || 0);
  const hasClaimableTickets = claimableProposalTickets > 0;
  return `
    <div class="sidebar-card group-panel">
      <div class="label">目前群組</div>
      <div class="group-name">${escapeHtml(g.name)}</div>
      <div class="label">我的票券</div>
      <ul class="group-members-list ticket-list">
        <li>提案券：${Number(member.proposalTicketCount || 0)} 張</li>
      </ul>
      ${otherGroups.length ? `
        <div class="label">切換群組</div>
        <div class="group-switcher-list">
          ${otherGroups.map(group => `
            <button type="button" class="btn-ghost group-switch-button" data-switch-group="${group.id}">
              ${escapeHtml(group.name)}
            </button>
          `).join("")}
        </div>
      ` : ""}
      <div class="label">成員 (${g.members?.length ?? 0})</div>
      <ul class="group-members-list">
        ${(g.members || []).map(m => `<li>${escapeHtml(m.displayName)}</li>`).join('')}
      </ul>
      ${showFullDetails ? `
        <div class="label">我的註冊邀請碼</div>
        <div class="invite-row">
          <code class="invite-code">${escapeHtml(member.registrationInviteCode || "—")}</code>
          <button data-copy-invite="${escapeHtml(member.registrationInviteCode || "")}" class="btn-ghost">複製</button>
        </div>
        <div class="label">待領取獎勵</div>
        <ul class="group-members-list ticket-list">
          <li>提案券：${claimableProposalTickets} 張</li>
        </ul>
        ${hasClaimableTickets ? `<button data-claim-tickets class="btn-primary">Claim</button>` : `<p class="muted-text" style="font-size:12px">目前沒有可領取的票券獎勵。</p>`}
        <div class="label">群組邀請碼</div>
        <div class="invite-row">
          <code class="invite-code">${escapeHtml(g.inviteCode || '—')}</code>
          <button data-copy-invite="${escapeHtml(g.inviteCode || '')}" class="btn-ghost">複製</button>
        </div>
        ${canLeaveGroup
          ? `<button data-leave-group="${g.id}" class="btn-ghost danger-action">退出群組</button>`
          : `<p class="muted-text" style="font-size:12px">群組建立者目前不能直接退出群組。</p>`}
      ` : ""}
    </div>
  `;
}

function renderGroupScreen() {
  return `
    <div class="group-screen-grid">
      <section class="sidebar-card">
        <h3>建立新群組</h3>
        <form id="create-group-form" class="stack-form">
          <div class="form-row">
            <label>群組名稱</label>
            <input name="name" placeholder="例：信義午餐群" required />
          </div>
          <div class="form-row muted-text" style="font-size:12px">
            費用：1 token（目前餘額：${state.member?.tokenBalance ?? 0}）
          </div>
          <button type="submit" class="btn-primary">建立群組 (−1 token)</button>
        </form>
      </section>
      <section class="sidebar-card">
        <h3>加入群組</h3>
        <form id="join-group-form" class="stack-form">
          <div class="form-row">
            <label>邀請碼</label>
            <input name="inviteCode" placeholder="貼上邀請碼" required />
          </div>
          <button type="submit" class="btn-primary">加入群組</button>
        </form>
      </section>
    </div>
    ${state.activeGroup ? `
      <section class="sidebar-card member-dashboard-card">
        <span class="eyebrow">目前群組</span>
        <div class="group-name">${escapeHtml(state.activeGroup.name)}</div>
        ${(state.groups || []).filter((group) => group.id !== state.activeGroup.id).length ? `
          <div class="label">切換群組</div>
          <div class="group-switcher-list">
            ${(state.groups || []).filter((group) => group.id !== state.activeGroup.id).map((group) => `
              <button type="button" class="btn-ghost group-switch-button" data-switch-group="${group.id}">
                ${escapeHtml(group.name)}
              </button>
            `).join("")}
          </div>
        ` : ""}
        <div class="label">成員 (${state.activeGroup.members?.length ?? 0})</div>
        <ul class="group-members-list">
          ${(state.activeGroup.members || []).map((m) => `<li>${escapeHtml(m.displayName)}</li>`).join("")}
        </ul>
        <div class="label">群組邀請碼</div>
        <div class="invite-row">
          <code class="invite-code">${escapeHtml(state.activeGroup.inviteCode || "—")}</code>
          <button data-copy-invite="${escapeHtml(state.activeGroup.inviteCode || "")}" class="btn-ghost">複製</button>
        </div>
        ${state.member && state.activeGroup.ownerMemberID !== state.member.id
          ? `<button data-leave-group="${state.activeGroup.id}" class="btn-ghost danger-action">退出群組</button>`
          : `<p class="muted-text" style="font-size:12px">群組建立者目前不能直接退出群組。</p>`}
      </section>
    ` : ""}
  `;
}

function renderMemberScreen() {
  const member = state.member;
  if (!member) {
    return "";
  }
  const subscriptionActive = Boolean(member.subscriptionActive);
  const expiresLabel = member.subscriptionExpiresAt ? formatClock(member.subscriptionExpiresAt) : "尚未開通";
  return `
    <div class="page-header">
      <h2>會員後台</h2>
      <p class="muted-text">查看個人資訊、月費狀態與群組管理。</p>
    </div>
    <div class="member-dashboard-grid">
      <section class="sidebar-card member-dashboard-card">
        <div class="member-block large member-dashboard-header">
          <img src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(member.displayName)}" />
          <div>
            <strong>${escapeHtml(member.displayName)}</strong>
            <p>${escapeHtml(member.walletAddress || "尚未連結錢包")}</p>
            <small>${member.points} 分 / ${member.tokenBalance} token</small>
          </div>
        </div>
        <div class="member-stat-list">
          <div><span>提案券</span><strong>${Number(member.proposalTicketCount || 0)} 張</strong></div>
          <div><span>待領取獎勵</span><strong>${Number(member.claimableProposalTickets || 0)} 張</strong></div>
          <div><span>註冊邀請碼</span><strong>${escapeHtml(member.registrationInviteCode || "—")}</strong></div>
        </div>
        ${Number(member.claimableProposalTickets || 0) > 0 ? `<button data-claim-tickets class="btn-primary">Claim 票券獎勵</button>` : ""}
      </section>
      <section class="sidebar-card member-dashboard-card">
        <span class="eyebrow">月費管理</span>
        <h3>${subscriptionActive ? "已開通訂閱" : "尚未開通訂閱"}</h3>
        <p class="muted-text">月費為 99 token / 30 天，登入與系統操作都會由後端驗證訂閱狀態。</p>
        <div class="member-stat-list">
          <div><span>訂閱狀態</span><strong>${subscriptionActive ? "有效" : "未開通"}</strong></div>
          <div><span>到期時間</span><strong>${expiresLabel}</strong></div>
        </div>
        <button class="btn-primary" id="subscribe-btn" ${state.subscriptionPending ? "disabled" : ""}>
          ${state.subscriptionPending ? "處理中..." : subscriptionActive ? "續訂 99 Token / 30 天" : "支付 99 Token 開通訂閱"}
        </button>
      </section>
    </div>
    <section class="sidebar-card member-dashboard-card">
      <span class="eyebrow">群組管理</span>
      ${renderGroupScreen()}
    </section>
  `;
}

function renderTabContent(proposal) {
  const tab = state.appTab;
  if (!state.member) {
    return `<div class="page-content">${renderMainSidebar()}</div>`;
  }
  if (tab === "member") {
    return `<div class="page-content full-width">${renderMemberScreen()}</div>`;
  }
  if (tab === "records") {
    return `<div class="page-content full-width">${renderRecordsPage(proposal)}</div>`;
  }
  if (tab === "leaderboard") {
    return `<div class="page-content full-width">${renderLeaderboardPage()}</div>`;
  }
  return `
    <div class="page-content page-two-col">
      <div class="page-main">
        ${renderAppBody(proposal)}
      </div>
      <aside class="page-sidebar">
        ${renderGroupPanel(false)}
        ${renderMemberCompact()}
      </aside>
    </div>
  `;
}

function renderAppPage() {
  const proposal = proposalById(state.activeProposalId);
  app.innerHTML = `
    <div class="app-shell">
      ${renderTopNav()}
      ${state.member && state.member.tokenBalance === 0 ? renderFaucetBanner() : ""}
      ${renderTabContent(proposal)}
    </div>
    ${state.flash ? `<div class="flash-banner">${escapeHtml(state.flash)}</div>` : ""}
    <dialog id="profile-modal"></dialog>
    ${renderDailyLoginRewardDialog()}
  `;
  bindUI();
}

function renderDailyLoginRewardDialog() {
  if (!state.dailyLoginRewardPopupVisible) return "";
  return `
    <div class="daily-reward-toast" role="status" aria-live="polite">
      <div class="daily-reward-toast-copy">
        <span class="eyebrow">每日登入獎勵</span>
        <strong>今日獲得 1 張提案券</strong>
        <p>已加入待領取狀態，前往群組頁面按下 Claim 即可領取。</p>
      </div>
      <button type="button" class="ghost-button" id="close-daily-reward">關閉</button>
    </div>
  `;
}

function renderHeaderActions(isLoginPage = false) {
  return `
    <div class="header-actions">
      <div class="header-wallet">
        <span>Wallet</span>
        <strong>${escapeHtml(state.wallet.account || state.member?.walletAddress || "尚未連接")}</strong>
        <small>${state.wallet.balanceWei !== "0" ? formatEth(state.wallet.balanceWei) : renderHeaderWalletHint(isLoginPage)}</small>
      </div>
      <button class="ghost-button" data-connect-wallet>連結 MetaMask</button>
      ${state.member ? `<button class="ghost-button" data-logout>登出</button>` : ""}
    </div>
  `;
}

function renderHeaderWalletHint(isLoginPage) {
  if (isLoginPage && !state.member) {
    return "可先連接錢包，再登入會員";
  }
  return state.contractInfo ? renderChainMode() : "尚未取得餘額";
}

function renderAppTitle() {
  const labels = {
    records: "紀錄",
    leaderboard: "排行榜",
    member: "會員後台",
    proposal: "提案期",
    voting: "投票期",
    ordering: "點餐期 / 點餐系統",
  };
  return labels[state.appTab] || "MealVote";
}

function renderAppSubtitle() {
  const labels = {
    records: "查看每日勝出店家與消費紀錄。",
    leaderboard: "排行榜與會員成就獨立顯示。",
    member: "查看個人資訊、月費狀態與已加入群組。",
    proposal: "提案期是獨立頁面，建立投票場次與提案店家。",
    voting: "投票期是獨立頁面，進行加權投票。",
    ordering: "點餐期顯示勝出店家菜單與下單。",
  };
  return labels[state.appTab] || "MealVote 工作台";
}

function renderQuickAccessPanel() {
  const cards = [
    { id: "proposal", eyebrow: "Step 1", title: "進入提案期", note: "依時段建立中餐或晚餐投票" },
    { id: "voting", eyebrow: "Step 2", title: "進入投票期", note: "投入 token 做加權投票" },
    { id: "ordering", eyebrow: "Step 3", title: "進入點餐期", note: "查看勝出店家並進入點餐系統" },
    { id: "records", eyebrow: "Support", title: "查看紀錄", note: "每日勝出店家與消費紀錄" },
    { id: "leaderboard", eyebrow: "Support", title: "查看排行榜", note: "看積分、成就與建築" },
  ];
  return `
    <section class="panel quick-access-panel">
      <div class="section-title">
        <span>功能入口</span>
        <small>登入後可從這裡直接進入各個獨立頁面</small>
      </div>
      <div class="quick-access-grid">
        ${cards
          .map(
            (card) => `
              <a class="quick-access-card ${card.id === state.appTab ? "active" : ""}" data-app-tab="${card.id}" href="#${card.id}">
                <span class="eyebrow">${card.eyebrow}</span>
                <strong>${card.title}</strong>
                <small>${card.note}</small>
              </a>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAppBody(proposal) {
  if (!state.member) {
    return `
      <section class="panel auth-page-panel">
        <div class="section-title">
          <span>尚未登入</span>
          <small>先到會員登入頁再進入系統</small>
        </div>
        <a class="ghost-button order-link-button" href="./login.html">前往登入頁</a>
      </section>
    `;
  }

  if (state.appTab === "records") {
    return renderRecordsPage(proposal);
  }
  if (state.appTab === "leaderboard") {
    return renderLeaderboardPage();
  }
  if (state.appTab === "member") {
    return renderMemberScreen();
  }
  if (state.appTab === "proposal") {
    return renderStageStandalonePage(proposal, "proposal");
  }
  if (state.appTab === "voting") {
    return renderStageStandalonePage(proposal, "voting");
  }
  return renderStageStandalonePage(proposal, "ordering");
}

function renderMember(member) {
  const walletLabel = member.walletAddress
    ? `${member.walletAddress.slice(0, 6)}...${member.walletAddress.slice(-4)}`
    : "尚未連接";
  return `
    <div class="member-block">
      <img src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(member.displayName)}" />
      <div>
        <strong>${escapeHtml(member.displayName)}</strong>
        <p>${escapeHtml(walletLabel)}</p>
        <small>${member.points} 分 / ${member.tokenBalance} token</small>
      </div>
    </div>
  `;
}

function renderMemberCompact() {
  if (!state.member) return '';
  const m = state.member;
  return `
    <div class="sidebar-card member-compact">
      <div class="member-compact-row">
        <img src="${escapeHtml(m.avatarUrl)}" alt="${escapeHtml(m.displayName)}" class="member-compact-avatar" />
        <div>
          <strong>${escapeHtml(m.displayName)}</strong>
          <small>${m.points} 分 · ${m.tokenBalance} tok</small>
        </div>
      </div>
      <div class="member-compact-wallet">
        <span class="label">錢包</span>
        <span>${state.wallet.account ? `${state.wallet.account.slice(0,6)}...${state.wallet.account.slice(-4)}` : "尚未連接"}</span>
      </div>
    </div>
  `;
}

function renderMemberSidebar() {
  return `
    <div class="rail-panel">
      <div class="rail-copy">
        <span class="eyebrow">會員中心</span>
        <h3>登入、綁定錢包與查看 token</h3>
        <p>這裡集中處理帳號身份、MetaMask 連線和你目前的點數狀態。</p>
      </div>
      ${state.member ? renderMember(state.member) : renderAuthForms()}
      <div class="wallet-chip">
        <span>Wallet</span>
        <strong>${state.wallet.account || "尚未連接"}</strong>
        <small>${state.wallet.balanceWei !== "0" ? formatEth(state.wallet.balanceWei) : "尚未取得餘額"}</small>
        <small>${renderChainMode()}</small>
      </div>
    </div>
  `;
}

function renderChainMode() {
  if (!state.contractInfo) return "尚未載入合約資訊";
  const hasContracts =
    state.contractInfo.orderContract &&
    state.contractInfo.orderContract.toLowerCase() !== ZERO_ADDRESS &&
    state.contractInfo.tokenContract &&
    state.contractInfo.tokenContract.toLowerCase() !== ZERO_ADDRESS;
  return hasContracts ? "鏈上直送模式已可用" : "目前為 API fallback 模式";
}

function renderAuthForms() {
  return `
    <div class="auth-grid single-auth-grid">
      <div class="auth-col">
        <h3>錢包登入 / 建立會員</h3>
        <form id="wallet-auth-form" class="stack-form" autocomplete="off">
          <input name="displayName" placeholder="第一次建立會員請填顯示名稱" autocomplete="off" />
          <input name="inviteCode" placeholder="註冊邀請碼（選填）" autocomplete="off" />
          <button type="submit" class="btn-primary">
            使用 MetaMask 簽名登入或建立會員
          </button>
        </form>
        <p class="muted-text">系統以 <code>walletAddress</code> 作為唯一會員身份。已註冊過的錢包會直接登入，不會重複建立會員。</p>
      </div>
    </div>
    <div class="auth-wallet-section">
      <div class="auth-divider-horizontal"></div>
      <p class="muted-text">不再使用 email/password。第一次使用會建立會員，之後都透過同一個錢包直接登入。</p>
    </div>
  `;
}

function renderHeroMetrics(proposal) {
  const winner = proposal.options.find((option) => option.id === proposal.winnerOptionId);
  return `
    <div class="metric">
      <span>階段</span>
      <strong>${stageLabel(proposal.status)}</strong>
      <small>${proposal.status === "proposing" ? formatClock(proposal.proposalDeadline) : proposal.status === "voting" ? formatClock(proposal.voteDeadline) : formatClock(proposal.orderDeadline)}</small>
    </div>
    <div class="metric">
      <span>候選店家</span>
      <strong>${proposal.options.length}</strong>
      <small>每位群組成員各可提名一間</small>
    </div>
    <div class="metric">
      <span>目前勝出</span>
      <strong>${winner ? escapeHtml(winner.merchantName) : "待決"}</strong>
      <small>${winner ? `${winner.weightedVotes} weighted votes` : "投票尚未完成"}</small>
    </div>
  `;
}

function renderProposalSwitcher() {
  const proposals = visibleProposals();
  return `
    <div class="proposal-strip">
      ${proposals
        .map(
          (proposal) => `
            <button class="proposal-chip ${proposal.id === state.activeProposalId ? "active" : ""}" data-proposal-id="${proposal.id}">
              <span>${escapeHtml(proposal.title)}</span>
              <small>${proposal.proposalDate || todayInputValue()} · ${mealPeriodLabel(proposal.mealPeriod)} · ${stageLabel(proposal.status)}</small>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCreateProposal() {
  return `<p>目前還沒有提案，先建立一個投票場次。</p>`;
}

function renderStageTabs(activePage) {
  const tabs = [
    { id: "proposal", label: "提案期", note: "建立場次與發起店家選項" },
    { id: "voting", label: "投票期", note: "投入 token 做加權投票" },
    { id: "ordering", label: "點餐期", note: "勝出店家開放全員下單" },
  ];
  return `
    <div class="stage-tabs" role="tablist" aria-label="MealVote stages">
      ${tabs
        .map(
          (tab) => `
            <button class="stage-tab ${tab.id === activePage ? "active" : ""}" data-stage-page="${tab.id}" role="tab" aria-selected="${tab.id === activePage}">
              <span>${tab.label}</span>
              <small>${tab.note}</small>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderStagePage(stagePage, proposal) {
  if (stagePage === "proposal") {
    return renderProposalStagePage(proposal);
  }
  if (stagePage === "voting") {
    return renderVotingStagePage(proposal);
  }
  return renderOrderingStagePage(proposal);
}

function renderEmptyStagePage(stagePage) {
  if (stagePage === "proposal") {
    return `
      <section class="panel stage-page">
        <div class="page-header">
          <div>
            <span class="eyebrow">提案頁面</span>
            <h3>先建立第一個投票場次</h3>
            <p>先建立今日的 proposal round，建立完成後再開始提名候選店家。</p>
          </div>
        </div>
        ${renderCreateProposalForm()}
      </section>
    `;
  }
  return `
    <section class="panel stage-page">
      <div class="page-header">
        <div>
          <span class="eyebrow">${stagePage === "voting" ? "投票頁面" : "點餐頁面"}</span>
          <h3>先建立提案，再進入這個分頁</h3>
          <p>目前沒有可操作的 proposal，請先到提案期頁面建立一個投票場次。</p>
        </div>
      </div>
    </section>
  `;
}

function renderCreateProposalForm() {
  const proposalDate = todayInputValue();
  const mealPeriod = currentMealPeriod();
  const activeProposal = proposingProposalForOrganization(mealPeriod, proposalDate);
  const existingRound = proposalForSelection(mealPeriod, proposalDate);
  if (activeProposal) {
    return renderAddOptionForm(activeProposal);
  }
  if (existingRound) {
    return `
      <div class="result-box">
        ${proposalDate} 的${mealPeriodLabel(mealPeriod)}輪次已經由群組內一位提案者建立。每輪每個群組只會有一位發起者，其他成員請直接在下方補提名店家。
      </div>
    `;
  }
  return `
    <form id="proposal-form" class="stack-form page-form">
      <label>
        提案標題
        <input name="title" type="text" maxlength="60" placeholder="例如：週三晚餐投票" required />
      </label>
      <label>
        本輪餐別
        <input value="${mealPeriodLabel(mealPeriod)}" disabled />
      </label>
      <label>
        本輪日期
        <input value="${proposalDate}" disabled />
      </label>
      <label>
        提名店家時間（分鐘）
        <input name="proposalMinutes" type="number" min="5" max="120" value="30" required />
      </label>
      <label>
        投票時間（分鐘）
        <input name="voteMinutes" type="number" min="5" max="120" value="30" required />
      </label>
      <label>
        點餐時間（分鐘）
        <input name="orderMinutes" type="number" min="5" max="120" value="30" required />
      </label>
      <label>
        提名候選名額
        <input name="maxOptions" type="number" min="3" max="10" value="5" required />
      </label>
      <button type="submit">建立${mealPeriodLabel(mealPeriod)}提案</button>
    </form>
  `;
}

function renderAddOptionForm(activeProposal) {
  const merchants = availableAddOptionMerchants(activeProposal);
  const mealLabel = mealPeriodLabel(activeProposal?.mealPeriod);
  if (!merchants.length) {
    return `
      <div class="result-box">
        目前沒有可提名的 ${mealLabel} 店家，或這輪可用店家都已經被提名過了。
      </div>
    `;
  }
  if (activeProposal && state.member) {
    const alreadyProposed = activeProposal.options.some(
      (opt) => opt.proposerMemberId === state.member.id
    );
    if (alreadyProposed) {
      return `
        <div class="result-box">
          你已經在這輪提案中提交了一個選項，每人每輪只能提名一個店家。
        </div>
      `;
    }
  }
  return `
    <form id="option-form" class="stack-form page-form">
      <label>
        餐別
        <input value="${mealLabel}" disabled />
      </label>
      <label>
        候選剩餘名額
        <input value="${Math.max((activeProposal?.maxOptions || 0) - activeProposal.options.length, 0)} / ${activeProposal?.maxOptions || 0}" disabled />
      </label>
      <label>
        可提案店家
        <select name="merchantId" required>
          ${merchants.map((merchant) => `<option value="${merchant.id}">${merchant.name}</option>`).join("")}
        </select>
      </label>
      <button type="submit">提名${mealLabel}店家</button>
    </form>
  `;
}

function renderPhaseStatus(expectedStatus, proposal) {
  const phaseMatches = {
    proposing: ["proposing"],
    voting: ["voting", "awaiting_finalization"],
    ordering: ["ordering", "awaiting_settlement", "settled"],
  };
  const matches = (phaseMatches[expectedStatus] || [expectedStatus]).includes(proposal.status);
  return `
    <span class="phase-indicator ${matches ? "ready" : "idle"}">
      目前 proposal 狀態：${stageLabel(proposal.status)}
    </span>
  `;
}

function renderProposalOptionRows(proposal) {
  return `
    <div class="option-list">
      ${proposal.options
        .map(
          (option) => `
            <article class="option-row">
              <div>
                <strong>${escapeHtml(option.merchantName)}</strong>
                <p>匿名提案</p>
              </div>
              <div class="option-metrics">
                <span>${option.weightedVotes} 票重</span>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderProposalCandidateCards(proposal) {
  if (!proposal.options.length) {
    return `<div class="result-box">目前這個 proposal 還沒有候選店家，先提名第一間店家。</div>`;
  }
  return `
    <div class="candidate-grid">
      ${proposal.options
        .map(
          (option, index) => `
            <article class="candidate-card">
              <div class="candidate-card-top">
                <span class="candidate-rank">候選 ${String(index + 1).padStart(2, "0")}</span>
                <strong>${escapeHtml(option.merchantName)}</strong>
              </div>
              <p>匿名提案</p>
              <div class="candidate-meta">
                <span>${option.weightedVotes} 票重</span>
                <span>${escapeHtml(option.merchantId)}</span>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderProposalTimeline(proposal) {
  return `
    <div class="proposal-timeline">
      <span>新增候選截止 ${formatClock(proposal.proposalDeadline)}</span>
      <span>投票截止 ${formatClock(proposal.voteDeadline)}</span>
      <span>點餐截止 ${formatClock(proposal.orderDeadline)}</span>
    </div>
  `;
}

function renderAdminControls(proposal) {
  if (!state.member?.isAdmin) return '';
  const actions = {
    proposing: { stage: 'voting',    label: '⚡ 跳到投票階段' },
    voting:    { stage: 'ordering',  label: '⚡ 跳到點餐階段' },
    ordering:  { stage: 'settled',   label: '⚡ 強制結算' },
  };
  const action = actions[proposal.status];
  if (!action) return '';
  return `
    <div class="admin-controls">
      <span class="admin-tag">Admin</span>
      <button data-advance-stage="${proposal.id}" data-stage="${action.stage}" class="btn-admin">
        ${action.label}
      </button>
    </div>
  `;
}

function renderGroupOrderList(proposal) {
  const orders = proposal.orders || [];
  if (orders.length === 0) return '';
  return `
    <div class="group-orders-section">
      <div class="label">所有訂單（${orders.length} 筆）</div>
      ${orders.map(order => `
        <div class="order-row-item">
          <strong>${escapeHtml(order.memberName || '匿名')}</strong>
          <span class="order-status-badge ${order.status}">${formatOrderStatus(order.status)}</span>
          <div class="order-items-mini">
            ${(order.items || []).map(item => `<span>${escapeHtml(item.name)} ×${item.quantity}</span>`).join(' · ')}
          </div>
          <span class="order-amount">${formatEth(order.amountWei)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRewardClaim(proposal) {
  if (proposal.status !== 'settled') return '';
  const myVote = proposal.votes?.find(v => v.memberId === state.member?.id || v.optionId !== undefined);
  // Note: votes are anonymized — we can't determine if THIS user won
  // Show a generic claim button for all settled proposals
  return `
    <div class="reward-claim-section">
      <div class="label">獎勵結算</div>
      <p class="muted-text" style="font-size:13px">提案已結算。若你是投票勝出方，可領取獎勵 tokens。</p>
      <button data-claim-reward="${proposal.id}" class="btn-primary">領取獎勵</button>
    </div>
  `;
}

function renderProposalStagePage(proposal) {
  const selectedProposal = proposalForSelection(activeMealPeriod(), activeProposalDate());
  const activeProposal = proposingProposalForOrganization(activeMealPeriod(), activeProposalDate());
  const isProposalRoundOpen = Boolean(activeProposal);
  const currentMeal = activeProposal?.mealPeriod || selectedProposal?.mealPeriod || proposal?.mealPeriod || activeMealPeriod();
  return `
    ${renderAdminControls(proposal)}
    <section class="panel stage-page proposal-stage-page">
      <div class="page-header">
        <div>
          <span class="eyebrow">提案頁面</span>
          <h3>發起這一輪用餐投票</h3>
          <p>先建立 proposal round，再把符合當前時段的店家加入這一輪候選清單。</p>
        </div>
        ${renderPhaseStatus("proposing", proposal)}
      </div>
      <div class="proposal-stage-layout">
        <section class="proposal-composer">
          <div class="proposal-composer-copy">
            <span class="eyebrow">${isProposalRoundOpen ? "第二步" : "第一步"}</span>
            <h4>${isProposalRoundOpen ? "提名候選店家" : "建立今日投票 round"}</h4>
            <p>${isProposalRoundOpen ? `這一輪 proposal 已建立完成，接下來把 ${mealPeriodLabel(currentMeal)} 候選店家加入清單。` : "提案人可自行輸入標題，並設定提名店家時間、提名候選名額、投票時間與點餐時間；建立完成後，此區會切換成店家提名表單。"}</p>
          </div>
          ${renderCreateProposalForm()}
        </section>
        <aside class="proposal-brief">
          <span class="eyebrow">提案摘要</span>
          <h4>${escapeHtml(proposal.title)}</h4>
          <p>${proposal.proposalDate || todayInputValue()}</p>
          <p>${state.activeGroup ? `群組：<strong>${escapeHtml(state.activeGroup.name)}</strong>` : "尚未加入群組"}</p>
          ${renderProposalTimeline(proposal)}
          <div class="proposal-brief-grid">
            <div class="proposal-stat">
              <span>候選數</span>
              <strong>${proposal.options.length} / ${proposal.maxOptions || "∞"}</strong>
            </div>
            <div class="proposal-stat">
              <span>餐別</span>
              <strong>${mealPeriodLabel(currentMeal)}</strong>
            </div>
          </div>
          <div class="proposal-rules">
            <p>提案規則</p>
            <ul>
              <li>提案標題由提案人自行輸入</li>
              <li>系統會依目前時間自動判定這輪是中餐或晚餐</li>
              <li>每輪每個群組只會有一位發起者</li>
              <li>建立 round 後，群組內每位成員各可再提名一間店家</li>
              <li>提名候選名額需介於 3 到 10 間</li>
            </ul>
          </div>
        </aside>
      </div>
      <section class="candidate-board">
        <div class="candidate-board-head">
          <div>
            <span class="eyebrow">目前候選店家</span>
            <h4>這一輪投票的店家列表</h4>
            <p>店家提名成功後會出現在這裡；提案期結束後，再進到投票期做加權投票。</p>
          </div>
        </div>
        ${renderProposalCandidateCards(proposal)}
        <div class="candidate-list-inline">
          ${renderProposalOptionRows(proposal)}
        </div>
      </section>
      ${state.flash ? `<div class="flash-banner">${escapeHtml(state.flash)}</div>` : ""}
    </section>
  `;
}

function renderVotingStagePage(proposal) {
  const alreadyVoted = Number(proposal.currentVoteOptionId || 0) > 0;
  const myVoteOption = proposal.options.find((option) => option.id === proposal.currentVoteOptionId) || null;
  const totalWeightedVotes = totalVotes(proposal);
  return `
    ${renderAdminControls(proposal)}
    <section class="panel stage-page">
      <div class="page-header">
        <div>
          <span class="eyebrow">投票頁面</span>
          <h3>集中做加權投票</h3>
          <p>從候選店家中選一間投票，設定投入的 Token 數量增加權重，每人每輪只能投一次。</p>
        </div>
        ${renderPhaseStatus("voting", proposal)}
      </div>
      ${renderProposalTimeline(proposal)}
      <div class="result-box">
        目前總票重 <strong>${totalWeightedVotes}</strong>。
        ${alreadyVoted
          ? `你目前投給 <strong>${escapeHtml(myVoteOption?.merchantName || "已選候選")}</strong>，投入 <strong>${proposal.currentVoteTokenAmount || 0}</strong> Token，個人票重 <strong>${proposal.currentVoteWeight || proposal.currentVoteTokenAmount || 0}</strong>。`
          : "你目前還沒有投票。"}
      </div>
      <div class="voting-options-list">
        ${proposal.options.length === 0 ? `<div class="result-box">目前還沒有候選店家。</div>` :
          proposal.options.map((option, index) => `
            <article class="voting-option-card">
              <div class="voting-option-info">
                <strong>${escapeHtml(option.merchantName)}</strong>
                <span class="voting-option-votes">${option.weightedVotes} 票重</span>
              </div>
              ${alreadyVoted ? "" : `
              <div class="voting-option-action">
                <input type="number" min="1" value="10" class="vote-token-input" data-option-index="${index}" placeholder="Token" />
                <button class="btn-primary vote-inline-btn" data-vote-option-index="${index}" data-proposal-id="${proposal.id}">
                  加權投票${chainModeSuffix()}
                </button>
              </div>
              `}
            </article>
          `).join("")}
      </div>
      <div class="note-block">
        <p>投票規則</p>
        <ul>
          <li>每人每輪 proposal 只能投票一次</li>
          <li>可增加投入 Token 數量來提高票重</li>
          <li>投票期結束後才會產生勝出店家</li>
        </ul>
      </div>
    </section>
  `;
}

function renderOrderPanel(proposal) {
  const winner = proposal.options.find((option) => option.id === proposal.winnerOptionId) || null;
  if (!winner) {
    return `<p>等待投票結果真正 finalize 後，才能進入點餐流程。</p>`;
  }
  const myOrder = proposal.orders?.find((order) => order.memberId === state.member?.id);
  if (proposal.status === "awaiting_settlement") {
    return `
      <div class="order-flow">
        ${renderAdminControls(proposal)}
        <div class="winner-banner">
          <span>勝出店家</span>
          <strong>${escapeHtml(winner.merchantName)}</strong>
          <small>點餐時間已結束，等待結算。</small>
        </div>
        ${renderRoundOrderTotals(proposal)}
        <div class="result-box">系統已自動關閉點餐，並會在後端自動完成這一輪的結算與獎勵發放。</div>
        ${state.flash ? `<div class="flash-banner">${escapeHtml(state.flash)}</div>` : ""}
        ${renderMyOrderSnapshot(myOrder)}
        ${renderGroupOrderList(proposal)}
      </div>
    `;
  }
  if (proposal.status === "settled") {
    return `
      <div class="order-flow">
        ${renderAdminControls(proposal)}
        <div class="winner-banner">
          <span>勝出店家</span>
          <strong>${escapeHtml(winner.merchantName)}</strong>
          <small>這一輪已完成結算。</small>
        </div>
        ${renderRoundOrderTotals(proposal)}
        ${state.flash ? `<div class="flash-banner">${escapeHtml(state.flash)}</div>` : ""}
        ${renderMyOrderSnapshot(myOrder)}
        ${renderGroupOrderList(proposal)}
        ${renderRewardClaim(proposal)}
      </div>
    `;
  }
  return `
    <div class="order-flow">
      ${renderAdminControls(proposal)}
      <div class="winner-banner">
        <span>勝出店家</span>
        <strong>${escapeHtml(winner.merchantName)}</strong>
        <small>點餐截止 ${formatClock(proposal.orderDeadline)}</small>
      </div>
      ${renderInlineMenu(proposal, winner)}
      <div class="inline-actions">
        <button type="button" class="ghost-button" id="cancel-order-button">取消我的訂單${chainModeSuffix()}</button>
      </div>
      <div class="result-box">
        點餐會在 ${formatClock(proposal.orderDeadline)} 自動截止。截止後系統會把這一輪已登記的訂單都算進總額，再進入結算階段。
      </div>
      ${state.flash ? `<div class="flash-banner">${escapeHtml(state.flash)}</div>` : ""}
      ${renderMyOrderSnapshot(myOrder)}
      ${renderGroupOrderList(proposal)}
    </div>
  `;
}

function renderInlineMenu(proposal, winner) {
  // Load menu from backend merchant data
  const merchantId = winner.merchantId;
  const menuKey = `_menu_${merchantId}`;
  if (!state[menuKey] && !state[`_menuLoading_${merchantId}`]) {
    state[`_menuLoading_${merchantId}`] = true;
    request(`/merchants/${merchantId}`).then(merchant => {
      state[menuKey] = merchant?.menu || [];
      state[`_menuLoading_${merchantId}`] = false;
      render();
    }).catch(() => {
      state[menuKey] = [];
      state[`_menuLoading_${merchantId}`] = false;
    });
    return `<div class="inline-menu"><p class="muted-text">載入菜單中...</p></div>`;
  }
  const menu = state[menuKey] || [];
  if (menu.length === 0) {
    return `
      <div class="inline-menu">
        <div class="result-box">
          勝出店家目前沒有菜單資料，這一輪暫時不能點餐。
        </div>
      </div>
    `;
  }
  // Use state.selectedItems to track quantities
  if (!state.selectedItems[proposal.id]) state.selectedItems[proposal.id] = {};
  const sel = state.selectedItems[proposal.id];
  const selectedMenuItems = menu
    .map((item) => ({ ...item, quantity: Number(sel[item.id] || 0) }))
    .filter((item) => item.quantity > 0);
  const subtotalWei = selectedMenuItems.reduce((sum, item) => sum + item.priceWei * item.quantity, 0);
  return `
    <div class="inline-menu">
      <span class="eyebrow">菜單 — ${escapeHtml(winner.merchantName)}</span>
      <div class="menu-items-grid">
        ${menu.map(item => {
          const qty = sel[item.id] || 0;
          return `
            <div class="menu-item-card">
              <div class="menu-item-info">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="menu-item-price">${formatPricePair(item.priceWei)}</span>
                ${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}
              </div>
              <div class="menu-item-qty">
                <button class="qty-btn" data-menu-item="${item.id}" data-proposal="${proposal.id}" data-delta="-1">−</button>
                <span class="qty-num">${qty}</span>
                <button class="qty-btn" data-menu-item="${item.id}" data-proposal="${proposal.id}" data-delta="1">＋</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ${renderSelectedItemsSummary(selectedMenuItems, subtotalWei)}
      <button class="btn-primary" id="inline-order-submit" data-proposal-id="${proposal.id}" data-merchant-id="${merchantId}">送出點餐${chainModeSuffix()}</button>
    </div>
  `;
}

function renderSelectedItemsSummary(items, subtotalWei) {
  if (!items.length) {
    return `<div class="result-box">已選餐點會顯示在這裡，並同步列出 ETH 與約略台幣金額。</div>`;
  }
  return `
    <div class="order-summary-card inline-selection-summary">
      <span class="eyebrow">已選餐點</span>
      <div class="order-line-list">
        ${items
          .map(
            (item) => `
              <div class="order-line">
                <span>${escapeHtml(item.name)} x ${item.quantity}</span>
                <strong>${formatPricePair(item.priceWei * item.quantity)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="order-line total">
        <span>目前小計</span>
        <strong>${formatPricePair(subtotalWei)}</strong>
      </div>
    </div>
  `;
}

function renderMyOrderSnapshot(order) {
  if (!state.member) {
    return `<div class="result-box">登入會員後，這裡會顯示你的餐點與費用摘要。</div>`;
  }
  if (state.orderPreview?.quote) {
    return `
      <div class="order-summary-card">
        <span class="eyebrow">我的最新點餐</span>
        <strong>待送出草稿</strong>
        <div class="order-line-list">
          ${state.orderPreview.quote.items
            .map(
              (item) => `
                <div class="order-line">
                  <span>${escapeHtml(item.name)} x ${item.quantity}</span>
                  <strong>${formatPricePair(item.priceWei * item.quantity)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="order-line total">
          <span>小計</span>
          <strong>${formatPricePair(state.orderPreview.quote.subtotalWei)}</strong>
        </div>
        <div class="order-line">
          <span>含 gas 預估準備</span>
          <strong>${formatPricePair(state.orderPreview.quote.requiredBalanceWei)}</strong>
        </div>
      </div>
    `;
  }
  if (!order) {
    return `<div class="result-box">你目前還沒有送出點餐，請直接從上方菜單選餐後送出。</div>`;
  }
  return `
    <div class="order-summary-card">
      <span class="eyebrow">我的已登記點餐</span>
      <strong>${formatOrderStatus(order.status)}</strong>
      <div class="order-line-list">
        ${order.items
          .map(
            (item) => `
              <div class="order-line">
                <span>${escapeHtml(item.name)} x ${item.quantity}</span>
                <strong>${formatPricePair(item.priceWei * item.quantity)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="order-line total">
        <span>總費用</span>
        <strong>${formatPricePair(order.amountWei)}</strong>
      </div>
    </div>
  `;
}

function renderTransactionSidebar(proposal) {
  return `
    <div class="rail-panel">
      <div class="rail-copy">
        <span class="eyebrow">交易追蹤</span>
        <h3>看你的交易現在走到哪一步</h3>
        <p>如果是頁面直接送出的 MetaMask 交易，系統通常會自動記錄；手動送出的交易才需要自己補 txHash。</p>
      </div>
      ${renderTransactionTracker(proposal)}
    </div>
  `;
}

function renderLeaderboardSidebar() {
  return `
    <div class="rail-panel">
      <div class="rail-copy">
        <span class="eyebrow">排行榜</span>
        <h3>積分排行與建築成就</h3>
        <p>點進任一會員即可查看頭像頁與建築系統。</p>
      </div>
      <div class="leaderboard leaderboard-table">
        <div class="leaderboard-header">
          <span class="lb-col-rank">排名</span>
          <span class="lb-col-name">會員</span>
          <span class="lb-col-points">積分</span>
        </div>
        ${state.leaderboard
          .map(
            (entry) => `
              <button class="leader-row" data-profile-id="${entry.memberId}">
                <span class="lb-col-rank">#${entry.rank}</span>
                <span class="lb-col-name">
                  ${entry.avatarUrl ? `<img src="${escapeHtml(entry.avatarUrl)}" class="lb-avatar" />` : ''}
                  ${escapeHtml(entry.displayName)}
                </span>
                <span class="lb-col-points">${entry.points} pts</span>
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderRecordsPage(proposal) {
  const settledProposals = state.proposals
    .filter(p => p.status === "settled" || p.status === "awaiting_settlement")
    .sort((a, b) => new Date(b.createdAt || b.orderDeadline) - new Date(a.createdAt || a.orderDeadline));

  const dailyWinnersHtml = settledProposals.length > 0
    ? settledProposals.map(p => {
        const winner = p.options?.find(o => o.id === p.winnerOptionId);
        const date = formatClock(p.createdAt || p.orderDeadline);
        const myOrder = p.orders?.find(o => o.memberId === state.member?.id);
        return `
          <div class="record-row">
            <div class="record-row-main">
              <span class="record-date">${date}</span>
              <strong>${escapeHtml(p.title)}</strong>
              <span class="status-badge ${p.status === "settled" ? "ended" : "ordering"}">${stageLabel(p.status)}</span>
            </div>
            <div class="record-row-detail">
              <span>勝出：<strong>${winner ? escapeHtml(winner.merchantName) : "待決"}</strong></span>
              <span>候選 ${p.options.length} 家</span>
              <span>訂單 ${(p.orders || []).length} 筆</span>
            </div>
            ${myOrder ? `
              <div class="record-my-order">
                <span class="eyebrow">我的點餐</span>
                <div class="order-items-mini">
                  ${(myOrder.items || []).map(item => `<span>${escapeHtml(item.name)} x${item.quantity}</span>`).join(' · ')}
                </div>
                <span class="order-amount">${formatEth(myOrder.amountWei)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')
    : `<p class="muted-text">尚無結算紀錄。</p>`;

  return `
    <section class="panel page-panel">
      <div class="section-title">
        <span>紀錄</span>
        <small>每日勝出店家與消費紀錄</small>
      </div>
      <div class="records-section">
        <div class="records-winners">
          <span class="eyebrow">歷史紀錄</span>
          ${dailyWinnersHtml}
        </div>
      </div>
      <div class="section-title" style="margin-top:24px">
        <span>使用流水</span>
        <small>提案、提名、投票、點餐、訂閱的消耗與入帳</small>
      </div>
      ${renderUsageLedger()}
      <div class="section-title" style="margin-top:24px">
        <span>交易追蹤</span>
        <small>鏈上交易狀態</small>
      </div>
      ${renderTransactionSidebar(proposal)}
    </section>
  `;
}

function renderTransactionPage(proposal) {
  return renderRecordsPage(proposal);
}

function renderLeaderboardPage() {
  return `
    <section class="panel page-panel">
      <div class="section-title">
        <span>排行榜</span>
        <small>會員積分與建築成就獨立分頁</small>
      </div>
      ${renderLeaderboardSidebar()}
    </section>
  `;
}

function renderStageStandalonePage(proposal, stagePage) {
  if (!state.activeGroupId) {
    return `
      <section class="panel stage-entry-banner">
        <span class="eyebrow">需要先加入群組</span>
        <h3>提案、投票、點餐都以群組為單位</h3>
        <p>先建立群組或加入既有群組，之後才能看到這個群組自己的 proposal、投票與點餐流程。</p>
      </section>
      <section class="panel stage-shell">
        <a class="ghost-button order-link-button" href="#member" data-app-tab="member">前往會員頁</a>
      </section>
    `;
  }
  const titles = {
    proposal: "你現在在提案期",
    voting: "你現在在投票期",
    ordering: "你現在在點餐期 / 點餐系統",
  };
  const notes = {
    proposal: "先建立當輪 proposal round，再替這一輪提名候選店家。",
    voting: "這裡只做加權投票，不再混入提案動作。",
    ordering: "這裡只處理勝出店家的點餐與結算。",
  };
  return `
    <section class="panel stage-entry-banner">
      <span class="eyebrow">目前頁面</span>
      <h3>${titles[stagePage]}</h3>
      <p>${notes[stagePage]}</p>
    </section>
    <section class="panel stage-shell">
      ${renderProposalSwitcher()}
    </section>
    ${proposal ? renderStagePage(stagePage, proposal) : renderEmptyStagePage(stagePage)}
  `;
}

function renderOrderSystemPage(proposal) {
  return `
    <section class="panel page-panel">
      <div class="section-title">
        <span>點餐系統</span>
        <small>獨立標籤頁，會開啟專屬菜單頁</small>
      </div>
      ${renderProposalSwitcher()}
      <div class="order-system-launch">
        ${proposal ? renderOrderPanel(proposal) : `<div class="result-box">目前這個部門尚無可用的 proposal。</div>`}
      </div>
    </section>
  `;
}

function renderOrderingStagePage(proposal) {
  return `
    <section class="panel stage-page">
      <div class="page-header">
        <div>
          <span class="eyebrow">點餐頁面</span>
          <h3>勝出店家菜單與下單</h3>
          <p>投票結果出爐後，直接在此頁選擇餐點並送出訂單。</p>
        </div>
        ${renderPhaseStatus("ordering", proposal)}
      </div>
      ${renderProposalTimeline(proposal)}
      ${renderOrderPanel(proposal)}
    </section>
  `;
}

function renderTransactionTracker(proposal) {
  const pendingTransactions = toArray(state.pendingTransactions);
  return `
    <div class="tracker-guide">
      <div class="tracker-step">
        <strong>1. 送出交易</strong>
        <p>在提案、投票或點餐頁按下 MetaMask 交易。</p>
      </div>
      <div class="tracker-step">
        <strong>2. 等待確認</strong>
        <p>交易會先顯示為 pending，鏈上事件同步後會變成 confirmed。</p>
      </div>
      <div class="tracker-step">
        <strong>3. 手動補登</strong>
        <p>只有你在外部手動送交易時，才需要補貼 txHash。</p>
      </div>
    </div>
    <details class="manual-track">
      <summary>手動登記一筆交易</summary>
      <form id="tx-form" class="stack-form manual-track-form">
        <label>
          交易種類
          <select name="action">
            <option value="create_proposal" ${state.transactionDraft.action === "create_proposal" ? "selected" : ""}>建立提案</option>
            <option value="place_order" ${state.transactionDraft.action === "place_order" ? "selected" : ""}>點餐支付</option>
            <option value="vote" ${state.transactionDraft.action === "vote" ? "selected" : ""}>投票交易</option>
            <option value="add_option" ${state.transactionDraft.action === "add_option" ? "selected" : ""}>新增選項</option>
            <option value="cancel_order" ${state.transactionDraft.action === "cancel_order" ? "selected" : ""}>取消訂單</option>
            <option value="subscribe" ${state.transactionDraft.action === "subscribe" ? "selected" : ""}>月訂閱</option>
          </select>
        </label>
        <label>
          Proposal ID
          <input name="proposalId" type="number" min="0" value="${state.transactionDraft.proposalId || proposal?.id || ""}" placeholder="例如 101" />
        </label>
        <label>
          訂單 hash
          <input name="relatedOrder" value="${state.transactionDraft.relatedOrder || ""}" placeholder="若是點餐，可填 order hash" />
        </label>
        <label>
          交易 hash
          <input name="txHash" value="${state.transactionDraft.txHash || ""}" placeholder="0x... 鏈上交易 hash" />
        </label>
        <button type="submit">登記交易</button>
      </form>
    </details>
    <div class="tx-list">
      ${pendingTransactions.length === 0 ? `<p class="muted-text">尚無交易紀錄</p>` : pendingTransactions.map(renderTransactionRow).join("")}
    </div>
  `;
}

function chainModeSuffix() {
  return canUseDirectChainMode() ? " / MetaMask" : "";
}

function renderTransactionRow(item) {
  return `
    <article class="tx-row ${item.status}">
      <div>
        <strong>${humanizeAction(item.action)}</strong>
        <p>${escapeHtml(item.txHash.slice(0, 10))}...${escapeHtml(item.txHash.slice(-6))}</p>
      </div>
      <div class="tx-meta">
        <span class="status-pill ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
        <small>${escapeHtml(item.relatedEvent || "等待鏈上事件")}</small>
      </div>
    </article>
  `;
}

function renderUsageLedger() {
  const items = toArray(state.usageRecords);
  if (!items.length) {
    return `<div class="result-box muted-text">尚無可顯示的使用紀錄。</div>`;
  }
  return `
    <div class="tx-list usage-list">
      ${items
        .map(
          (item) => `
            <article class="tx-row usage-row ${item.direction}">
              <div>
                <strong>${humanizeAction(item.action)}</strong>
                <p>${escapeHtml(item.note || formatUsageAssetLabel(item.assetType))}</p>
              </div>
              <div class="tx-meta">
                <span class="status-pill ${item.direction}">${item.direction === "credit" ? "入帳" : "支出"}</span>
                <small>${formatUsageAmount(item)} · ${formatClock(item.createdAt)}</small>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function humanizeAction(action) {
  const labels = {
    create_proposal: "建立提案",
    place_order: "點餐支付",
    vote: "投票交易",
    add_option: "新增店家",
    cancel_order: "取消訂單",
    subscribe: "月訂閱",
    settlement_reward: "結算獎勵",
    claim_faucet: "領取 Token",
  };
  return labels[action] || action;
}

function formatUsageAssetLabel(assetType) {
  if (assetType === "token") return "Token";
  if (assetType === "native") return "ETH";
  if (assetType === "proposal_ticket") return "提案券";
  return assetType || "";
}

function formatUsageAmount(item) {
  const prefix = item.direction === "credit" ? "+" : "-";
  if (item.assetType === "native") {
    return `${prefix}${formatPricePair(item.amount)}`;
  }
  if (item.assetType === "proposal_ticket") {
    return `${prefix}${item.amount} 張提案券`;
  }
  return `${prefix}${item.amount} ${formatUsageAssetLabel(item.assetType)}`;
}

function formatOrderStatus(status) {
  if (status === "paid_onchain") return "已上鏈支付";
  if (status === "paid_local") return "已登記點餐";
  if (status === "awaiting_wallet_payment") return "待支付";
  return status || "";
}

function renderRoundOrderTotals(proposal, contextLabel = "本輪訂單統計") {
  const count = Number(proposal?.orderMemberCount || 0);
  const totalWei = proposal?.orderTotalWei || "0";
  return `
    <div class="result-box">
      <strong>${contextLabel}</strong><br />
      共 ${count} 筆訂單，總金額 ${formatPricePair(totalWei)}
    </div>
  `;
}

function bindUI() {
  document.querySelectorAll("[data-connect-wallet]").forEach((button) =>
    button.addEventListener("click", connectWallet)
  );

  document.querySelectorAll("[data-logout]").forEach((button) =>
    button.addEventListener("click", logoutAndRedirect)
  );

  document.querySelectorAll("[data-app-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      setAppTab(button.dataset.appTab);
      if (button.dataset.stagePage) setStagePage(button.dataset.stagePage);
      render();
    })
  );

document.querySelectorAll("[data-rail-page]").forEach((button) =>
    button.addEventListener("click", () => {
      setSidebarPage(button.dataset.railPage);
      render();
    })
  );

  document.querySelector("#wallet-auth-form")?.addEventListener("submit", onWalletAuthenticate);
  document.querySelector("#proposal-form")?.addEventListener("submit", onCreateProposal);
  document.querySelector("#option-form")?.addEventListener("submit", onAddOption);
  document.querySelector("#tx-form")?.addEventListener("submit", onRegisterTransaction);
  document.querySelector("#cancel-order-button")?.addEventListener("click", onCancelOrder);
  document.querySelector("#subscribe-btn")?.addEventListener("click", onSubscribe);

  document.querySelectorAll("[data-stage-page]").forEach((button) =>
    button.addEventListener("click", () => {
      setStagePage(button.dataset.stagePage);
      render();
    })
  );

  document.querySelectorAll("[data-proposal-id]").forEach((button) =>
    button.addEventListener("click", () => {
      const proposalId = Number(button.dataset.proposalId);
      if (!Number.isNaN(proposalId)) {
        state.activeProposalId = proposalId;
        const proposal = proposalById(proposalId);
        if (proposal?.mealPeriod) {
          state.selectedMealPeriod = proposal.mealPeriod;
        }
        if (proposal?.proposalDate) {
          state.selectedProposalDate = proposal.proposalDate;
        }
        render();
      }
    })
  );

  document.querySelectorAll(".vote-inline-btn").forEach((button) =>
    button.addEventListener("click", async () => {
      const optionIndex = Number(button.dataset.voteOptionIndex);
      const proposalId = Number(button.dataset.proposalId);
      const proposal = proposalById(proposalId);
      if (!proposal) return;
      const input = document.querySelector(`.vote-token-input[data-option-index="${optionIndex}"]`);
      const requestedTokenAmount = Number(input?.value || 1);
      const tokenAmount = Number.isFinite(requestedTokenAmount) && requestedTokenAmount > 0 ? requestedTokenAmount : 1;
      button.disabled = true;
      button.textContent = "處理中...";
      try {
        const quote = await request(`/proposals/${proposal.id}/votes/quote`, {
          method: "POST",
          body: JSON.stringify({ tokenAmount }),
        });
        if (!canUseDirectChainProposalMode(proposal)) {
          await request(`/proposals/${proposal.id}/votes`, {
            method: "POST",
            body: JSON.stringify({ optionId: proposal.options[optionIndex]?.id, tokenAmount }),
          });
          await Promise.all([loadSession(), loadProposals(), loadLeaderboard(), loadUsageRecords()]);
          setFlash(`投票已送出，票重 +${quote.voteWeight}。`);
          render();
          return;
        }
        const { parseUnits } = await loadEthers();
        const tokenAmountWei = parseUnits(String(tokenAmount), 18);
        const voting = await getVotingContract();
        const token = await getTokenContract();
        const option = proposal.options[optionIndex];
        if (!hasChainOptionIndex(option)) {
          throw new Error("這個提案選項還沒有鏈上對照資料。");
        }
        await ensureTokenApproval(token, state.wallet.account, state.contractInfo.orderContract, tokenAmountWei);
        const tx = await voting.vote(proposal.chainProposalId, option.chainOptionIndex, tokenAmountWei);
        await registerAndTrackTransaction({
          proposalId: proposal.id,
          action: "vote",
          txHash: tx.hash,
          relatedOrder: "",
        });
        setFlash(`投票交易已送出，票重 +${quote.voteWeight}。等待鏈上確認中。`);
        render();
      } catch (error) {
        setFlash(error?.message || "投票失敗");
        render();
      }
    })
  );

  document.querySelectorAll("[data-profile-id]").forEach((button) =>
    button.addEventListener("click", async () => {
      const profile =
        (await request(`/members/${button.dataset.profileId}/profile`).catch(() => null)) ||
        demoProfiles[Number(button.dataset.profileId)];
      if (!profile) {
        setFlash("目前無法載入會員檔案。");
        render();
        return;
      }
      renderProfile(profile);
    })
  );

  // Create group form
  document.getElementById("create-group-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = formDataFromEvent(e);
    try {
      const group = await createGroup(data.get("name"), "");
      state.activeGroup = group;
      state.activeGroupId = group.id;
      localStorage.setItem(ACTIVE_GROUP_ID_KEY, group.id);
      await loadActiveGroup();
      await Promise.all([loadProposals(), loadUsageRecords()]);
      if (state.member) state.member.tokenBalance -= 1; // decrement after confirmed success
      setFlash(`群組「${escapeHtml(group.name)}」已建立！`);
      render();
    } catch (err) {
      setFlash("建立失敗：" + err.message);
      render();
    }
  });

  // Join group form
  document.getElementById("join-group-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = formDataFromEvent(e);
    try {
      const group = await joinGroup(data.get("inviteCode"));
      state.activeGroup = group;
      state.activeGroupId = group.id;
      localStorage.setItem(ACTIVE_GROUP_ID_KEY, group.id);
      await loadActiveGroup();
      await Promise.all([loadProposals(), loadUsageRecords()]);
      setFlash(`已加入群組「${escapeHtml(group.name)}」！`);
      render();
    } catch (err) {
      setFlash("加入失敗：" + err.message);
      render();
    }
  });

  document.querySelectorAll("[data-switch-group]").forEach((button) =>
    button.addEventListener("click", async () => {
      const groupId = Number(button.dataset.switchGroup);
      if (!groupId) return;
      try {
        localStorage.setItem(ACTIVE_GROUP_ID_KEY, String(groupId));
        await loadActiveGroup();
        await Promise.all([loadProposals(), loadUsageRecords()]);
        setFlash(`已切換到群組「${escapeHtml(state.activeGroup?.name || "")}」`);
        render();
      } catch (error) {
        setFlash(error?.message || "切換群組失敗");
        render();
      }
    })
  );

  // Menu quantity buttons
  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.menuItem;
      const proposalId = btn.dataset.proposal;
      const delta = parseInt(btn.dataset.delta);
      if (!state.selectedItems[proposalId]) state.selectedItems[proposalId] = {};
      const cur = state.selectedItems[proposalId][itemId] || 0;
      state.selectedItems[proposalId][itemId] = Math.max(0, cur + delta);
      render();
    });
  });

  // Inline order submit
  document.getElementById("inline-order-submit")?.addEventListener("click", async () => {
    const btn = document.getElementById("inline-order-submit");
    const proposalId = Number(btn.dataset.proposalId);
    const merchantId = btn.dataset.merchantId;
    const sel = state.selectedItems[proposalId] || {};
    const items = Object.fromEntries(
      Object.entries(sel)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => [id, Number(qty)])
    );
    if (Object.keys(items).length === 0) {
      setFlash("請先選擇至少一項餐點。");
      return;
    }
    try {
      const proposal = proposalById(proposalId);
      const quote = await request("/orders/quote", {
        method: "POST",
        body: JSON.stringify({ proposalId, items }),
      });
      if (state.wallet.account && BigInt(state.wallet.balanceWei || "0") < BigInt(quote.requiredBalanceWei || "0")) {
        setFlash("錢包餘額不足，請先補足餐費與 gas");
        return;
      }
      const signed = await request("/orders/sign", {
        method: "POST",
        body: JSON.stringify({ proposalId, items }),
      });
      state.orderPreview = signed;
      if (!canUseDirectChainProposalMode(proposal)) {
        setFlash("點餐已登記！");
        await Promise.all([loadProposals(), loadPendingTransactions(), loadUsageRecords()]);
        render();
        return;
      }
      const voting = await getVotingContract();
      const tx = await voting.placeOrder(
        proposal.chainProposalId,
        signed.signature.orderHash,
        JSON.stringify(items),
        signed.signature.amountWei,
        signed.signature.expiry,
        signed.signature.signature,
        { value: signed.signature.amountWei }
      );
      await registerAndTrackTransaction({
        proposalId,
        action: "place_order",
        txHash: tx.hash,
        relatedOrder: signed.signature.orderHash,
      });
      setFlash(`點餐交易已送出，txHash: ${tx.hash.slice(0, 10)}...`);
      render();
    } catch (err) {
      setFlash("點餐失敗：" + (err.message || "未知錯誤"));
      render();
    }
  });

  // Delegated listeners bound once per page load
  if (!delegatedListenersBound) {
    delegatedListenersBound = true;

    // Faucet claim
    document.addEventListener("click", async (e) => {
      if (!e.target.closest("[data-claim-faucet]")) return;
      try {
        const res = await claimFaucet();
        if (state.member) state.member.tokenBalance = res.newBalance;
        setFlash(`已領取 100 tokens！現有餘額：${res.newBalance}`);
        render();
      } catch (err) {
        setFlash("領取失敗：" + err.message);
      }
    });

    // Ticket claim
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-claim-tickets]");
      if (!btn) return;
      try {
        const res = await claimTickets();
        state.member = res.member;
        setFlash(`已領取票券：提案券 ${res.claimedProposalTickets || 0} 張`);
        render();
      } catch (err) {
        setFlash("領取票券失敗：" + err.message);
        render();
      }
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#close-daily-reward");
      if (!btn) return;
      hideDailyLoginRewardNotice();
      render();
    });

    // Copy invite code
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-copy-invite]");
      if (!btn) return;
      navigator.clipboard.writeText(btn.dataset.copyInvite);
      setFlash("邀請碼已複製！");
    });

    // Leave group
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-leave-group]");
      if (!btn) return;
      const groupId = Number(btn.dataset.leaveGroup);
      if (!groupId) return;
      try {
        await leaveGroup(groupId);
        const nextGroups = (state.groups || []).filter((group) => group.id !== groupId);
        state.groups = nextGroups;
        if (state.activeGroupId === groupId) {
          if (nextGroups.length > 0) {
            localStorage.setItem(ACTIVE_GROUP_ID_KEY, String(nextGroups[0].id));
          } else {
            localStorage.removeItem(ACTIVE_GROUP_ID_KEY);
          }
          await loadActiveGroup();
          await Promise.all([loadProposals(), loadUsageRecords()]);
        }
        setFlash("已退出群組。");
        render();
      } catch (err) {
        setFlash("退出失敗：" + err.message);
        render();
      }
    });

    // Admin stage-advance
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-advance-stage]");
      if (!btn) return;
      const proposalId = parseInt(btn.dataset.advanceStage);
      const stage = btn.dataset.stage;
      try {
        await advanceProposalStage(proposalId, stage);
        await Promise.all([loadProposals(), loadUsageRecords()]);
        setFlash(`已切換到 ${stage} 階段`);
        render();
      } catch (err) {
        setFlash("切換失敗：" + err.message);
        render();
      }
    });

    // Reward claim
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-claim-reward]");
      if (!btn) return;
      const proposalId = parseInt(btn.dataset.claimReward);
      try {
        const res = await claimReward(proposalId);
        if (state.member) state.member.tokenBalance = res.newBalance ?? state.member.tokenBalance;
        setFlash(`已領取獎勵！`);
        render();
      } catch (err) {
        setFlash("領取失敗：" + err.message);
        render();
      }
    });
  }
}

async function onWalletAuthenticate(event) {
  event.preventDefault();
  try {
    if (!window.ethereum) {
      throw new Error("請先安裝 MetaMask。");
    }
    if (!state.wallet.account) {
      await connectWallet();
    }
    if (!state.wallet.account) {
      throw new Error("請先連結錢包。");
    }

    const form = formDataFromEvent(event);
    const displayName = String(form.get("displayName") || "").trim();
    const inviteCode = String(form.get("inviteCode") || "").trim();
    const challenge = await request("/auth/wallet/challenge", {
      method: "POST",
      body: JSON.stringify({ walletAddress: state.wallet.account }),
    });
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [challenge.message, state.wallet.account],
    });
    const data = await request("/auth/wallet/verify", {
      method: "POST",
      body: JSON.stringify({
        walletAddress: state.wallet.account,
        signature,
        displayName,
        inviteCode,
      }),
    });
    rememberDailyLoginReward(Boolean(data.dailyLoginRewardGranted));
    persistToken(data.token);
    state.member = data.member;
    await loadPendingTransactions();
    if (APP_PAGE === "login") {
      redirectAfterAuth(Boolean(data.dailyLoginRewardGranted));
      return;
    }
    if (!isSubscribed()) {
      window.location.href = "./login.html#subscribe";
      return;
    }
    window.location.href = "./index.html#ordering";
  } catch (error) {
    setFlash(error.message || "錢包簽名登入失敗");
    render();
  }
}

async function onSubscribe() {
  if (!state.member || !state.wallet.account) return;
  state.subscriptionPending = true;
  render();
  try {
    if (canUseDirectChainMode()) {
      const voting = await getVotingContract();
      const token = await getTokenContract();
      const { parseUnits } = await loadEthers();
      const amountWei = parseUnits(String(SUBSCRIPTION_COST), 18);
      await ensureTokenApproval(token, state.wallet.account, state.contractInfo.orderContract, amountWei);
      const tx = await voting.subscribeMonthly();
      await registerAndTrackTransaction({
        proposalId: 0,
        action: "subscribe",
        txHash: tx.hash,
        walletAddress: state.wallet.account || state.member?.walletAddress || "",
        relatedOrder: "",
      });
      setFlash(`訂閱交易已送出，txHash: ${tx.hash.slice(0, 10)}...`);
      state.subscriptionPending = false;
      render();
      return;
    }
    await request("/subscription/pay", {
      method: "POST",
      body: JSON.stringify({ tokenAmount: SUBSCRIPTION_COST }),
    });
    await Promise.all([loadSession(), loadUsageRecords()]);
    setFlash(`訂閱成功！已扣除 ${SUBSCRIPTION_COST} Token。`);
    state.subscriptionPending = false;
    window.location.href = "./index.html#ordering";
  } catch (error) {
    state.subscriptionPending = false;
    setFlash(error?.message || "訂閱付款失敗");
    render();
  }
}

async function onCreateProposal(event) {
  event.preventDefault();
  try {
    const form = formDataFromEvent(event);
    const title = String(form.get("title") || "").trim();
    const mealPeriod = currentMealPeriod();
    const proposalDate = todayInputValue();
    const maxOptions = Number(form.get("maxOptions")) || 5;
    if (!title) {
      throw new Error("請先輸入提案標題。");
    }
    const existingRound = proposalForSelection(mealPeriod, proposalDate);
    if (existingRound) {
      if (existingRound.status === "proposing") {
        throw new Error("這個群組這一輪已經有提案發起者，請改用下方店家提名表單。");
      }
      throw new Error("這個群組這一輪已經有提案發起者。");
    }

    const createdProposal = await request("/proposals", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: "",
        maxOptions,
        proposalMinutes: Number(form.get("proposalMinutes")) || 30,
        voteMinutes: Number(form.get("voteMinutes")) || 30,
        orderMinutes: Number(form.get("orderMinutes")) || 30,
        ...(state.activeGroupId ? { groupId: state.activeGroupId } : {}),
      }),
    });
    state.selectedMealPeriod = mealPeriod;
    state.selectedProposalDate = proposalDate;
    state.activeProposalId = createdProposal?.id || state.activeProposalId;
    await Promise.all([loadProposals(), loadUsageRecords()]);
    const currentProposal = proposalForSelection(mealPeriod, proposalDate) || proposalById(state.activeProposalId);
    if (currentProposal?.id) {
      await refreshProposalByID(currentProposal.id);
    }
    setFlash(`已建立「${title}」，下一步請提名候選店家。`);
    render();
  } catch (error) {
    setFlash(error?.message || "建立提案失敗");
    render();
  }
}

async function onAddOption(event) {
  event.preventDefault();
  try {
    const proposal = proposalById(state.activeProposalId);
    const quote = await request(`/proposals/${proposal.id}/options/quote`, { method: "POST", body: "{}" });
    const form = formDataFromEvent(event);
    const payload = Object.fromEntries(form.entries());
    if (!canUseDirectChainProposalMode(proposal)) {
      await request(`/proposals/${proposal.id}/options`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await Promise.all([refreshProposalByID(proposal.id), loadUsageRecords()]);
      setFlash(`店家選項已送出，消耗 ${quote.tokenCost} token。`);
      render();
      return;
    }

    const voting = await getVotingContract();
    const token = await getTokenContract();
    const { parseUnits } = await loadEthers();
    await ensureTokenApproval(token, state.wallet.account, state.contractInfo.orderContract, parseUnits(String(quote.tokenCost), 18));
    const tx = await voting.addOption(proposal.chainProposalId, payload.merchantId, payload.merchantId);
    await registerAndTrackTransaction({
      proposalId: proposal.id,
      action: "add_option",
      txHash: tx.hash,
      relatedOrder: "",
    });
    setFlash(`已送出新增店家交易，txHash: ${tx.hash.slice(0, 10)}...`);
    render();
  } catch (error) {
    setFlash(error?.message || "發起店家選項失敗");
    render();
  }
}

async function onVote(event) {
  event.preventDefault();
  try {
    const proposal = proposalById(state.activeProposalId);
    const form = formDataFromEvent(event);
    const payload = {
      optionIndex: Number(form.get("optionIndex")),
      tokenAmount: Number(form.get("tokenAmount")) || 1,
    };
    const quote = await request(`/proposals/${proposal.id}/votes/quote`, {
      method: "POST",
      body: JSON.stringify({ tokenAmount: payload.tokenAmount }),
    });
    if (!canUseDirectChainProposalMode(proposal)) {
      await request(`/proposals/${proposal.id}/votes`, {
        method: "POST",
        body: JSON.stringify({ optionId: proposal.options[payload.optionIndex]?.id, tokenAmount: payload.tokenAmount }),
      });
      await Promise.all([loadSession(), loadProposals(), loadLeaderboard(), loadUsageRecords()]);
      setFlash(`投票已送出，票重 +${quote.voteWeight}。`);
      render();
      return;
    }
    const { parseUnits } = await loadEthers();
    const tokenAmountWei = parseUnits(String(payload.tokenAmount), 18);
    const voting = await getVotingContract();
    const token = await getTokenContract();
    const option = proposal.options[payload.optionIndex];
    if (!hasChainOptionIndex(option)) {
      throw new Error("這個提案選項還沒有鏈上對照資料，請先使用後端模式或等待同步完成。");
    }
    await ensureTokenApproval(token, state.wallet.account, state.contractInfo.orderContract, tokenAmountWei);
    const tx = await voting.vote(proposal.chainProposalId, option.chainOptionIndex, tokenAmountWei);
    await registerAndTrackTransaction({
      proposalId: proposal.id,
      action: "vote",
      txHash: tx.hash,
      relatedOrder: "",
    });
    setFlash(`投票交易已送出，票重 +${quote.voteWeight}。等待鏈上確認中。`);
    render();
  } catch (error) {
    setFlash(error?.message || "投票失敗");
    render();
  }
}

async function onOrderSign(event) {
  event.preventDefault();
  if (!state.member) {
    alert("請先登入會員");
    return;
  }
  if (!state.wallet.account) {
    alert("請先連接 MetaMask");
    return;
  }

  const proposal = proposalById(state.activeProposalId);
  const rawItems = formDataFromEvent(event).get("items");
  let items;
  try {
    items = JSON.parse(rawItems);
  } catch {
    alert("菜單格式需為 JSON");
    return;
  }

  const quote = await request("/orders/quote", {
    method: "POST",
    body: JSON.stringify({ proposalId: proposal.id, items }),
  });
  if (BigInt(state.wallet.balanceWei || "0") < BigInt(quote.requiredBalanceWei)) {
    alert("錢包餘額不足，請先補足餐費與 gas");
    return;
  }
  const signed = await request("/orders/sign", {
    method: "POST",
    body: JSON.stringify({ proposalId: proposal.id, items }),
  });
  state.orderPreview = signed;
  state.transactionDraft = {
    action: "place_order",
    txHash: "",
    proposalId: String(proposal.id),
    relatedOrder: signed.signature.orderHash,
  };
  if (!canUseDirectChainProposalMode(proposal)) {
    await Promise.all([loadProposals(), loadUsageRecords()]);
    setFlash("點餐已登記完成。");
    render();
    return;
  }
  const voting = await getVotingContract();
  const tx = await voting.placeOrder(
    proposal.chainProposalId,
    signed.signature.orderHash,
    JSON.stringify(items),
    signed.signature.amountWei,
    signed.signature.expiry,
    signed.signature.signature,
    { value: signed.signature.amountWei }
  );
  await registerAndTrackTransaction({
    proposalId: proposal.id,
    action: "place_order",
    txHash: tx.hash,
    relatedOrder: signed.signature.orderHash,
  });
  setFlash(`點餐交易已送出，txHash: ${tx.hash.slice(0, 10)}...`);
  render();
}

async function onCancelOrder() {
  const proposal = proposalById(state.activeProposalId);
  if (!proposal) return;
  if (!canUseDirectChainProposalMode(proposal)) {
    setFlash("目前這個介面只支援鏈上取消訂單模式。");
    render();
    return;
  }
  const voting = await getVotingContract();
  const tx = await voting.cancelOrder(proposal.chainProposalId);
  await registerAndTrackTransaction({
    proposalId: proposal.id,
    action: "cancel_order",
    txHash: tx.hash,
    walletAddress: state.wallet.account || state.member?.walletAddress || "",
    relatedOrder: state.orderPreview?.signature?.orderHash || "",
  });
  setFlash(`取消訂單交易已送出，txHash: ${tx.hash.slice(0, 10)}...`);
  render();
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("目前瀏覽器沒有 MetaMask");
    return;
  }
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
  const balanceWei = await window.ethereum.request({
    method: "eth_getBalance",
    params: [account, "latest"],
  });
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  state.wallet = { account, balanceWei, chainId };
  if (state.member && !state.member.walletAddress) {
    state.member.walletAddress = account;
  }
  render();
}

async function getVotingContract() {
  const { BrowserProvider, Contract } = await loadEthers();
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(state.contractInfo.orderContract, VOTING_ABI, signer);
}

async function getTokenContract() {
  const { BrowserProvider, Contract } = await loadEthers();
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(state.contractInfo.tokenContract, TOKEN_ABI, signer);
}

async function ensureTokenApproval(tokenContract, owner, spender, requiredAmount) {
  const { MaxUint256 } = await loadEthers();
  const allowance = await tokenContract.allowance(owner, spender);
  if (allowance >= requiredAmount) {
    return;
  }
  const approveTx = await tokenContract.approve(spender, MaxUint256);
  await approveTx.wait();
}

async function loadEthers() {
  if (!ethersLibPromise) {
    ethersLibPromise = import("https://esm.sh/ethers@6.13.2");
  }
  return ethersLibPromise;
}

function canUseDirectChainMode() {
  return Boolean(
    window.ethereum &&
      state.wallet.account &&
      state.contractInfo &&
      isUsableContractAddress(state.contractInfo.orderContract) &&
      isUsableContractAddress(state.contractInfo.tokenContract)
  );
}

function isUsableContractAddress(address) {
  const value = String(address || "").toLowerCase();
  if (!value || value === ZERO_ADDRESS) {
    return false;
  }
  return value !== "0x0000000000000000000000000000000000000001" && value !== "0x0000000000000000000000000000000000000002";
}

async function onRegisterTransaction(event) {
  event.preventDefault();
  if (!state.member) {
    alert("請先登入會員");
    return;
  }
  const form = formDataFromEvent(event);
  const payload = {
    action: form.get("action"),
    txHash: String(form.get("txHash") || "").trim(),
    proposalId: Number(form.get("proposalId") || 0),
    walletAddress: state.wallet.account || state.member.walletAddress || "",
    relatedOrder: String(form.get("relatedOrder") || "").trim(),
  };
  if (!payload.txHash.startsWith("0x")) {
    alert("請輸入有效的 txHash");
    return;
  }
  await registerAndTrackTransaction(payload);
}

function startPendingTransactionPolling() {
  setInterval(async () => {
    const pendingTransactions = toArray(state.pendingTransactions);
    if (!state.token || pendingTransactions.every((item) => item.status !== "pending")) {
      return;
    }
    await refreshPendingTransactions();
  }, 10000);
}

async function refreshPendingTransactions() {
  await loadPendingTransactions();
  const pendingTransactions = toArray(state.pendingTransactions);
  if (pendingTransactions.some((item) => item.status === "confirmed")) {
    await Promise.all([loadSession(), loadProposals(), loadLeaderboard(), loadUsageRecords()]);
    if (APP_PAGE === "login" && isSubscribed()) {
      window.location.href = "./index.html#ordering";
      return;
    }
  }
  render();
}

async function pollTransactionUntilSettled(txHash) {
  const maxRounds = 18;
  for (let round = 0; round < maxRounds; round += 1) {
    const item = await request(`/transactions/${txHash}`).catch(() => null);
    if (!item) {
      return;
    }
    if (item.status !== "pending") {
      await Promise.all([loadPendingTransactions(), loadSession(), loadProposals(), loadLeaderboard(), loadUsageRecords()]);
      if (APP_PAGE === "login" && isSubscribed()) {
        window.location.href = "./index.html#ordering";
        return;
      }
      setFlash(`交易已確認：${humanizeAction(item.action)} / ${item.relatedEvent || item.status}`);
      render();
      return;
    }
    await wait(5000);
  }
  setFlash("交易仍在等待鏈上事件，稍後可在左側交易追蹤繼續查看。");
  render();
}

function setFlash(message) {
  state.flash = message;
  clearTimeout(window.__mealvoteFlashTimer);
  window.__mealvoteFlashTimer = setTimeout(() => {
    state.flash = "";
    render();
  }, 5000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerAndTrackTransaction(payload) {
  await request("/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.transactionDraft.txHash = "";
  await loadPendingTransactions();
  render();
  if (window.ethereum) {
    watchWalletReceipt(payload.txHash);
  }
  pollTransactionUntilSettled(payload.txHash);
}

async function watchWalletReceipt(txHash) {
  try {
    const { BrowserProvider } = await loadEthers();
    const provider = new BrowserProvider(window.ethereum);
    const receipt = await provider.waitForTransaction(txHash);
    if (!receipt) return;
    if (state.member?.isAdmin) {
      await request("/admin/indexer/sync", { method: "POST", body: "{}" }).catch(() => null);
    }
    await refreshPendingTransactions();
  } catch {
    // Let backend polling remain the fallback.
  }
}

function renderProfile(profile) {
  const dialog = document.querySelector("#profile-modal");
  dialog.innerHTML = `
    <div class="profile-dialog">
      <button class="close-button" id="close-profile">關閉</button>
      <div class="member-block large">
        <img src="${escapeHtml(profile.member.avatarUrl)}" alt="${escapeHtml(profile.member.displayName)}" />
        <div>
          <strong>${escapeHtml(profile.member.displayName)}</strong>
          <p>第 ${profile.rank} 名</p>
          <small>${profile.member.points} 分 / ${profile.member.tokenBalance} token</small>
        </div>
      </div>
      <section class="achievement-section">
        <span class="eyebrow">建築成就</span>
        ${profile.buildings
          .map(
            (building) => `
              <article class="building-card level-${building.level}">
                <strong>${escapeHtml(building.name)}</strong>
                <p>Level ${building.level}</p>
                <small>skin: ${escapeHtml(building.skin)}</small>
              </article>
            `
          )
          .join("")}
      </section>
      <section class="achievement-meta">
        <p>提案 ${profile.history.proposalsCreated} 次</p>
        <p>投票 ${profile.history.votesCast} 次</p>
        <p>點餐 ${profile.history.ordersSubmitted} 次</p>
      </section>
    </div>
  `;
  dialog.showModal();
  document.querySelector("#close-profile").addEventListener("click", () => dialog.close());
}

boot().catch((error) => {
  app.innerHTML = `<pre class="result-box">${escapeHtml(error.message)}</pre>`;
});
