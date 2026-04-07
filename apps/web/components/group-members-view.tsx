"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchGroupDetail, removeGroupMember, type GroupDetail } from "@/lib/api";

export function GroupMembersView({ groupId }: { groupId: number }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setDetail(await fetchGroupDetail(groupId));
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取群組成員失敗"))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function handleRemoveMember(memberId: number) {
    setPending(true);
    try {
      await removeGroupMember(groupId, memberId);
      await refresh();
      setMessage("已移除群組成員。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "移除成員失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入會員清單...</div>;
  if (!detail) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到群組資料"}</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Group members</p>
        <h1 className="text-3xl font-extrabold">{detail.group.name} / 會員清單</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">先看每位成員的基本資料，再點擊右下方統計了解他在群組中的參與狀態。</p>
      </section>

      <section className="space-y-4">
        {detail.members.map((member) => (
          <div key={member.memberId} className="meal-panel p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{member.displayName}</p>
                <p className="mt-2 break-all text-sm text-muted-foreground">錢包地址：{member.walletAddress || "尚未綁定"}</p>
                <p className="mt-1 text-sm text-muted-foreground">加入時間：{new Date(member.joinedAt).toLocaleString("zh-TW")}</p>
                <p className="mt-1 text-sm text-muted-foreground">目前積分：{member.points}</p>
              </div>
              {detail.canManage && member.memberId !== detail.group.ownerMemberId ? (
                <Button variant="ghost" onClick={() => handleRemoveMember(member.memberId)} disabled={pending}>移除成員</Button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Stat label="歷史訂單" value={`${member.ordersSubmitted} 次`} />
              <Stat label="參與投票" value={`${member.votesCast} 次`} />
              <Stat label="提案次數" value={`${member.proposalsCreated} 次`} />
              <Stat label="店家評論" value={`${member.merchantReviews} 次`} />
            </div>
          </div>
        ))}
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
