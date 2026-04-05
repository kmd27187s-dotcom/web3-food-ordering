"use client";

import { startWalletChallenge, verifyWalletLogin } from "@/lib/api";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
};

const WALLET_CONNECTED_KEY = "mealvote.wallet.connected";
const WALLET_ADDRESS_KEY = "mealvote.wallet.address";

function getEthereumProvider(): EthereumProvider | undefined {
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function storeWalletSession(address: string) {
  if (typeof window === "undefined") return;
  if (!address) {
    window.sessionStorage.removeItem(WALLET_CONNECTED_KEY);
    window.sessionStorage.removeItem(WALLET_ADDRESS_KEY);
    return;
  }
  window.sessionStorage.setItem(WALLET_CONNECTED_KEY, "1");
  window.sessionStorage.setItem(WALLET_ADDRESS_KEY, address);
}

export function clearWalletConnection() {
  storeWalletSession("");
}

export async function getConnectedWalletAddress() {
  if (typeof window === "undefined") return "";
  if (!window.sessionStorage.getItem(WALLET_CONNECTED_KEY)) return "";
  const ethereum = getEthereumProvider();
  if (!ethereum) return "";
  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || accounts.length === 0) return "";
  const address = String(accounts[0] || "");
  if (!address) {
    clearWalletConnection();
    return "";
  }
  storeWalletSession(address);
  return address;
}

export async function connectWallet() {
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new Error("請先安裝 MetaMask。");
  }
  try {
    await ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }]
    });
  } catch {
    // Fall back to the normal account request flow for wallets that do not
    // support explicit permission prompts.
  }
  const [account] = await ethereum.request({ method: "eth_requestAccounts" });
  if (!account) {
    throw new Error("沒有可用的錢包地址。");
  }
  const address = String(account);
  storeWalletSession(address);
  return address;
}

export async function authenticateWithWallet(input: {
  displayName?: string;
  inviteCode?: string;
}) {
  const walletAddress = await connectWallet();
  const challenge = await startWalletChallenge(walletAddress);
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new Error("請先安裝 MetaMask。");
  }

  const signature = await ethereum.request({
    method: "personal_sign",
    params: [challenge.message, walletAddress]
  });
  return verifyWalletLogin({
    walletAddress,
    signature,
    displayName: (input.displayName || "").trim(),
    inviteCode: input.inviteCode
  });
}
