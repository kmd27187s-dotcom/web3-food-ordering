"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchGroupDetail, type GroupDetail, type Order } from "@/lib/api";
import { OrderSummaryCard } from "@/components/member-order-shared";

export function GroupOrdersView({ groupId }: { groupId: number }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchGroupDetail(groupId)
      .then(setDetail)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取群組訂單失敗"))
      .finally(() => setLoading(false));
  }, [groupId]);

  const orders = useMemo(() => {
    if (!detail) return [];
    const dedup = new Map<number, Order>();
    detail.members.forEach((member) => {
      member.recentOrders.forEach((order) => {
        if (!dedup.has(order.id)) dedup.set(order.id, order);
      });
    });
    return Array.from(dedup.values()).sort((left, right) => right.id - left.id);
  }, [detail]);

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入群組歷史訂單...</div>;
  if (!detail) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到群組資料"}</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Group orders</p>
        <h1 className="text-3xl font-extrabold">{detail.group.name} / 歷史訂單</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">先看群組訂單清單，再點進去查看每筆訂單的詳細狀態、金額與餐點內容。</p>
      </section>

      <section className="space-y-4">
        {orders.length === 0 ? <div className="meal-panel p-8 text-sm text-muted-foreground">目前沒有歷史訂單。</div> : null}
        {orders.map((order) => (
          <OrderSummaryCard key={order.id} order={order} detailHref={`/member/groups/${groupId}/orders/${order.id}`} />
        ))}
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
