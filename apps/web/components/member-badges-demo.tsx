"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchMe, type Member } from "@/lib/api";
import {
  REWARD_CATALOG,
  getAvailableMemberPoints,
  getCurrentMemberTitle,
  getMemberComments,
  getMemberRedemptions,
  getPersonalBadgeLevels,
  redeemReward,
  type DemoRedemptionRecord
} from "@/lib/achievement-demo";

export function MemberBadgesDemo() {
  const [member, setMember] = useState<Member | null>(null);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchMe()
      .then(setMember)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取會員資料失敗。"));
  }, []);

  const summary = useMemo(() => {
    if (!member) return null;
    const commentCount = getMemberComments(member.id).length;
    const availablePoints = getAvailableMemberPoints(member.id);
    const title = getCurrentMemberTitle(member.id);
    const badgeLevels = getPersonalBadgeLevels(member.id);
    const redemptions = getMemberRedemptions(member.id);
    return { commentCount, availablePoints, title, badgeLevels, redemptions };
  }, [member, refreshKey]);

  function handleRedeem(rewardId: string) {
    if (!member) return;
    try {
      const record = redeemReward(member.id, rewardId);
      setMessage(`已兌換 ${record.rewardName}。`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "兌換失敗。");
    }
  }

  if (!member || !summary) {
    return <div className="meal-panel p-6">讀取個人勳章資料中...</div>;
  }

  return (
    <section className="meal-panel p-8">
      <p className="meal-kicker">Personal badges</p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold">積分購買勳章稱號</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            評論每增加 1 則可累積 5 點積分，積分可在這裡兌換個人勳章稱號。
          </p>
          <p className="mt-3 text-sm font-semibold text-primary">
            目前稱號：{summary.title || "尚未兌換稱號"}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-border bg-background/70 px-5 py-4 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">可用積分</p>
          <p className="mt-2 text-2xl font-extrabold">{summary.availablePoints} pts</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="評論數" value={`${summary.commentCount} 則`} />
        <StatCard label="個人積分" value={`${summary.availablePoints} pts`} />
        <StatCard label="已解鎖稱號" value={summary.title || "尚未兌換"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {summary.badgeLevels.map((badge) => (
          <div key={badge.key} className="rounded-[1.25rem] border border-border bg-background/70 p-5">
            <p className="text-sm font-bold text-foreground">{badge.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              門檻：{badge.threshold} 則評論
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">
              {badge.level > 0 ? "已解鎖" : "尚未解鎖"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold text-foreground">勳章稱號商店</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {REWARD_CATALOG.map((reward) => (
            <div key={reward.id} className="rounded-[1.25rem] border border-border bg-background/70 p-5">
              <p className="text-lg font-bold">{reward.name}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{reward.description}</p>
              <p className="mt-3 text-sm font-semibold text-primary">{reward.costPoints} pts</p>
              <button
                type="button"
                onClick={() => handleRedeem(reward.id)}
                className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                兌換稱號
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold text-foreground">積分兌換紀錄</h3>
        <div className="mt-4 space-y-3">
          {summary.redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前還沒有任何勳章稱號兌換紀錄。</p>
          ) : (
            summary.redemptions.map((record) => <RedemptionCard key={record.id} record={record} />)
          )}
        </div>
      </div>

      {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}

function RedemptionCard({ record }: { record: DemoRedemptionRecord }) {
  return (
    <div className="rounded-[1.2rem] border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold">{record.rewardName}</p>
        <p className="text-sm text-muted-foreground">-{record.costPoints} pts</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">獲得稱號：{record.grantedTitle}</p>
      <p className="mt-2 text-xs text-muted-foreground">{new Date(record.createdAt).toLocaleString("zh-TW")}</p>
    </div>
  );
}
