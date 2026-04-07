"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { confirmMemberOrder, fetchGroupDetail, fetchMyOrderHistory, type Order } from "@/lib/api";
import { OrderDetailPanel } from "@/components/member-order-shared";

type MemberOrderDetailProps =
  | { orderId: number; groupId?: undefined }
  | { orderId: number; groupId: number };

export function MemberOrderDetailView(props: MemberOrderDetailProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    if (props.groupId) {
      const detail = await fetchGroupDetail(props.groupId);
      const dedup = new Map<number, Order>();
      detail.members.forEach((member) => {
        member.recentOrders.forEach((order) => {
          if (!dedup.has(order.id)) dedup.set(order.id, order);
        });
      });
      setOrders(Array.from(dedup.values()));
      return;
    }

    const history = await fetchMyOrderHistory();
    setOrders(history.orders);
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取訂單詳細資料失敗"))
      .finally(() => setLoading(false));
  }, [props.groupId, props.orderId]);

  const order = useMemo(() => orders.find((item) => item.id === props.orderId) || null, [orders, props.orderId]);

  async function handleConfirm() {
    if (!order) return;
    setPending(true);
    try {
      await confirmMemberOrder(order.id);
      await refresh();
      setMessage("已確認接收訂單。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "確認接收失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入訂單詳細資料...</div>;
  }

  if (!order) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到這筆訂單"}</div>;
  }

  return (
    <div className="space-y-6">
      <OrderDetailPanel
        order={order}
        backHref={props.groupId ? `/member/groups/${props.groupId}/orders` : "/member/orders"}
        backLabel={props.groupId ? "回群組歷史訂單" : "回訂單紀錄"}
        action={order.status === "merchant_completed" && !props.groupId ? (
          <Button disabled={pending} onClick={handleConfirm}>確認接收</Button>
        ) : undefined}
      />
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
