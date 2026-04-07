"use client";

import { useEffect, useState } from "react";

import { fetchAdminGroupDetail, type GroupDetail } from "@/lib/api";

export function AdminGroupDetailView({ groupId }: { groupId: number }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAdminGroupDetail(groupId)
      .then(setDetail)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取群組詳細資料失敗"))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入群組詳細資料...</div>;
  }

  if (!detail) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到群組資料"}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Admin group detail</p>
        <h1 className="text-3xl font-extrabold">{detail.group.name}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{detail.group.description || "尚未填寫群組說明"}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="會員人數" value={`${detail.memberCount}`} />
          <Stat label="群組建立時間" value={new Date(detail.group.createdAt).toLocaleString("zh-TW")} />
          <Stat label="建立者 ID" value={`${detail.group.ownerMemberId}`} />
        </div>
      </section>

      <section className="meal-panel p-8">
        <p className="meal-kicker">Members</p>
        <h2 className="text-2xl font-extrabold">會員資訊</h2>
        <div className="mt-6 space-y-4">
          {detail.members.map((member) => (
            <div key={member.memberId} className="rounded-[1.2rem] border border-border bg-background/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{member.displayName}</p>
                  <p className="mt-2 break-all text-sm text-muted-foreground">錢包地址：{member.walletAddress || "尚未綁定"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">加入時間：{new Date(member.joinedAt).toLocaleString("zh-TW")}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>積分 {member.points}</p>
                  <p className="mt-1">Token {member.tokenBalance}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Stat label="歷史訂單" value={`${member.ordersSubmitted} 次`} />
                <Stat label="參與投票" value={`${member.votesCast} 次`} />
                <Stat label="提案次數" value={`${member.proposalsCreated} 次`} />
                <Stat label="店家評論" value={`${member.merchantReviews} 次`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
