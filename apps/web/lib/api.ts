export type Member = {
  id: number;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;
  registrationInviteCode?: string;
  isAdmin?: boolean;
  points: number;
  tokenBalance: number;
  proposalTicketCount: number;
  voteTicketCount: number;
  createOrderTicketCount: number;
  claimableProposalTickets: number;
  claimableVoteTickets: number;
  claimableCreateOrderTickets: number;
  subscriptionActive: boolean;
  subscriptionExpiresAt?: string;
};

export type GroupMember = {
  memberId: number;
  displayName: string;
  walletAddress?: string;
  points?: number;
  joinedAt: string;
};

export type Group = {
  id: number;
  name: string;
  description?: string;
  ownerMemberId: number;
  createdAt: string;
  inviteCode?: string;
  members?: GroupMember[];
};

export type RegistrationInviteUsage = {
  id: number;
  inviteCode: string;
  inviterMemberId: number;
  inviterName: string;
  usedByMemberId: number;
  usedByName: string;
  usedAt: string;
};

export type GroupInviteUsage = {
  id: number;
  groupId: number;
  inviteCode: string;
  usedByMemberId: number;
  usedByName: string;
  usedAt: string;
};

export type MemberProfile = {
  member: Member;
  rank: number;
  history: Record<string, number>;
  stats: Record<string, number>;
  groups?: Group[];
};

export type GroupMemberDetail = {
  memberId: number;
  displayName: string;
  walletAddress?: string;
  points: number;
  tokenBalance: number;
  joinedAt: string;
  ordersSubmitted: number;
  votesCast: number;
  proposalsCreated: number;
  merchantReviews: number;
  recentOrders: Order[];
  profile?: MemberProfile;
};

export type GroupDetail = {
  group: Group;
  memberCount: number;
  members: GroupMemberDetail[];
  canManage: boolean;
  inviteUsages?: GroupInviteUsage[];
};

export type MenuItem = {
  id: string;
  name: string;
  priceWei: number;
  description: string;
};

export type Merchant = {
  id: string;
  name: string;
  group: string;
  address: string;
  description: string;
  payoutAddress: string;
  averageRating?: number;
  reviewCount?: number;
  delistRequestedAt?: string;
  delistedAt?: string;
  ownerMemberId?: number;
  ownerDisplayName?: string;
  menu: MenuItem[];
};

export type MerchantReview = {
  id: number;
  merchantId: string;
  memberId: number;
  memberName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type MerchantDetail = {
  merchant: Merchant;
  reviews: MerchantReview[];
};

export type ProposalOption = {
  id: number;
  merchantId: string;
  merchantName: string;
  proposerMemberId: number;
  weightedVotes: number;
  tokenStake: number;
};

export type OrderItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  priceWei: number;
};

export type Order = {
  id: number;
  proposalId: number;
  title?: string;
  memberId: number;
  memberName: string;
  merchantId: string;
  merchantName?: string;
  merchantPayoutAddress?: string;
  orderHash: string;
  amountWei: string;
  status: string;
  items: OrderItem[];
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  confirmedAt?: string;
  paidOutAt?: string;
};

export type Proposal = {
  id: number;
  chainProposalId?: number | null;
  title: string;
  description: string;
  merchantGroup: string;
  mealPeriod: string;
  proposalDate: string;
  maxOptions: number;
  groupId: number;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  proposalDeadline: string;
  voteDeadline: string;
  orderDeadline: string;
  status: string;
  winnerOptionId: number;
  orderTotalWei: string;
  orderMemberCount: number;
  currentVoteOptionId: number;
  currentVoteTokenAmount: number;
  currentVoteWeight: number;
  options: ProposalOption[];
  votes?: VoteRecord[];
  orders: Order[];
};

export type VoteRecord = {
  memberId: number;
  memberName: string;
  optionId: number;
  tokenAmount: number;
  voteWeight: number;
  submittedAt: string;
  walletHidden?: boolean;
};

export type VoteQuote = {
  tokenAmount: number;
  voteWeight: number;
};

export type OrderQuote = {
  proposalId: number;
  merchantId: string;
  merchantName: string;
  items: OrderItem[];
  subtotalWei: string;
  estimatedGasWei: string;
  requiredBalanceWei: string;
};

export type OrderSignResponse = {
  quote: OrderQuote;
  signature?: {
    amountWei: string;
    expiry: number;
    orderHash: string;
    signature: string;
    digest: string;
    signerAddress: string;
    contractAddress: string;
    tokenAddress: string;
  };
};

export type ContractInfo = {
  chainId: number;
  orderContract: string;
  tokenContract: string;
  platformTreasury: string;
  signerAddress: string;
};

export type LeaderboardEntry = {
  rank: number;
  memberId: number;
  displayName: string;
  avatarUrl?: string;
  points: number;
  tokenBalance: number;
  buildingName: string;
};

export type WalletChallenge = {
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: string;
};

export type WalletVerifyResponse = {
  token: string;
  member: Member;
  created: boolean;
  dailyLoginRewardGranted: boolean;
};

export type PasswordLoginResponse = {
  token: string;
  member: Member;
};

export type MenuChangeRequest = {
  id: number;
  merchantId: string;
  menuItemId: string;
  action: string;
  status: string;
  itemName: string;
  priceWei: number;
  description: string;
  requestedByMember: number;
  requestedByName: string;
  reviewedByMember?: number;
  reviewedByName?: string;
  reviewNote?: string;
  effectiveAt?: string;
  createdAt: string;
  reviewedAt?: string;
};

export type MerchantDashboard = {
  merchant: Merchant | null;
  orders: Order[];
  menuChangeRequests: MenuChangeRequest[];
  acceptedOrderCount: number;
  pendingOrderCount: number;
  completedOrderCount: number;
  totalOrderCount: number;
  totalRevenueWei: string;
};

export type MerchantDelistRequest = {
  merchantId: string;
  merchantName: string;
  ownerMemberId: number;
  ownerDisplayName: string;
  payoutAddress: string;
  requestedAt: string;
  reviewedAt?: string;
  decision?: string;
  currentlyDelisted: boolean;
};

export type ReadyPayoutOrder = {
  orderId: number;
  proposalId: number;
  memberName: string;
  merchantId: string;
  merchantName: string;
  merchantPayoutAddress: string;
  amountWei: string;
  status: string;
  createdAt: string;
};

export type AdminDashboard = {
  memberCount: number;
  groupCount: number;
  merchantCount: number;
  orderCount: number;
  dinerCount: number;
  totalServings: number;
  pendingMenuReviews: number;
  pendingMerchantDelists: number;
  platformTreasury: string;
  menuChangeRequests: MenuChangeRequest[];
  merchantDelistRequests: MerchantDelistRequest[];
  readyPayoutOrders: ReadyPayoutOrder[];
};

export type AdminMemberSummary = {
  id: number;
  displayName: string;
  email: string;
  walletAddress?: string;
  isAdmin: boolean;
  subscriptionActive: boolean;
  tokenBalance: number;
  points: number;
  createdAt: string;
};

export type AdminGroupSummary = {
  id: number;
  name: string;
  description?: string;
  ownerMemberId: number;
  ownerDisplayName: string;
  memberCount: number;
  createdAt: string;
};

export type AdminInsights = {
  groups: AdminGroupSummary[];
  members: AdminMemberSummary[];
  merchants: Merchant[];
  orders: Order[];
};

export type UsageRecord = {
  id: number;
  memberId: number;
  proposalId?: number;
  action: string;
  assetType: string;
  direction: string;
  amount: string;
  note?: string;
  reference?: string;
  createdAt: string;
};

export type MemberOrderHistory = {
  orders: Order[];
};

const TOKEN_KEY = "mealvote.token";
const LEGACY_TOKEN_KEY = "mealvote.token.local";

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
}

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  const legacyToken = window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken && !window.sessionStorage.getItem(TOKEN_KEY)) {
    window.sessionStorage.setItem(TOKEN_KEY, legacyToken);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
  return window.sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  if (token) {
    window.sessionStorage.setItem(TOKEN_KEY, token);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    return;
  }
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearStoredToken() {
  setStoredToken("");
}

type RequestInitExtra = RequestInit & {
  auth?: boolean;
};

export async function apiRequest<T>(path: string, init: RequestInitExtra = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (init.auth) {
    const token = getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }
  return data as T;
}

export async function fetchMe() {
  return apiRequest<Member>("/members/me", { auth: true });
}

export async function fetchContractInfo() {
  return apiRequest<ContractInfo>("/contract");
}

export async function fetchLeaderboard() {
  return apiRequest<LeaderboardEntry[]>("/leaderboard");
}

export async function fetchGroups() {
  return apiRequest<Group[]>("/groups", { auth: true });
}

export async function fetchGroup(groupId: number) {
  return apiRequest<Group>(`/groups/${groupId}`, { auth: true });
}

export async function fetchGroupDetail(groupId: number) {
  return apiRequest<GroupDetail>(`/groups/${groupId}/detail`, { auth: true });
}

export async function fetchMerchants() {
  const merchants = await apiRequest<Merchant[]>("/merchants");
  return merchants.map(normalizeMerchant);
}

export async function fetchMerchantDetail(merchantId: string) {
  const detail = await apiRequest<MerchantDetail>(`/merchants/${merchantId}/detail`);
  return { ...detail, merchant: normalizeMerchant(detail.merchant) };
}

export async function createMerchantReview(merchantId: string, payload: { rating: number; comment: string }) {
  return apiRequest<MerchantReview>(`/merchants/${merchantId}/reviews`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function fetchUsage(limit = 40) {
  return apiRequest<UsageRecord[]>(`/members/me/usage?limit=${limit}`, { auth: true });
}

export async function fetchMemberProfile(memberId: number) {
  return apiRequest<MemberProfile>(`/members/${memberId}/profile`);
}

export async function fetchMyOrderHistory() {
  return apiRequest<MemberOrderHistory>("/members/me/orders", { auth: true });
}

export async function fetchProposals() {
  return apiRequest<Proposal[]>("/proposals", { auth: true });
}

export async function fetchProposal(proposalId: number) {
  return apiRequest<Proposal>(`/proposals/${proposalId}`, { auth: true });
}

export async function createProposal(payload: {
  title: string;
  description?: string;
  maxOptions: number;
  merchantId?: string;
  proposalMinutes: number;
  voteMinutes: number;
  orderMinutes: number;
  groupId: number;
  useCreateOrderTicket?: boolean;
}) {
  return apiRequest<Proposal>("/proposals", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function deleteProposal(proposalId: number) {
  return apiRequest<{ success: boolean; proposalId: number }>(`/proposals/${proposalId}`, {
    method: "DELETE",
    auth: true
  });
}

export async function addProposalOption(proposalId: number, merchantId: string, useProposalTicket = false) {
  return apiRequest<ProposalOption>(`/proposals/${proposalId}/options`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ merchantId, useProposalTicket })
  });
}

export async function quoteVote(proposalId: number, tokenAmount: number) {
  return apiRequest<VoteQuote>(`/proposals/${proposalId}/votes/quote`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ tokenAmount })
  });
}

export async function voteProposal(proposalId: number, optionId: number, tokenAmount: number, useVoteTicket = false) {
  return apiRequest<Proposal>(`/proposals/${proposalId}/votes`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ optionId, tokenAmount, useVoteTicket })
  });
}

export async function fetchMerchant(merchantId: string) {
  const merchant = await apiRequest<Merchant>(`/merchants/${merchantId}`);
  return normalizeMerchant(merchant);
}

export async function quoteOrder(proposalId: number, items: Record<string, number>) {
  return apiRequest<OrderQuote>("/orders/quote", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ proposalId, items })
  });
}

export async function signOrder(proposalId: number, items: Record<string, number>) {
  return apiRequest<OrderSignResponse>("/orders/sign", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ proposalId, items })
  });
}

export async function finalizeOrder(payload: {
  proposalId: number;
  items: Record<string, number>;
  signature?: OrderSignResponse["signature"];
}) {
  return apiRequest<Order>("/orders/finalize", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function registerPendingTransaction(payload: {
  proposalId: number;
  action: string;
  txHash: string;
  walletAddress?: string;
  relatedOrder?: string;
}) {
  return apiRequest<{ id: number; txHash: string; status: string }>("/transactions", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function createGroup(name: string) {
  return apiRequest<Group>("/groups", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ name, description: "" })
  });
}

export async function updateGroup(groupId: number, payload: { name: string; description: string }) {
  return apiRequest<Group>(`/groups/${groupId}`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function createGroupInvite(groupId: number) {
  return apiRequest<{ id: number; groupId: number; inviteCode: string; createdBy: number; createdAt: string }>(`/groups/${groupId}/invite`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function fetchGroupInviteUsage(groupId: number) {
  return apiRequest<GroupInviteUsage[]>(`/groups/${groupId}/invite-usage`, {
    auth: true
  });
}

export async function joinGroup(inviteCode: string) {
  return apiRequest<Group>(`/join/${inviteCode}`, {
    method: "POST",
    auth: true
  });
}

export async function fetchRegistrationInviteUsage() {
  return apiRequest<RegistrationInviteUsage[]>("/members/me/invite-usage", {
    auth: true
  });
}

export async function leaveGroup(groupId: number) {
  return apiRequest<{ success: boolean }>(`/groups/${groupId}/leave`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function removeGroupMember(groupId: number, memberId: number) {
  return apiRequest<{ success: boolean }>(`/groups/${groupId}/members/${memberId}/remove`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function claimTickets() {
  return apiRequest<{ member: Member; claimedProposalTickets: number; claimedVoteTickets: number; claimedCreateOrderTickets: number }>("/members/tickets/claim", {
    method: "POST",
    auth: true
  });
}

export async function startWalletChallenge(walletAddress: string) {
  return apiRequest<WalletChallenge>("/auth/wallet/challenge", {
    method: "POST",
    body: JSON.stringify({ walletAddress })
  });
}

export async function passwordLogin(email: string, password: string) {
  return apiRequest<PasswordLoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function verifyWalletLogin(payload: {
  walletAddress: string;
  signature: string;
  displayName?: string;
  inviteCode?: string;
}) {
  return apiRequest<WalletVerifyResponse>("/auth/wallet/verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function paySubscription() {
  return apiRequest<{
    message: string;
    tokenBalance: number;
    subscriptionActive: boolean;
    subscriptionExpires: string;
  }>("/subscription/pay", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ tokenAmount: 99 })
  });
}

export async function cancelSubscription() {
  return apiRequest<Member>("/members/me/subscription/cancel", {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function updateMemberWallet(walletAddress: string) {
  return apiRequest<Member>("/members/me/wallet", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ walletAddress })
  });
}

export async function unlinkMemberWallet() {
  return apiRequest<Member>("/members/me/wallet", {
    method: "DELETE",
    auth: true
  });
}

export async function adminUpsertMerchant(payload: {
  id: string;
  name: string;
  group: string;
  payoutAddress: string;
}) {
  return apiRequest<Merchant>("/admin/merchants", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function adminUpsertMenuItem(
  merchantId: string,
  payload: {
    id: string;
    name: string;
    priceWei: number;
    description: string;
  }
) {
  return apiRequest<Merchant>(`/admin/merchants/${merchantId}/menu`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function adminImportMerchantCsv(csv: string) {
  return apiRequest<{
    message: string;
    merchantCount: number;
    menuItemCount: number;
    importedBy: number;
  }>("/admin/merchants/import", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ csv })
  });
}

export async function fetchMerchantDashboard() {
  const dashboard = await apiRequest<MerchantDashboard>("/merchant/dashboard", { auth: true });
  return {
    ...dashboard,
    merchant: dashboard.merchant ? normalizeMerchant(dashboard.merchant) : null
  };
}

export async function claimMerchant(merchantId: string) {
  const merchant = await apiRequest<Merchant>("/merchant/claim", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ merchantId })
  });
  return normalizeMerchant(merchant);
}

export async function upsertMerchantProfile(payload: {
  id?: string;
  name: string;
  address: string;
  description: string;
  group?: string;
}) {
  const merchant = await apiRequest<Merchant>("/merchant/profile", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
  return normalizeMerchant(merchant);
}

export async function updateMerchantWallet(walletAddress: string) {
  const merchant = await apiRequest<Merchant>("/merchant/wallet", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ walletAddress })
  });
  return normalizeMerchant(merchant);
}

export async function unlinkMerchantWallet() {
  return apiRequest<{ success: boolean }>("/merchant/wallet", {
    method: "DELETE",
    auth: true
  });
}

export async function requestMerchantDelist() {
  const merchant = await apiRequest<Merchant>("/merchant/delist", {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
  return normalizeMerchant(merchant);
}

export async function cancelMerchantDelist() {
  const merchant = await apiRequest<Merchant>("/merchant/delist", {
    method: "DELETE",
    auth: true
  });
  return normalizeMerchant(merchant);
}

function normalizeMerchant(merchant: Merchant): Merchant {
  const delistRequestedAt = normalizeOptionalTimestamp(merchant.delistRequestedAt);
  const delistedAt = normalizeOptionalTimestamp(merchant.delistedAt);
  return {
    ...merchant,
    averageRating: Number.isFinite(Number(merchant.averageRating)) ? Number(merchant.averageRating) : 0,
    reviewCount: Number(merchant.reviewCount || 0),
    address: merchant.address || "",
    description: merchant.description || "",
    delistRequestedAt,
    delistedAt,
    menu: Array.isArray(merchant.menu) ? merchant.menu : []
  };
}

function normalizeOptionalTimestamp(value?: string) {
  if (!value) return undefined;
  if (value.startsWith("0001-01-01")) return undefined;
  return value;
}

export async function acceptMerchantOrder(orderId: number) {
  return apiRequest<Order>(`/merchant/orders/${orderId}/accept`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function completeMerchantOrder(orderId: number) {
  return apiRequest<Order>(`/merchant/orders/${orderId}/complete`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function confirmMemberOrder(orderId: number) {
  return apiRequest<Order>(`/orders/${orderId}/confirm-complete`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function markAdminOrderPaid(orderId: number) {
  return apiRequest<Order>(`/admin/orders/${orderId}/payout`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function createMerchantMenuChange(payload: {
  action: string;
  menuItemId?: string;
  itemName?: string;
  priceWei?: number | string;
  description?: string;
}) {
  return apiRequest<MenuChangeRequest>("/merchant/menu-changes", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function withdrawMerchantMenuChange(changeId: number) {
  return apiRequest<MenuChangeRequest>(`/merchant/menu-changes/${changeId}`, {
    method: "DELETE",
    auth: true
  });
}

export async function fetchAdminDashboard() {
  return apiRequest<AdminDashboard>("/admin/dashboard", { auth: true });
}

export async function fetchAdminInsights() {
  const data = await apiRequest<AdminInsights>("/admin/insights", { auth: true });
  return {
    ...data,
    merchants: data.merchants.map(normalizeMerchant)
  };
}

export async function fetchAdminGroupDetail(groupId: number) {
  return apiRequest<GroupDetail>(`/admin/groups/${groupId}`, { auth: true });
}

export async function fetchAdminMenuChanges(status = "") {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<MenuChangeRequest[]>(`/admin/menu-changes${suffix}`, { auth: true });
}

export async function reviewAdminMenuChange(changeId: number, decision: "approve" | "reject", reviewNote = "") {
  return apiRequest<MenuChangeRequest>(`/admin/menu-changes/${changeId}/review`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ decision, reviewNote })
  });
}

export async function reviewAdminMerchantDelist(merchantId: string, decision: "approve" | "reject") {
  return apiRequest<Merchant>(`/admin/merchant-delists/${merchantId}/review`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ decision })
  });
}

export async function updatePlatformTreasury(address: string) {
  return apiRequest<ContractInfo>("/admin/platform-treasury", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ address })
  });
}
