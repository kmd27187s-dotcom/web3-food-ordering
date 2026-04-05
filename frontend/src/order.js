const API_BASE_STORAGE_KEY = "mealvote.apiBase";
const storedApiBase = localStorage.getItem(API_BASE_STORAGE_KEY) || "";
const APPROX_TWD_PER_ETH = 120000;
const API_BASE_CANDIDATES = storedApiBase
  ? [storedApiBase]
  : ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const VOTING_ABI = [
  "function placeOrder(uint256 proposalId, bytes32 orderHash, string note, uint256 amount, uint256 expiry, bytes sig) payable",
];

let activeApiBase = API_BASE_CANDIDATES[0];
let ethersLibPromise = null;
let generatedContracts = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const params = new URLSearchParams(window.location.search);
const state = {
  token: localStorage.getItem("mealvote.token") || "",
  proposalId: Number(params.get("proposalId") || 101),
  member: null,
  proposal: null,
  merchant: null,
  contractInfo: null,
  cart: {},
  latestSigned: null,
  flash: "",
  demoMode: false,
  wallet: {
    account: "",
    balanceWei: "0",
    chainId: "",
  },
};

const demoProposal = {
  id: 101,
  title: "信義區午餐局",
  proposalDeadline: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  voteDeadline: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  orderDeadline: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
  status: "ordering",
  winnerOptionId: 1002,
  options: [
    { id: 1001, merchantId: "shop-bento", merchantName: "午間便當室", proposerName: "Alice", weightedVotes: 24 },
    { id: 1002, merchantId: "shop-hotpot", merchantName: "湯潮火鍋", proposerName: "Bob", weightedVotes: 37 },
    { id: 1003, merchantId: "shop-salad", merchantName: "輕禾沙拉所", proposerName: "Carol", weightedVotes: 18 },
  ],
  orders: [],
};

const demoMerchants = {
  "shop-hotpot": {
    id: "shop-hotpot",
    name: "湯潮火鍋",
    group: "taipei-xinyi",
    menu: [
      { id: "hotpot-set", name: "雙人火鍋套餐", priceWei: 4200000000000000, description: "牛五花、蔬菜盤、王子麵" },
      { id: "fish-ball", name: "手工魚餃", priceWei: 900000000000000, description: "單點加料" },
    ],
  },
  "shop-bento": {
    id: "shop-bento",
    name: "午間便當室",
    group: "taipei-xinyi",
    menu: [
      { id: "bento-chicken", name: "鹽烤雞腿便當", priceWei: 1400000000000000, description: "雞腿、三樣配菜、熱湯" },
      { id: "bento-pork", name: "招牌排骨便當", priceWei: 1250000000000000, description: "排骨、三樣配菜、熱湯" },
    ],
  },
  "shop-salad": {
    id: "shop-salad",
    name: "輕禾沙拉所",
    group: "taipei-xinyi",
    menu: [
      { id: "salad-caesar", name: "凱薩雞肉沙拉", priceWei: 1100000000000000, description: "舒肥雞胸與奶香凱薩醬" },
      { id: "salad-yuzu", name: "柚香鮭魚沙拉", priceWei: 1600000000000000, description: "挪威鮭魚、柚香油醋醬" },
    ],
  },
};

const app = document.querySelector("#order-app");

boot().catch((error) => {
  app.innerHTML = `<pre class="result-box">${escapeHtml(error.message)}</pre>`;
});

async function boot() {
  await loadGeneratedContracts();
  await Promise.allSettled([loadSession(), loadProposal(), loadContractInfo()]);
  if (!state.proposal) {
    state.demoMode = true;
    state.proposal = structuredClone(demoProposal);
  }
  const winner = currentWinner();
  if (winner?.merchantId) {
    await loadMerchant(winner.merchantId).catch(() => {
      state.demoMode = true;
      state.merchant = structuredClone(demoMerchants[winner.merchantId]);
    });
  }
  render();
}

async function loadGeneratedContracts() {
  try {
    const response = await fetch("./src/generated/contracts.json");
    if (!response.ok) return;
    generatedContracts = await response.json();
  } catch {
    generatedContracts = null;
  }
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const candidates = [activeApiBase, ...API_BASE_CANDIDATES.filter((base) => base !== activeApiBase)];
  let lastError = null;

  for (const base of candidates) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${base}${path}`, { ...options, headers, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
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

async function loadSession() {
  if (!state.token) return;
  try {
    state.member = await request("/members/me");
  } catch {
    state.token = "";
    localStorage.removeItem("mealvote.token");
  }
}

async function loadProposal() {
  state.proposal = await request(`/proposals/${state.proposalId}`);
}

async function loadMerchant(merchantId) {
  state.merchant = await request(`/merchants/${merchantId}`);
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

function currentWinner() {
  return state.proposal?.options?.find((option) => option.id === state.proposal.winnerOptionId) || null;
}

function hasChainProposalId(proposal) {
  return typeof proposal?.chainProposalId === "number" && Number.isInteger(proposal.chainProposalId) && proposal.chainProposalId >= 0;
}

function cartEntries() {
  if (!state.merchant?.menu) return [];
  return state.merchant.menu
    .map((item) => ({ ...item, quantity: Number(state.cart[item.id] || 0) }))
    .filter((item) => item.quantity > 0);
}

function cartPayload() {
  return Object.fromEntries(cartEntries().map((item) => [item.id, item.quantity]));
}

function cartSubtotalWei() {
  return cartEntries().reduce((total, item) => total + BigInt(item.priceWei) * BigInt(item.quantity), 0n);
}

function myExistingOrder() {
  if (!state.member || !state.proposal?.orders) return null;
  return state.proposal.orders.find((order) => order.memberId === state.member.id) || null;
}

function renderRoundOrderTotals() {
  const count = Number(state.proposal?.orderMemberCount || 0);
  const totalWei = state.proposal?.orderTotalWei || "0";
  return `
    <div class="order-summary-card">
      <span class="eyebrow">本輪群組訂單統計</span>
      <div class="order-line total">
        <span>訂單筆數</span>
        <strong>${count} 筆</strong>
      </div>
      <div class="order-line">
        <span>總金額</span>
        <strong>${formatPricePair(totalWei)}</strong>
      </div>
    </div>
  `;
}

function renderGroupOrderList() {
  const orders = state.proposal?.orders || [];
  if (orders.length === 0) return "";
  return `
    <div class="order-summary-card">
      <span class="eyebrow">本輪所有已登記訂單</span>
      <strong>會顯示訂購人名字</strong>
      <div class="order-line-list">
        ${orders
          .map(
            (order) => `
              <div class="order-line" style="display:block">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
                  <span>${escapeHtml(order.memberName || "匿名會員")}</span>
                  <strong>${formatOrderStatus(order.status)}</strong>
                </div>
                <div style="margin-top:6px;color:#7a6654">
                  ${(order.items || []).map((item) => `${escapeHtml(item.name)} x ${item.quantity}`).join(" · ")}
                </div>
                <div style="margin-top:4px;font-weight:700">${formatPricePair(order.amountWei)}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function render() {
  const winner = currentWinner();
  const subtotal = cartSubtotalWei();
  const existingOrder = myExistingOrder();
  const orderingClosed = state.proposal?.status !== "ordering";
  app.innerHTML = `
    <div class="order-page-shell">
      <header class="order-page-top">
        <a class="ghost-button" href="./index.html#ordering">回主頁</a>
        <div class="top-actions">
          ${state.demoMode ? `<small class="demo-tag">Demo data mode</small>` : ""}
          <button class="ghost-button" id="connect-wallet">連結 MetaMask</button>
        </div>
      </header>
      <section class="hero order-hero">
        <div class="hero-copy">
          <span class="eyebrow">點餐頁</span>
          <h2>${escapeHtml(state.merchant?.name || winner?.merchantName || "尚未選出店家")}</h2>
          <p>這一頁只顯示你的菜單選擇、你的費用摘要，以及送出支付前需要確認的資訊。</p>
        </div>
        <div class="hero-grid">
          <div class="metric">
            <span>Proposal</span>
            <strong>#${state.proposal?.id || state.proposalId}</strong>
            <small>${escapeHtml(state.proposal?.title || "點餐流程")}</small>
          </div>
          <div class="metric">
            <span>點餐截止</span>
            <strong>${formatClock(state.proposal?.orderDeadline)}</strong>
            <small>${orderingClosed ? "點餐已截止，等待結算" : "只開放點自己的餐"}</small>
          </div>
          <div class="metric">
            <span>Wallet</span>
            <strong>${state.wallet.account ? shortenHash(state.wallet.account) : "尚未連接"}</strong>
            <small>${state.wallet.balanceWei !== "0" ? formatEth(state.wallet.balanceWei) : "尚未取得餘額"}</small>
          </div>
        </div>
      </section>
      ${state.flash ? `<div class="flash-banner">${escapeHtml(state.flash)}</div>` : ""}
      <div class="order-layout">
        <section class="panel order-menu-panel">
          <div class="section-title">
            <span>店家菜單</span>
            <small>${state.member ? `會員：${escapeHtml(state.member.displayName)}` : "請先回主頁登入會員"}</small>
          </div>
          ${state.merchant && (!state.merchant.menu || state.merchant.menu.length === 0)
            ? `<div class="result-box">勝出店家目前沒有菜單資料，這一輪暫時不能點餐。</div>`
            : ""}
          <div class="menu-grid">
            ${(state.merchant?.menu || [])
              .map(
                (item) => `
                  <article class="menu-card">
                    <div class="menu-copy">
                      <strong>${escapeHtml(item.name)}</strong>
                      <p>${escapeHtml(item.description || "")}</p>
                      <small>${formatPricePair(item.priceWei)}</small>
                    </div>
                    <div class="qty-control">
                      <button type="button" class="ghost-button qty-button" data-qty-dec="${item.id}">-</button>
                      <input type="number" min="0" value="${state.cart[item.id] || 0}" data-qty-item="${item.id}" />
                      <button type="button" class="ghost-button qty-button" data-qty-inc="${item.id}">+</button>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
        <aside class="panel order-summary-panel">
          <div class="section-title">
            <span>我的餐點與費用</span>
            <small>會同步顯示這一輪群組名單與總金額</small>
          </div>
          <div class="summary-card">
            ${renderCartSummary()}
            <div class="order-line total">
              <span>目前小計</span>
              <strong>${formatPricePair(subtotal)}</strong>
            </div>
            <div class="note-block">
              <p>送出前檢查</p>
              <ul>
                <li>MetaMask 是否連上正確鏈</li>
                <li>錢包餘額是否足夠支付餐費與 gas</li>
                <li>若勝出店家沒有菜單，將不能點餐</li>
                <li>只會對你目前選取的餐點做簽名與支付</li>
                <li>點餐時間到會自動關閉，已登記訂單都會算進本輪總額</li>
              </ul>
            </div>
            <button type="button" id="submit-order" ${cartEntries().length === 0 || !state.merchant?.menu?.length || orderingClosed ? "disabled" : ""}>確認餐點並支付${chainModeSuffix()}</button>
          </div>
          ${orderingClosed ? `<div class="result-box">點餐已自動關閉。系統正在使用這一輪已登記的訂單計算群組總金額，並會在後端自動完成結算。</div>` : ""}
          ${renderRoundOrderTotals()}
          ${renderExistingOrder(existingOrder)}
          ${renderSignedPreview()}
          ${renderGroupOrderList()}
        </aside>
      </div>
    </div>
  `;

  bindUI();
}

function renderCartSummary() {
  const items = cartEntries();
  if (items.length === 0) {
    return `<p class="muted-text">尚未選擇任何餐點。</p>`;
  }
  return `
    <div class="order-line-list">
      ${items
        .map(
          (item) => `
            <div class="order-line">
              <span>${escapeHtml(item.name)} x ${item.quantity}</span>
              <strong>${formatPricePair(BigInt(item.priceWei) * BigInt(item.quantity))}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderExistingOrder(order) {
  if (!order) return "";
  return `
    <div class="order-summary-card">
      <span class="eyebrow">我已送出的訂單</span>
      <strong>${formatOrderStatus(order.status)}</strong>
      <div class="order-line-list">
        ${order.items
          .map(
            (item) => `
              <div class="order-line">
                <span>${escapeHtml(item.name)} x ${item.quantity}</span>
                <strong>${formatEth(BigInt(item.priceWei) * BigInt(item.quantity))}</strong>
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

function renderSignedPreview() {
  if (!state.latestSigned?.quote) return "";
  return `
    <div class="order-summary-card">
      <span class="eyebrow">本次待支付摘要</span>
      <strong>簽名已建立</strong>
      <div class="order-line-list">
        ${state.latestSigned.quote.items
          .map(
            (item) => `
              <div class="order-line">
                <span>${escapeHtml(item.name)} x ${item.quantity}</span>
                <strong>${formatPricePair(BigInt(item.priceWei) * BigInt(item.quantity))}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="order-line total">
        <span>小計</span>
        <strong>${formatPricePair(state.latestSigned.quote.subtotalWei)}</strong>
      </div>
      <div class="order-line">
        <span>含 gas 預估準備</span>
        <strong>${formatPricePair(state.latestSigned.quote.requiredBalanceWei)}</strong>
      </div>
    </div>
  `;
}

function bindUI() {
  document.querySelector("#connect-wallet")?.addEventListener("click", connectWallet);
  document.querySelector("#submit-order")?.addEventListener("click", submitOrder);
  document.querySelectorAll("[data-qty-inc]").forEach((button) =>
    button.addEventListener("click", () => updateQuantity(button.dataset.qtyInc, 1))
  );
  document.querySelectorAll("[data-qty-dec]").forEach((button) =>
    button.addEventListener("click", () => updateQuantity(button.dataset.qtyDec, -1))
  );
  document.querySelectorAll("[data-qty-item]").forEach((input) =>
    input.addEventListener("input", () => {
      const next = Math.max(0, Number(input.value || 0));
      state.cart[input.dataset.qtyItem] = next;
      render();
    })
  );
}

function updateQuantity(itemId, delta) {
  const current = Number(state.cart[itemId] || 0);
  state.cart[itemId] = Math.max(0, current + delta);
  render();
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("目前瀏覽器沒有 MetaMask");
    return;
  }
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
  const balanceWei = await window.ethereum.request({ method: "eth_getBalance", params: [account, "latest"] });
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  state.wallet = { account, balanceWei, chainId };
  render();
}

async function submitOrder() {
  if (!state.member) {
    alert("請先回主頁登入會員");
    return;
  }
  if (!state.wallet.account) {
    alert("請先連接 MetaMask");
    return;
  }
  const items = cartPayload();
  if (Object.keys(items).length === 0) {
    alert("請先選擇餐點");
    return;
  }
  if (!currentWinner()) {
    state.flash = "勝出店家尚未 finalize，暫時不能點餐。";
    render();
    return;
  }

  const quote = await request("/orders/quote", {
    method: "POST",
    body: JSON.stringify({ proposalId: state.proposal.id, items }),
  });
  if (BigInt(state.wallet.balanceWei || "0") < BigInt(quote.requiredBalanceWei)) {
    state.flash = "錢包餘額不足，請先補足餐費與 gas。";
    render();
    return;
  }
  const signed = await request("/orders/sign", {
    method: "POST",
    body: JSON.stringify({ proposalId: state.proposal.id, items }),
  });
  state.latestSigned = signed;

  if (!canUseDirectChainProposalMode()) {
    await loadProposal().catch(() => null);
    state.flash = "點餐已登記完成。";
    render();
    return;
  }

  const voting = await getVotingContract();
  const tx = await voting.placeOrder(
    state.proposal.chainProposalId,
    signed.signature.orderHash,
    JSON.stringify(items),
    signed.signature.amountWei,
    signed.signature.expiry,
    signed.signature.signature,
    { value: signed.signature.amountWei }
  );

  await request("/transactions", {
    method: "POST",
    body: JSON.stringify({
      proposalId: state.proposal.id,
      action: "place_order",
      txHash: tx.hash,
      walletAddress: state.wallet.account || state.member.walletAddress || "",
      relatedOrder: signed.signature.orderHash,
    }),
  }).catch(() => null);

  state.flash = `點餐交易已送出，txHash: ${shortenHash(tx.hash)}`;
  render();
  watchWalletReceipt(tx.hash);
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
    await loadProposal().catch(() => null);
    state.flash = `交易已確認：${shortenHash(txHash)}`;
    render();
  } catch {
    // keep UI stable if wallet receipt watching fails
  }
}

async function getVotingContract() {
  const { BrowserProvider, Contract } = await loadEthers();
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new Contract(state.contractInfo.orderContract, VOTING_ABI, signer);
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
      state.contractInfo.orderContract &&
      state.contractInfo.orderContract.toLowerCase() !== ZERO_ADDRESS
  );
}

function canUseDirectChainProposalMode() {
  return canUseDirectChainMode() && hasChainProposalId(state.proposal);
}

function chainModeSuffix() {
  return canUseDirectChainProposalMode() ? " / MetaMask" : "";
}

function formatOrderStatus(status) {
  if (status === "paid_onchain") return "已上鏈支付";
  if (status === "paid_local") return "已登記點餐";
  if (status === "awaiting_wallet_payment") return "待支付";
  return status || "";
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

function shortenHash(value) {
  if (!value) return "";
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
