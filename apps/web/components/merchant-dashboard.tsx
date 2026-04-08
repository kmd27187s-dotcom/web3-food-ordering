"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  acceptMerchantOrder,
  completeMerchantOrder,
  fetchContractInfo,
  fetchMe,
  fetchMerchantDashboard,
  upsertMerchantProfile,
  type ContractInfo,
  type MerchantDashboard as MerchantDashboardData,
  type Member
} from "@/lib/api";
import { toFriendlyWalletError } from "@/lib/chain";

function formatWei(value: string | number) {
  const amount = BigInt(typeof value === "number" ? value : value || "0");
  const integer = amount / 10n ** 18n;
  const fraction = amount % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${integer.toString()}${fractionText ? `.${fractionText}` : ""} ETH`;
}

const statusMeta = {
  all: "全部訂單",
  pending: "待接單",
  accepted: "已接單 / 製作中",
  completed: "已製作完成 / 待會員確認接收",
  payout: "待平台撥款",
  settled: "已完成訂單"
} as const;

export function MerchantDashboard() {
  const [member, setMember] = useState<Member | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [data, setData] = useState<MerchantDashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [activeOrderFilter, setActiveOrderFilter] = useState<"all" | "pending" | "accepted" | "completed" | "payout" | "settled">("all");
  const [profileForm, setProfileForm] = useState({
    name: "",
    address: "",
    description: ""
  });

  async function refresh() {
    const [me, dashboard, contract] = await Promise.all([fetchMe(), fetchMerchantDashboard(), fetchContractInfo().catch(() => null)]);
    setMember(me);
    setData(dashboard);
    setContractInfo(contract);
    if (dashboard.merchant) {
      setProfileForm({
        name: dashboard.merchant.name || "",
        address: dashboard.merchant.address || "",
        description: dashboard.merchant.description || ""
      });
    }
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpsertProfile() {
    setPending(true);
    try {
      const merchant = await upsertMerchantProfile(profileForm);
      setData((current) => ({
        merchant,
        orders: current?.orders || [],
        menuChangeRequests: current?.menuChangeRequests || [],
        acceptedOrderCount: current?.acceptedOrderCount || 0,
        pendingOrderCount: current?.pendingOrderCount || 0,
        completedOrderCount: current?.completedOrderCount || 0,
        totalOrderCount: current?.totalOrderCount || 0,
        totalRevenueWei: current?.totalRevenueWei || "0"
      }));
      setMessage("店家資訊已儲存，之後可在店家資訊頁持續更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存店家資料失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleAccept(orderId: number) {
    setPending(true);
    try {
      await acceptMerchantOrder(orderId);
      await refresh();
      setMessage("訂單已確認接收。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "接單未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  async function handleComplete(orderId: number) {
    setPending(true);
    try {
      await completeMerchantOrder(orderId);
      await refresh();
      setMessage("已標記為製作完成，等待會員確認。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "更新訂單未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入店家資料...</div>;
  }

  if (!member) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">請先登入會員並連接店家錢包。</div>;
  }

  if (!data?.merchant) {
    return (
      <section className="space-y-6">
        <div className="meal-panel p-8">
          <p className="meal-kicker">Merchant onboarding</p>
          <h1>建立你的店家資訊</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            先建立店名、地址與店家介紹。收款錢包會直接使用你目前登入的小狐狸地址：{member.walletAddress || "未綁定"}。
          </p>
        </div>
        <section className="meal-panel p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="店家名稱 (必填)">
              <input
                className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：巷口便當（必填）"
              />
            </Field>
            <Field label="店家地址 (必填)">
              <input
                className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                value={profileForm.address}
                onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="例如：台北市信義區市府路 1 號（必填）"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="店家介紹 (必填)">
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3"
                  value={profileForm.description}
                  onChange={(event) => setProfileForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="簡單介紹菜系、特色或營業時段（必填）"
                />
              </Field>
            </div>
          </div>
          <Button
            className="mt-5"
            disabled={pending || !profileForm.name.trim() || !profileForm.address.trim() || !profileForm.description.trim()}
            onClick={handleUpsertProfile}
          >
            建立店家
          </Button>
        </section>
        {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </section>
    );
  }

  const filteredOrders = data.orders.filter((order) => matchesOrderFilter(order.status, activeOrderFilter));
  const awaitingMemberCount = data.orders.filter((order) => order.status === "merchant_completed").length;
  const payoutCount = data.orders.filter((order) => order.status === "ready_for_payout").length;
  const settledCount = data.orders.filter((order) => order.status === "platform_paid").length;
  const statusTabs = [
    { id: "all", label: "全部訂單", count: data.orders.length },
    { id: "pending", label: "待接單", count: data.pendingOrderCount },
    { id: "accepted", label: "已接單 / 製作中", count: data.acceptedOrderCount },
    { id: "completed", label: "已製作完成 / 待會員確認接收", count: awaitingMemberCount },
    { id: "payout", label: "待平台撥款", count: payoutCount },
    { id: "settled", label: "已完成訂單", count: settledCount }
  ] as const;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="meal-kicker">Merchant workspace</p>
            <h1 className="text-3xl font-extrabold">{data.merchant.name}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              先確認店家資訊，再處理訂單工作台。菜單新增、修改、刪除送審請到獨立的菜單管理頁。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="ghost">
              <Link href="/merchant/profile">店家資訊</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/merchant/menu">前往菜單管理</Link>
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="店家地址" value={data.merchant.address || "尚未填寫"} />
          <InfoCard label="收款錢包" value={data.merchant.payoutAddress || "尚未綁定"} breakAll />
          <InfoCard label="菜單品項" value={`${data.merchant.menu.length} 項`} />
          <InfoCard label="店家介紹" value={data.merchant.description || "尚未填寫"} />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveOrderFilter(tab.id)}
              className={`rounded-[1.3rem] border p-4 text-left transition ${
                activeOrderFilter === tab.id
                  ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,255,255,0.9)] shadow-[0_10px_24px_rgba(148,74,0,0.08)]"
                  : "border-border bg-background/70 hover:border-[rgba(148,74,0,0.24)]"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{tab.label}</p>
              <p className="mt-3 text-2xl font-extrabold text-foreground">{tab.count}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="meal-panel p-8">
        <p className="meal-kicker">Orders</p>
        <h2 className="text-2xl font-extrabold">{statusMeta[activeOrderFilter]}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          先看訂單編號、金額與狀態；點進去訂單詳情頁後，再處理會員、餐點明細與接單操作。
        </p>
          <div className="mt-6 space-y-4">
            {filteredOrders.length === 0 ? <p className="text-sm text-muted-foreground">這個狀態目前沒有訂單。</p> : null}
            {filteredOrders.map((order) => (
              <div key={order.id} className="rounded-[1.4rem] border border-border bg-background/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">訂單 #{order.id}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString("zh-TW")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatWei(order.amountWei)}</p>
                    <p className="text-sm text-muted-foreground">{formatOrderStatus(order.status)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button asChild variant="secondary">
                    <Link href={`/merchant/orders/${order.id}`}>查看詳細資料</Link>
                  </Button>
                  {order.status === "payment_received" || order.status === "paid_local" || order.status === "paid_onchain" ? (
                    <Button disabled={pending} onClick={() => handleAccept(order.id)}>
                      接收訂單
                    </Button>
                  ) : null}
                  {order.status === "merchant_accepted" ? (
                    <Button variant="secondary" disabled={pending} onClick={() => handleComplete(order.id)}>
                      標記已做完
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="rounded-[1.3rem] border border-border bg-background/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-3 text-sm text-foreground ${breakAll ? "break-all" : ""}`}>{value}</p>
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
      return "已接單，製作中";
    case "merchant_completed":
      return "已製作完成 / 待會員確認接收";
    case "ready_for_payout":
      return "會員已確認，撥款中";
    case "platform_paid":
      return "平台已撥款完成";
    default:
      return status;
  }
}

function matchesOrderFilter(
  status: string,
  filter: "all" | "pending" | "accepted" | "completed" | "payout" | "settled"
) {
  if (filter === "settled") {
    return status === "platform_paid";
  }
  switch (filter) {
    case "pending":
      return status === "payment_received" || status === "paid_local" || status === "paid_onchain";
    case "accepted":
      return status === "merchant_accepted";
    case "completed":
      return status === "merchant_completed";
    case "payout":
      return status === "ready_for_payout";
    default:
      return true;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-background/70 p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}
