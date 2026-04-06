"use client";

import { createWalletClient, custom, parseAbi } from "viem";
import { sepolia } from "viem/chains";

export const ORDER_ABI = parseAbi([
  "function finalizeVote(uint256 proposalId)",
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

export async function ensureSepoliaWallet() {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    throw new Error("請先安裝 MetaMask。");
  }

  await ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }]
  });

  return createWalletClient({
    chain: sepolia,
    transport: custom(ethereum)
  });
}
