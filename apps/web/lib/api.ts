export type Member = {
  id: number;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;
  registrationInviteCode?: string;
  isAdmin?: boolean;
  points: number;
  proposalTicketCount: number;
  voteTicketCount: number;
  createOrderTicketCount: number;
  proposalCouponCount: number;
  voteCouponCount: number;
  createOrderCouponCount: number;
  claimableProposalTickets: number;
  claimableVoteTickets: number;
  claimableCreateOrderTickets: number;
  claimableProposalCoupons: number;
  claimableVoteCoupons: number;
  claimableCreateOrderCoupons: number;
  subscriptionActive: boolean;
  subscriptionExpiresAt?: string;
};

export type GovernanceParams = {
  createFeeWei: number;
  proposalFeeWei: number;
  voteFeeWei: number;
  subscriptionFeeWei: number;
  subscriptionDurationDays: number;
  winnerProposalRefundBps: number;
  loserProposalRefundBps: number;
  voteRefundBps: number;
  winnerBonusBps: number;
  loserBonusBps: number;
  winnerProposalPoints: number;
  winnerVotePointsPerVote: number;
  proposalDurationMinutes: number;
  voteDurationMinutes: number;
  orderingDurationMinutes: number;
  proposalDurationOptions?: number[];
  voteDurationOptions?: number[];
  orderingDurationOptions?: number[];
  dailyCreateCouponCount: number;
  dailyProposalCouponCount: number;
  dailyVoteCouponCount: number;
  autoPayoutEnabled: boolean;
  autoPayoutDelayDays: number;
  platformEscrowFeeBps: number;
  merchantAcceptTimeoutMins: number;
  merchantCompleteTimeoutMins: number;
  memberConfirmTimeoutMins: number;
  governanceClaimTimeoutMins: number;
  escrowClaimTimeoutMins: number;
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
  proposalFeePaidWei?: number;
  voteFeeCollectedWei?: number;
  voteRefundWei?: number;
  proposerRefundWei?: number;
  proposerRewardWei?: number;
  firstProposedAt?: string;
  isWinner?: boolean;
  usedProposalCoupon?: boolean;
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
  createdBy: number;
  createdByName: string;
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
  totalVoteCount?: number;
  createFeeWei?: number;
  createFeeRefundWei?: number;
  createFeePlatformWei?: number;
  proposalFeeWei?: number;
  voteFeeWei?: number;
  winnerProposalRefundBps?: number;
  loserProposalRefundBps?: number;
  voteRefundBps?: number;
  winnerBonusBps?: number;
  loserBonusBps?: number;
  winnerProposalPoints?: number;
  winnerVotePointsPerVote?: number;
  usedCreateOrderCoupon?: boolean;
  settledAt?: string;
  failedReason?: string;
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
  feeAmountWei?: number;
  voteWeight: number;
  voteCount?: number;
  refundWei?: number;
  submittedAt: string;
  walletHidden?: boolean;
  useVoteCoupon?: boolean;
};

export type VoteQuote = {
  voteCount: number;
  voteWeight: number;
  feeAmountWei?: number;
  voteFeeWei?: number;
  discountedVotes?: number;
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
  governanceContract: string;
  orderEscrowContract: string;
  platformTreasury: string;
  signerAddress: string;
};

export type LeaderboardEntry = {
  rank: number;
  memberId: number;
  displayName: string;
  avatarUrl?: string;
  points: number;
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
  title: string;
  createdBy: number;
  createdByName: string;
  memberName: string;
  merchantId: string;
  merchantName: string;
  merchantPayoutAddress: string;
  amountWei: string;
  status: string;
  createdAt: string;
  confirmedAt?: string;
  autoPayoutAt?: string;
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
  autoPayoutSigner: string;
  governanceParams?: GovernanceParams;
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

const SESSION_KEY = "mealvote.session";
const LEGACY_TOKEN_KEY = "mealvote.token";
const LEGACY_LOCAL_TOKEN_KEY = "mealvote.token.local";

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
}

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  const legacyToken =
    window.sessionStorage.getItem(LEGACY_TOKEN_KEY) ||
    window.localStorage.getItem(LEGACY_TOKEN_KEY) ||
    window.localStorage.getItem(LEGACY_LOCAL_TOKEN_KEY);
  if (legacyToken && !window.sessionStorage.getItem(SESSION_KEY)) {
    window.sessionStorage.setItem(SESSION_KEY, legacyToken);
    window.sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_LOCAL_TOKEN_KEY);
  }
  return window.sessionStorage.getItem(SESSION_KEY) || "";
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  if (token) {
    window.sessionStorage.setItem(SESSION_KEY, token);
    window.sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_LOCAL_TOKEN_KEY);
    return;
  }
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_LOCAL_TOKEN_KEY);
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
  const member = await apiRequest<Member>("/members/me", { auth: true });
  return normalizeMember(member);
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
  const history = await apiRequest<MemberOrderHistory>("/members/me/orders", { auth: true });
  return {
    orders: Array.isArray(history?.orders) ? history.orders.map(normalizeOrder) : []
  };
}

export async function fetchProposals() {
  const proposals = await apiRequest<Proposal[]>("/proposals", { auth: true });
  return Array.isArray(proposals) ? proposals.map(normalizeProposal) : [];
}

export async function fetchProposal(proposalId: number) {
  const proposal = await apiRequest<Proposal>(`/proposals/${proposalId}`, { auth: true });
  return normalizeProposal(proposal);
}

export async function createProposal(payload: {
  title: string;
  description?: string;
  maxOptions: number;
  merchantId?: string;
  merchantIds?: string[];
  useInitialProposalTickets?: boolean[];
  proposalMinutes: number;
  voteMinutes: number;
  orderMinutes: number;
  groupId: number;
  useCreateOrderTicket?: boolean;
  txHash?: string;
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

export async function addProposalOption(proposalId: number, merchantId: string, useProposalTicket = false, txHash?: string) {
  return apiRequest<ProposalOption>(`/proposals/${proposalId}/options`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ merchantId, useProposalTicket, txHash })
  });
}

export async function quoteVote(proposalId: number, voteCount: number, useVoteTicket = false) {
  return apiRequest<VoteQuote>(`/proposals/${proposalId}/votes/quote`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ voteCount, useVoteTicket })
  });
}

export async function voteProposal(proposalId: number, optionId: number, voteCount: number, useVoteTicket = false, txHash?: string) {
  return apiRequest<Proposal>(`/proposals/${proposalId}/votes`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ optionId, voteCount, useVoteTicket, txHash })
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
  txHash?: string;
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

export async function syncSubscription(payload: {
  txHash: string;
  expiresAt: string;
}) {
  return apiRequest<Member>("/subscription/sync", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
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
    merchant: dashboard?.merchant ? normalizeMerchant(dashboard.merchant) : null,
    orders: Array.isArray(dashboard?.orders) ? dashboard.orders.map(normalizeOrder) : [],
    menuChangeRequests: Array.isArray(dashboard?.menuChangeRequests) ? dashboard.menuChangeRequests : [],
    acceptedOrderCount: Number(dashboard?.acceptedOrderCount || 0),
    pendingOrderCount: Number(dashboard?.pendingOrderCount || 0),
    completedOrderCount: Number(dashboard?.completedOrderCount || 0),
    totalOrderCount: Number(dashboard?.totalOrderCount || 0),
    totalRevenueWei: String(dashboard?.totalRevenueWei || "0")
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

function normalizeMember(member: Member): Member {
  return {
    ...member,
    displayName: member?.displayName || "",
    points: Number(member?.points || 0),
    proposalTicketCount: Number(member?.proposalTicketCount || 0),
    voteTicketCount: Number(member?.voteTicketCount || 0),
    createOrderTicketCount: Number(member?.createOrderTicketCount || 0),
    proposalCouponCount: Number(member?.proposalCouponCount || 0),
    voteCouponCount: Number(member?.voteCouponCount || 0),
    createOrderCouponCount: Number(member?.createOrderCouponCount || 0),
    claimableProposalTickets: Number(member?.claimableProposalTickets || 0),
    claimableVoteTickets: Number(member?.claimableVoteTickets || 0),
    claimableCreateOrderTickets: Number(member?.claimableCreateOrderTickets || 0),
    claimableProposalCoupons: Number(member?.claimableProposalCoupons || 0),
    claimableVoteCoupons: Number(member?.claimableVoteCoupons || 0),
    claimableCreateOrderCoupons: Number(member?.claimableCreateOrderCoupons || 0),
    subscriptionActive: Boolean(member?.subscriptionActive)
  };
}

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    title: order?.title || "",
    createdBy: Number(order?.createdBy || 0),
    createdByName: order?.createdByName || "",
    memberName: order?.memberName || "",
    merchantId: order?.merchantId || "",
    merchantName: order?.merchantName || "",
    merchantPayoutAddress: order?.merchantPayoutAddress || "",
    orderHash: order?.orderHash || "",
    amountWei: String(order?.amountWei || "0"),
    status: order?.status || "pending",
    items: Array.isArray(order?.items) ? order.items : []
  };
}

function normalizeProposalOption(option: ProposalOption): ProposalOption {
  return {
    ...option,
    merchantId: option?.merchantId || "",
    merchantName: option?.merchantName || "",
    proposerMemberId: Number(option?.proposerMemberId || 0),
    weightedVotes: Number(option?.weightedVotes || 0),
    tokenStake: Number(option?.tokenStake || 0),
    proposalFeePaidWei: Number(option?.proposalFeePaidWei || 0),
    voteFeeCollectedWei: Number(option?.voteFeeCollectedWei || 0),
    voteRefundWei: Number(option?.voteRefundWei || 0),
    proposerRefundWei: Number(option?.proposerRefundWei || 0),
    proposerRewardWei: Number(option?.proposerRewardWei || 0),
    isWinner: Boolean(option?.isWinner),
    usedProposalCoupon: Boolean(option?.usedProposalCoupon)
  };
}

function normalizeVoteRecord(vote: VoteRecord): VoteRecord {
  return {
    ...vote,
    memberId: Number(vote?.memberId || 0),
    memberName: vote?.memberName || "",
    optionId: Number(vote?.optionId || 0),
    tokenAmount: Number(vote?.tokenAmount || 0),
    feeAmountWei: Number(vote?.feeAmountWei || 0),
    voteWeight: Number(vote?.voteWeight || 0),
    voteCount: Number(vote?.voteCount || 0),
    refundWei: Number(vote?.refundWei || 0),
    useVoteCoupon: Boolean(vote?.useVoteCoupon)
  };
}

function normalizeProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    id: Number(proposal?.id || 0),
    title: proposal?.title || "",
    description: proposal?.description || "",
    merchantGroup: proposal?.merchantGroup || "",
    mealPeriod: proposal?.mealPeriod || "",
    groupId: Number(proposal?.groupId || 0),
    createdBy: Number(proposal?.createdBy || 0),
    createdByName: proposal?.createdByName || "",
    status: proposal?.status || "proposing",
    orderTotalWei: String(proposal?.orderTotalWei || "0"),
    orderMemberCount: Number(proposal?.orderMemberCount || 0),
    currentVoteOptionId: Number(proposal?.currentVoteOptionId || 0),
    currentVoteTokenAmount: Number(proposal?.currentVoteTokenAmount || 0),
    currentVoteWeight: Number(proposal?.currentVoteWeight || 0),
    winnerOptionId: Number(proposal?.winnerOptionId || 0),
    totalVoteCount: Number(proposal?.totalVoteCount || 0),
    options: Array.isArray(proposal?.options) ? proposal.options.map(normalizeProposalOption) : [],
    votes: Array.isArray(proposal?.votes) ? proposal.votes.map(normalizeVoteRecord) : [],
    orders: Array.isArray(proposal?.orders) ? proposal.orders.map(normalizeOrder) : []
  };
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

export async function cancelAdminOrderPayout(orderId: number) {
  return apiRequest<Order>(`/admin/orders/${orderId}/payout/cancel`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({})
  });
}

export async function markAdminOrdersPaid(orderIds: number[]) {
  return apiRequest<{ count: number; orders: Order[] }>(`/admin/orders/payout/batch`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ orderIds })
  });
}

export async function syncAdminOrdersPaid(orderIds: number[], payload: { txHash: string; manualWallet: string }) {
  return apiRequest<{ count: number; orders: Order[] }>(`/admin/orders/payout/batch`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ orderIds, txHash: payload.txHash, manualWallet: payload.manualWallet, manualPayout: true })
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
  const dashboard = await apiRequest<AdminDashboard>("/admin/dashboard", { auth: true });
  return {
    ...dashboard,
    memberCount: Number(dashboard?.memberCount || 0),
    groupCount: Number(dashboard?.groupCount || 0),
    merchantCount: Number(dashboard?.merchantCount || 0),
    orderCount: Number(dashboard?.orderCount || 0),
    dinerCount: Number(dashboard?.dinerCount || 0),
    totalServings: Number(dashboard?.totalServings || 0),
    pendingMenuReviews: Number(dashboard?.pendingMenuReviews || 0),
    pendingMerchantDelists: Number(dashboard?.pendingMerchantDelists || 0),
    platformTreasury: dashboard?.platformTreasury || "",
    autoPayoutSigner: dashboard?.autoPayoutSigner || "",
    menuChangeRequests: Array.isArray(dashboard?.menuChangeRequests) ? dashboard.menuChangeRequests : [],
    merchantDelistRequests: Array.isArray(dashboard?.merchantDelistRequests) ? dashboard.merchantDelistRequests : [],
    readyPayoutOrders: Array.isArray(dashboard?.readyPayoutOrders) ? dashboard.readyPayoutOrders.map(normalizeReadyPayoutOrder) : []
  };
}

function normalizeReadyPayoutOrder(order: ReadyPayoutOrder): ReadyPayoutOrder {
  return {
    ...order,
    proposalId: Number(order?.proposalId || 0),
    title: order?.title || "",
    createdBy: Number(order?.createdBy || 0),
    createdByName: order?.createdByName || "",
    memberName: order?.memberName || "",
    merchantId: order?.merchantId || "",
    merchantName: order?.merchantName || "",
    merchantPayoutAddress: order?.merchantPayoutAddress || "",
    amountWei: String(order?.amountWei || "0"),
    status: order?.status || "ready_for_payout"
  };
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

export async function fetchGovernanceParams() {
  return apiRequest<GovernanceParams>("/admin/platform-params", { auth: true });
}

export async function fetchPublicGovernanceParams() {
  return apiRequest<GovernanceParams>("/governance/params");
}

export async function updateGovernanceParams(params: GovernanceParams) {
  return apiRequest<GovernanceParams>("/admin/platform-params", {
    method: "POST",
    auth: true,
    body: JSON.stringify(params)
  });
}
