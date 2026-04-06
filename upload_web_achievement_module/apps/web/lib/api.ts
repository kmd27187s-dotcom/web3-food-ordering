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
  claimableProposalTickets: number;
  subscriptionActive: boolean;
  subscriptionExpiresAt?: string;
};

export type GroupMember = {
  memberId: number;
  displayName: string;
  joinedAt: string;
};

export type Group = {
  id: number;
  name: string;
  description?: string;
  ownerMemberId: number;
  inviteCode?: string;
  members?: GroupMember[];
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
  payoutAddress: string;
  menu: MenuItem[];
};

export type ProposalOption = {
  id: number;
  merchantId: string;
  merchantName: string;
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
  memberId: number;
  memberName: string;
  merchantId: string;
  orderHash: string;
  amountWei: string;
  status: string;
  items: OrderItem[];
  createdAt: string;
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
  orders: Order[];
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
  order?: Order;
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

export type AchievementComment = {
  id: number;
  storeId: string;
  walletAddress: string;
  category: string;
  rating: number;
  content: string;
  createdAt: string;
  replies: {
    id: number;
    walletAddress: string;
    content: string;
    createdAt: string;
  }[];
};

export type AchievementLog = {
  walletAddress: string;
  points: number;
  reason: string;
  sourceId: number;
  createdAt: string;
};

export type AchievementUser = {
  walletAddress: string;
  totalPoints: number;
  logs: AchievementLog[];
  summary: {
    walletAddress: string;
    totalPoints: number;
    commentCount: number;
    replyCount: number;
    receivedReplyCount: number;
    updatedAt?: string;
  };
};

export type AchievementRankingEntry = {
  rank: number;
  walletAddress: string;
  totalPoints: number;
  commentCount: number;
  replyCount: number;
  receivedReplyCount: number;
};

export type AchievementStoreSummary = {
  id: string;
  commentCount: number;
  replyCount: number;
  averageRating: number;
  ratingCount: number;
  ratingBreakdown: {
    five: number;
    four: number;
    three: number;
    two: number;
    one: number;
  };
  latestComment?: string;
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

export async function fetchMerchants() {
  return apiRequest<Merchant[]>("/merchants");
}

export async function fetchUsage(limit = 40) {
  return apiRequest<UsageRecord[]>(`/members/me/usage?limit=${limit}`, { auth: true });
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
}) {
  return apiRequest<Proposal>("/proposals", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload)
  });
}

export async function addProposalOption(proposalId: number, merchantId: string) {
  return apiRequest<ProposalOption>(`/proposals/${proposalId}/options`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ merchantId })
  });
}

export async function quoteVote(proposalId: number, tokenAmount: number) {
  return apiRequest<VoteQuote>(`/proposals/${proposalId}/votes/quote`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ tokenAmount })
  });
}

export async function voteProposal(proposalId: number, optionId: number, tokenAmount: number) {
  return apiRequest<Proposal>(`/proposals/${proposalId}/votes`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ optionId, tokenAmount })
  });
}

export async function fetchMerchant(merchantId: string) {
  return apiRequest<Merchant>(`/merchants/${merchantId}`);
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

export async function joinGroup(inviteCode: string) {
  return apiRequest<Group>(`/join/${inviteCode}`, {
    method: "POST",
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

export async function claimTickets() {
  return apiRequest<{ member: Member; claimedProposalTickets: number }>("/members/tickets/claim", {
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

export async function createAchievementComment(payload: {
  storeId: string;
  walletAddress: string;
  category: string;
  rating: number;
  content: string;
}) {
  return apiRequest<{
    message: string;
    commentId: number;
    pointsAdded: number;
    totalPoints: number;
  }>("/api/achievements/comment", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchAchievementComments(storeId: string) {
  return apiRequest<AchievementComment[]>(`/api/comments?storeId=${encodeURIComponent(storeId)}`);
}

export async function fetchAchievementUser(walletAddress: string) {
  return apiRequest<AchievementUser>(`/api/achievements/user?walletAddress=${encodeURIComponent(walletAddress)}`);
}

export async function fetchAchievementRanking(limit = 10) {
  return apiRequest<AchievementRankingEntry[]>(`/api/achievements/ranking?limit=${limit}`);
}

export async function fetchAchievementStores() {
  return apiRequest<AchievementStoreSummary[]>("/api/stores");
}
