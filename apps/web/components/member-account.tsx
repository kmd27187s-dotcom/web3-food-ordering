"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchMe, unlinkMemberWallet, updateMemberWallet, type Member } from "@/lib/api";
import { clearWalletConnection, connectWallet } from "@/lib/wallet-auth";

export function MemberAccount() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchMe()
      .then(setMember)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取會員資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function handleChangeWallet() {
    setPending(true);
    try {
      const walletAddress = await connectWallet();
      const updated = await updateMemberWallet(walletAddress);
      setMember(updated);
      setMessage(`會員錢包已更新為 ${updated.walletAddress || walletAddress}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "修改錢包失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleUnlinkWallet() {
    setPending(true);
    try {
      const updated = await unlinkMemberWallet();
      clearWalletConnection();
      setMember(updated);
      setMessage("會員錢包已解除綁定。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "解除錢包綁定失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入會員帳號設定...</div>;
  if (!member) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到會員資料"}</div>;

  return (
    <section className="meal-panel p-8">
      <p className="meal-kicker">Account settings</p>
      <h1 className="text-3xl font-extrabold">會員帳號設定</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Stat label="名稱" value={member.displayName} />
        <Stat label="會員錢包" value={member.walletAddress || "尚未綁定"} breakAll />
        <Stat label="平台 Token" value={`${member.tokenBalance}`} />
        <Stat label="積分" value={`${member.points} pts`} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={handleChangeWallet} disabled={pending}>修改錢包位址</Button>
        <Button variant="secondary" onClick={handleUnlinkWallet} disabled={pending || !member.walletAddress}>解除錢包綁定</Button>
      </div>
      {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
    </section>
  );
}

function Stat({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-base font-semibold ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}
