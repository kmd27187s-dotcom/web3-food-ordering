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
    <section className="relative overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.62)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(251,242,237,0.86))] p-8 shadow-[0_24px_70px_rgba(93,54,27,0.14)] backdrop-blur xl:p-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(148,74,0,0.28)] to-transparent" />
      <div className="pointer-events-none absolute -right-14 top-10 h-36 w-36 rounded-full bg-[rgba(194,119,60,0.1)] blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-white/40 blur-2xl" />
      <p className="meal-kicker">Wallet sign-in</p>
      <h2 className="mt-4 font-[var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] text-balance xl:text-4xl">
        連接錢包後進入系統
      </h2>
      <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">第一次登入需填顯示名稱。</p>

      <div className="mt-8 space-y-4">
        <label className="block space-y-2 text-sm">
          <span className="font-semibold text-foreground">顯示名稱</span>
          <input
            className="meal-field"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="第一次登入必填"
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="font-semibold text-foreground">註冊邀請碼（選填）</span>
          <input
            className="meal-field"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="選填"
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={handleSubmit} disabled={loading} className="meal-hero-gradient min-w-[13rem] rounded-[1.2rem] px-6 py-3.5 text-sm font-bold tracking-[0.04em] text-white shadow-[0_20px_32px_rgba(154,68,45,0.22)]">
          {loading ? "處理中..." : "連結錢包並登入"}
        </Button>
        <span className="inline-flex items-center rounded-full border border-[rgba(220,193,177,0.42)] bg-[rgba(251,242,237,0.82)] px-4 py-3 text-sm font-semibold text-muted-foreground">
          {walletAddress ? `目前已連接 ${shortAddress(walletAddress)}` : "目前未連接錢包"}
        </span>
      </div>

      <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        {[
          ["1", "連接"],
          ["2", "簽名"],
          ["3", "進入"]
        ].map(([index, label]) => (
            <div key={index} className="rounded-[1.2rem] border border-[rgba(220,193,177,0.38)] bg-[rgba(255,255,255,0.62)] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground/80">Step {index}</p>
              <p className="mt-1 font-semibold text-foreground">{label}</p>
            </div>
        ))}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="mt-4 text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </div>
    </section>
  );
}

function shortAddress(address: string) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
