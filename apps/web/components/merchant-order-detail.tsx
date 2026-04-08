"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  acceptMerchantOrder,
  completeMerchantOrder,
  fetchContractInfo,
  fetchMerchantDashboard,
  type ContractInfo,
  type Order
} from "@/lib/api";
import { ESCROW_ABI, ensureSepoliaClients, isUsableContractAddress, toFriendlyWalletError } from "@/lib/chain";

function formatWei(value: string | number) {
  const amount = BigInt(typeof value === "number" ? value : value || "0");
  const integer = amount / 10n ** 18n;
  const fraction = amount % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${integer.toString()}${fractionText ? `.${fractionText}` : ""} ETH`;
}

export function MerchantOrderDetail({ orderId }: { orderId: number }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  async function refresh() {
    const [dashboard, contract] = await Promise.all([fetchMerchantDashboard(), fetchContractInfo().catch(() => null)]);
    setOrders(dashboard.orders);
    setContractInfo(contract);
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取訂單失敗"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const order = useMemo(() => orders.find((item) => item.id === orderId) || null, [orderId, orders]);

  async function handleAccept() {
    if (!order) return;
    setPending(true);
    try {
      if (order.escrowOrderId && isUsableContractAddress(contractInfo?.orderEscrowContract)) {
        const { walletClient, publicClient, account } = await ensureSepoliaClients();
        const txHash = await walletClient.writeContract({
          address: contractInfo!.orderEscrowContract as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: "merchantAccept",
          args: [BigInt(order.escrowOrderId)],
          account,
          chain: walletClient.chain
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      await acceptMerchantOrder(order.id);
      await refresh();
      setMessage("訂單已確認接收。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "接單未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  async function handleComplete() {
    if (!order) return;
    setPending(true);
    try {
      if (order.escrowOrderId && isUsableContractAddress(contractInfo?.orderEscrowContract)) {
        const { walletClient, publicClient, account } = await ensureSepoliaClients();
        const txHash = await walletClient.writeContract({
          address: contractInfo!.orderEscrowContract as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: "merchantComplete",
          args: [BigInt(order.escrowOrderId)],
          account,
          chain: walletClient.chain
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      await completeMerchantOrder(order.id);
      await refresh();
      setMessage("已標記為製作完成，等待會員確認。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "更新訂單未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入訂單詳細資料...</div>;
  }

  if (!order) {
    return (
      <section className="meal-panel p-8">
        <h1>找不到這筆訂單</h1>
        <p className="mt-3 text-sm text-muted-foreground">可能這筆訂單不屬於目前登入的店家，或是已不存在。</p>
        <Button asChild className="mt-4">
          <Link href="/merchant">回訂單工作台</Link>
        </Button>
      </section>
    );
  }

  const timeline = buildTimeline(order);

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="meal-kicker">Order detail</p>
            <h1 className="text-3xl font-extrabold">訂單 #{order.id}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("zh-TW")} • {formatOrderStatus(order.status)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="ghost">
              <Link href="/merchant">回訂單工作台</Link>
            </Button>
            {order.status === "payment_received" || order.status === "paid_local" || order.status === "paid_onchain" ? (
              <Button disabled={pending} onClick={handleAccept}>接收訂單</Button>
            ) : null}
            {order.status === "merchant_accepted" ? (
              <Button variant="secondary" disabled={pending} onClick={handleComplete}>標記已做完</Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="meal-panel p-8">
          <p className="meal-kicker">Summary</p>
          <div className="mt-6 space-y-4 text-sm">
            <InfoRow label="訂購會員" value={order.memberName} />
            <InfoRow label="訂單金額" value={formatWei(order.amountWei)} />
            <div className="rounded-[1.2rem] border border-border bg-background/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">目前狀態</p>
              <p className="mt-2 text-foreground">{formatOrderStatus(order.status)}</p>
              <div className="mt-4 border-t border-border/70 pt-4">
                <button
                  type="button"
                  onClick={() => setTimelineExpanded((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 rounded-[1rem] border border-border bg-white/70 px-4 py-3 text-left transition hover:border-[rgba(148,74,0,0.24)]"
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">狀態時間軸</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {timelineExpanded ? "收合完整歷程" : "展開查看所有狀態時間點"}
                    </p>
                  </div>
                  {timelineExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {timelineExpanded ? (
                  <div className="mt-4 space-y-3">
                    <TimelineRow label="會員完成付款" time={timeline.createdAt} />
                    <TimelineRow label="店家接單" time={timeline.acceptedAt} />
                    <TimelineRow label="店家標記已製作完成" time={timeline.completedAt} />
                    <TimelineRow label="會員確認已接收" time={timeline.confirmedAt} />
                    <TimelineRow label="平台完成撥款" time={timeline.paidOutAt} />
                  </div>
                ) : null}
              </div>
            </div>
            <InfoRow label="訂單雜湊" value={order.orderHash} breakAll />
          </div>
        </div>

        <div className="meal-panel p-8">
          <p className="meal-kicker">Items</p>
          <h2 className="text-2xl font-extrabold">餐點明細</h2>
          <div className="mt-6 space-y-3">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.menuItemId}`} className="rounded-[1.3rem] border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.menuItemId}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">x{item.quantity}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatWei(item.priceWei)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}

function InfoRow({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="rounded-[1.2rem] border border-border bg-background/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-foreground ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function formatOrderStatus(status: string) {
  switch (status) {
    case "payment_received":
    case "paid_local":
    case "paid_onchain":
      return "付款完成，待接單";
    case "merchant_accepted":
      return "已接單 / 製作中";
    case "merchant_completed":
      return "已製作完成 / 待會員確認接收";
    case "ready_for_payout":
      return "待平台撥款";
    case "platform_paid":
      return "已完成訂單";
    default:
      return status;
  }
}

function TimelineRow({ label, time }: { label: string; time?: string }) {
  return (
    <div className="rounded-[1rem] border border-border bg-white/70 p-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm text-foreground">{time ? new Date(time).toLocaleString("zh-TW") : "尚未到達這個階段"}</p>
    </div>
  );
}

function buildTimeline(order: Order) {
  const createdAt = order.createdAt;
  const acceptedAt =
    order.acceptedAt ||
    (order.status === "merchant_accepted" || order.status === "merchant_completed" || order.status === "ready_for_payout" || order.status === "platform_paid"
      ? createdAt
      : undefined);
  const completedAt =
    order.completedAt ||
    (order.status === "merchant_completed" || order.status === "ready_for_payout" || order.status === "platform_paid"
      ? acceptedAt || createdAt
      : undefined);
  const confirmedAt =
    order.confirmedAt ||
    (order.status === "ready_for_payout" || order.status === "platform_paid"
      ? completedAt || acceptedAt || createdAt
      : undefined);
  const paidOutAt =
    order.paidOutAt ||
    (order.status === "platform_paid"
      ? confirmedAt || completedAt || acceptedAt || createdAt
      : undefined);

  return { createdAt, acceptedAt, completedAt, confirmedAt, paidOutAt };
}
