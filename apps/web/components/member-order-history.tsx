"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { confirmMemberOrder, fetchContractInfo, fetchMyOrderHistory, type ContractInfo, type MemberOrderHistory } from "@/lib/api";
import { toFriendlyWalletError } from "@/lib/chain";
import { OrderSummaryCard } from "@/components/member-order-shared";

export function MemberOrderHistoryView() {
  const [history, setHistory] = useState<MemberOrderHistory | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  async function refresh() {
    const [nextHistory, contract] = await Promise.all([fetchMyOrderHistory(), fetchContractInfo().catch(() => null)]);
    setHistory(nextHistory);
    setContractInfo(contract);
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取訂單紀錄失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm(orderId: number) {
    setPending(true);
    try {
      await confirmMemberOrder(orderId);
      await refresh();
      setMessage("已確認接收訂單。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "確認收貨未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入訂單紀錄...</div>;
  if (!history) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到訂單資料"}</div>;

  const sortedOrders = [...history.orders].sort((left, right) => {
    switch (sortBy) {
      case "oldest":
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      case "amount_desc":
        return BigInt(right.amountWei || "0") > BigInt(left.amountWei || "0") ? 1 : BigInt(right.amountWei || "0") < BigInt(left.amountWei || "0") ? -1 : 0;
      case "status":
        return left.status.localeCompare(right.status, "zh-TW");
      case "id_asc":
        return left.id - right.id;
      case "id_desc":
        return right.id - left.id;
      case "newest":
      default:
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
  });

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Order history</p>
        <h1 className="text-3xl font-extrabold">訂單紀錄</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">先顯示歷史訂單，再展開每張訂單的店家、金額、狀態與餐點明細。</p>
      </section>

      <section className="space-y-4">
        <div className="max-w-xs">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">排序方式</span>
            <select className="meal-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="newest">依建立時間新到舊</option>
              <option value="oldest">依建立時間舊到新</option>
              <option value="amount_desc">依金額高到低</option>
              <option value="status">依狀態排序</option>
              <option value="id_desc">依 ID 大到小</option>
              <option value="id_asc">依 ID 小到大</option>
            </select>
          </label>
        </div>
        {history.orders.length === 0 ? <div className="meal-panel p-8 text-sm text-muted-foreground">目前沒有歷史訂單。</div> : null}
        {sortedOrders.map((order) => (
          <OrderSummaryCard
            key={order.id}
            order={order}
            detailHref={`/member/orders/${order.id}`}
            action={order.status === "merchant_completed" ? (
              <Button onClick={() => handleConfirm(order.id)} disabled={pending}>確認接收</Button>
            ) : undefined}
          />
        ))}
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
