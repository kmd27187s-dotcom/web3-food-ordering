"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { clearStoredToken, setStoredToken } from "@/lib/api";
import { authenticateWithWallet, clearWalletConnection, getConnectedWalletAddress } from "@/lib/wallet-auth";

export function LoginPanel() {
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWalletStatus() {
      try {
        const address = await getConnectedWalletAddress();
        if (active) {
          setWalletAddress(address);
        }
      } catch {
        if (active) {
          setWalletAddress("");
        }
      }
    }

    loadWalletStatus();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit() {
    setLoading(true);
    setMessage("");
    try {
      clearStoredToken();
      clearWalletConnection();
      setWalletAddress("");
      const result = await authenticateWithWallet({ displayName, inviteCode });
      setStoredToken(result.token);
      setWalletAddress(result.member.walletAddress || "");
      if (!result.member.subscriptionActive) {
        window.location.replace("/subscribe");
        return;
      }
      window.location.replace("/member");
    } catch (error) {
      if (error instanceof Error && error.message.includes("displayName is required")) {
        window.alert("第一次建立會員必須填寫顯示名稱。");
        setMessage("第一次建立會員必須填寫顯示名稱。");
      } else {
        setMessage(error instanceof Error ? error.message : "錢包登入失敗");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-orange-100 bg-white p-8 shadow-xl xl:p-10">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-stone-900">歡迎回來</h2>
        <p className="text-stone-500">請連接錢包以登入</p>
      </div>

      <div className="mt-8 space-y-4">
        <label className="block space-y-2 text-sm">
          <span className="font-semibold text-stone-900">顯示名稱</span>
          <input
            className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 text-sm outline-none transition focus:border-orange-300"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="第一次登入必填"
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="font-semibold text-stone-900">註冊邀請碼</span>
          <input
            className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 text-sm outline-none transition focus:border-orange-300"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="選填"
          />
        </label>
      </div>

      <div className="mt-8 space-y-4">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-white shadow-lg shadow-orange-900/20 transition hover:scale-[1.01] hover:bg-primary/95 active:scale-[0.99]"
        >
          {loading ? "處理中..." : "連結錢包並登入"}
        </Button>
        <div className="text-center text-sm font-semibold text-stone-500">
          {walletAddress ? `已連接 ${shortAddress(walletAddress)}` : "未連接錢包"}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="h-1 rounded-full bg-orange-50" />
        <div className="h-1 rounded-full bg-orange-100" />
        <div className="h-1 rounded-full bg-orange-50" />
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="mt-4 text-center text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </div>
    </section>
  );
}

function shortAddress(address: string) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
