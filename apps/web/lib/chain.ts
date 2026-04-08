"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  encodePacked,
  keccak256,
  parseAbi,
  stringToHex
} from "viem";
import { sepolia } from "viem/chains";

export const GOVERNANCE_ABI = parseAbi([
  "function createRound(bytes32 groupKey, bytes32 titleHash, bytes32[] initialMerchantKeys, bool useCreateCoupon, bool[] useProposalCoupons) payable returns (uint256 roundId)",
  "function proposeMerchant(uint256 roundId, bytes32 merchantKey, bool useCoupon) payable",
  "function castVote(uint256 roundId, uint256 candidateId, uint256 voteCount, bool useCoupon) payable",
  "function subscribeMonthly() payable returns (uint256 expiresAt)",
  "function cancelSubscription()",
  "function subscriptionExpiresAt(address member) view returns (uint40)",
  "event RoundCreated(uint256 indexed roundId, address indexed creator, bytes32 indexed groupKey, uint256 proposalDeadline, uint256 voteDeadline, uint256 orderingDeadline)",
  "event MerchantProposed(uint256 indexed roundId, uint256 indexed candidateId, bytes32 indexed merchantKey, address proposer, bool usedCoupon)",
  "event VoteCast(uint256 indexed roundId, uint256 indexed candidateId, address indexed voter, uint256 voteCount, uint256 feeAmountWei, bool usedCoupon)",
  "event SubscriptionPaid(address indexed member, uint256 amountWei, uint256 expiresAt)",
  "event SubscriptionCancelled(address indexed member, uint256 cancelledAt)"
]);

export const ESCROW_ABI = parseAbi([
  "function openEscrow(uint256 roundId, bytes32 groupKey, bytes32 winnerMerchantKey, bytes32 menuSnapshotHash, bytes32 orderDetailHash, bytes32 participantHash, address merchantWallet, uint256 totalParticipants, uint256 totalQuantity, uint256 totalOrderAmountWei) returns (uint256 orderId)",
  "function payForOrder(uint256 orderId) payable",
  "function merchantAccept(uint256 orderId)",
  "function merchantComplete(uint256 orderId)",
  "function memberConfirmReceived(uint256 orderId)",
  "function releasePayout(uint256 orderId)",
  "event OrderEscrowOpened(uint256 indexed orderId, uint256 indexed roundId, bytes32 indexed winnerMerchantKey, address merchantWallet)",
  "event OrderPaymentSubmitted(uint256 indexed orderId, address indexed payer, uint256 amountWei)",
  "event MerchantAccepted(uint256 indexed orderId, address indexed merchantWallet)",
  "event MerchantCompleted(uint256 indexed orderId, address indexed merchantWallet)",
  "event MemberConfirmed(uint256 indexed orderId, address indexed member)",
  "event PayoutReleased(uint256 indexed orderId, address indexed merchantWallet, uint256 merchantAmountWei, uint256 platformAmountWei)"
]);

export const ORDER_ABI = parseAbi([
  "function placeOrder(uint256 proposalId, bytes32 orderHash, string note, uint256 amount, uint256 expiry, bytes sig) payable"
]);

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type InjectedEthereum = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export function getInjectedEthereum(): InjectedEthereum | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: InjectedEthereum }).ethereum;
}

export function isUsableContractAddress(address?: string) {
  if (!address) return false;
  return address.toLowerCase() !== ZERO_ADDRESS;
}

export async function getWalletBalanceWei(address: string) {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    throw new Error("請先安裝 MetaMask。");
  }
  const result = await ethereum.request({
    method: "eth_getBalance",
    params: [address, "latest"]
  });
  return BigInt(String(result));
}

export async function ensureSepoliaClients() {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    throw new Error("請先安裝 MetaMask。");
  }

  await ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }]
  });

  const transport = custom(ethereum);
  const walletClient = createWalletClient({ chain: sepolia, transport });
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const [account] = await walletClient.getAddresses();
  if (!account) {
    throw new Error("請先在 MetaMask 選擇可用帳號。");
  }
  return { walletClient, publicClient, account };
}

export async function ensureSepoliaWallet() {
  const { walletClient } = await ensureSepoliaClients();
  return walletClient;
}

export function toStableKey(prefix: string, value: string) {
  return keccak256(stringToHex(`${prefix}:${value.trim()}`));
}

export function toTextHash(value: string) {
  return keccak256(stringToHex(value.trim()));
}

export function hashParticipantAddresses(addresses: string[]) {
  const normalized = [...addresses].map((address) => address.toLowerCase()).sort();
  return keccak256(encodePacked(["string"], [normalized.join("|")]));
}

export async function waitForGovernanceRoundCreated(txHash: `0x${string}`) {
  const { publicClient } = await ensureSepoliaClients();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: GOVERNANCE_ABI,
        data: log.data,
        topics: log.topics
      });
      if (decoded.eventName === "RoundCreated") {
        return Number(decoded.args.roundId);
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error("找不到 RoundCreated 事件，無法取得鏈上 round id。");
}

export async function waitForGovernanceCandidateCreated(txHash: `0x${string}`) {
  const { publicClient } = await ensureSepoliaClients();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: GOVERNANCE_ABI,
        data: log.data,
        topics: log.topics
      });
      if (decoded.eventName === "MerchantProposed") {
        return Number(decoded.args.candidateId);
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error("找不到 MerchantProposed 事件，無法取得候選店家索引。");
}

export async function waitForEscrowOpened(txHash: `0x${string}`) {
  const { publicClient } = await ensureSepoliaClients();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: ESCROW_ABI,
        data: log.data,
        topics: log.topics
      });
      if (decoded.eventName === "OrderEscrowOpened") {
        return Number(decoded.args.orderId);
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error("找不到 OrderEscrowOpened 事件，無法取得 escrow order id。");
}

export async function waitForSubscriptionPaid(txHash: `0x${string}`) {
  const { publicClient } = await ensureSepoliaClients();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: GOVERNANCE_ABI,
        data: log.data,
        topics: log.topics
      });
      if (decoded.eventName === "SubscriptionPaid") {
        return {
          amountWei: BigInt(String(decoded.args.amountWei)),
          expiresAt: Number(decoded.args.expiresAt)
        };
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error("找不到 SubscriptionPaid 事件，無法同步訂閱狀態。");
}

export function toFriendlyWalletError(error: unknown, fallback = "付款未成功，請重新操作。") {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.toLowerCase();
  if (
    normalized.includes("4001") ||
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("request rejected") ||
    normalized.includes("action_rejected") ||
    normalized.includes("transaction execution cancelled")
  ) {
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
