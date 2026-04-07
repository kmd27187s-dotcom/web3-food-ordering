"use client";

import { useEffect, useState } from "react";

import { fetchGroupDetail, type GroupDetail } from "@/lib/api";

export function GroupInviteUsageView({ groupId }: { groupId: number }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchGroupDetail(groupId)
      .then(setDetail)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取群組邀請碼紀錄失敗"))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) return <div className="meal-panel p-8">正在載入群組邀請碼紀錄...</div>;
  if (!detail) return <div className="meal-panel p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到群組資料"}</div>;

  return (
    <section className="meal-panel p-8">
      <p className="meal-kicker">Invite usage</p>
      <h1 className="text-3xl font-extrabold">{detail.group.name} 的邀請碼使用紀錄</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">邀請碼：{detail.group.inviteCode || "尚未建立"}，已被使用 {detail.inviteUsages?.length || 0} 次。</p>

      <div className="mt-6 space-y-3">
        {detail.inviteUsages?.length ? detail.inviteUsages.map((usage) => (
          <div key={usage.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{usage.usedByName}</p>
                <p className="mt-1 text-sm text-muted-foreground">使用邀請碼：{usage.inviteCode}</p>
              </div>
              <p className="text-sm text-muted-foreground">{new Date(usage.usedAt).toLocaleString("zh-TW")}</p>
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">目前尚無使用紀錄。</p>}
      </div>
    </section>
  );
}
