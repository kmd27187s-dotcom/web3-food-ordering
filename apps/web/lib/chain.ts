"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  encodePacked,
  keccak256,
  stringToHex
} from "viem";
import { sepolia } from "viem/chains";

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

export async function sendNativePayment(to: `0x${string}`, value: bigint) {
  const { walletClient, publicClient, account } = await ensureSepoliaClients();
  const hash = await walletClient.sendTransaction({
    account,
    chain: walletClient.chain,
    to,
    value
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, account };
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
