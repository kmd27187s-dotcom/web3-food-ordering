"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchMe, fetchMerchantDashboard, fetchMerchantDetail, type Member, type MerchantDashboard as MerchantDashboardData, type MerchantDetail } from "@/lib/api";

function formatWei(value: string | number) {
  const amount = BigInt(typeof value === "number" ? value : value || "0");
  const integer = amount / 10n ** 18n;
  const fraction = amount % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${integer.toString()}${fractionText ? `.${fractionText}` : ""} ETH`;
}

function formatAggregateOrderStatus(statuses: string[]) {
  if (statuses.some((status) => status === "payment_received" || status === "paid_local" || status === "paid_onchain")) return "pending";
  if (statuses.some((status) => status === "merchant_accepted")) return "accepted";
  if (statuses.some((status) => status === "merchant_completed")) return "completed";
  if (statuses.some((status) => status === "ready_for_payout")) return "payout";
  if (statuses.every((status) => status === "platform_paid")) return "settled";
  return "all";
}

export function MerchantHomeOverview() {
  const [member, setMember] = useState<Member | null>(null);
  const [dashboard, setDashboard] = useState<MerchantDashboardData | null>(null);
  const [merchantDetail, setMerchantDetail] = useState<MerchantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const [me, merchantDashboard] = await Promise.all([fetchMe(), fetchMerchantDashboard()]);
      const detail = merchantDashboard.merchant?.id
        ? await fetchMerchantDetail(merchantDashboard.merchant.id).catch(() => null)
        : null;
      if (!active) return;
      setMember(me);
      setDashboard(merchantDashboard);
      setMerchantDetail(detail);
    }

    load()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家首頁失敗"))
      .finally(() => setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const groupedOrders = useMemo(() => {
    const safeOrders = dashboard?.orders || [];
    const grouped = new Map<number, { proposalId: number; statuses: string[] }>();
    safeOrders.forEach((order) => {
      const current = grouped.get(order.proposalId);
      if (current) {
        current.statuses.push(order.status);
        return;
      }
      grouped.set(order.proposalId, { proposalId: order.proposalId, statuses: [order.status] });
    });
    return Array.from(grouped.values()).map((group) => ({
      proposalId: group.proposalId,
      aggregateStatus: formatAggregateOrderStatus(group.statuses)
    }));
  }, [dashboard]);

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入店家首頁...</div>;
  }

  if (!member) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">請先登入會員並連接店家錢包。</div>;
  }

  if (!dashboard?.merchant) {
    return (
      <section className="meal-panel p-8">
        <p className="meal-kicker">Merchant onboarding</p>
        <h1 className="text-3xl font-extrabold">尚未建立店家資訊</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">先建立店家名稱、地址與介紹，之後再開始管理訂單工作台與菜單。</p>
        <div className="mt-5">
          <Link
            href="/merchant/profile"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/40"
          >
            <Settings className="h-4 w-4" />
            前往建立店家資訊
          </Link>
        </div>
      </section>
    );
  }

  const totalOrders = groupedOrders.length;
  const pendingOrders = groupedOrders.filter((order) => order.aggregateStatus === "pending").length;
  const acceptedOrders = groupedOrders.filter((order) => order.aggregateStatus === "accepted").length;
  const completedOrders = groupedOrders.filter((order) => order.aggregateStatus === "completed").length;
  const payoutOrders = groupedOrders.filter((order) => order.aggregateStatus === "payout").length;
  const settledOrders = groupedOrders.filter((order) => order.aggregateStatus === "settled").length;

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="meal-panel p-8">
          <p className="meal-kicker">Merchant workspace</p>
          <h1 className="text-3xl font-extrabold">訂單工作台</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            左側統計卡都可直接點進訂單工作台獨立頁，快速查看待接單、製作中、待確認與待撥款的整筆訂單。
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <LinkedStat label="全部訂單" value={`${totalOrders}`} href="/merchant/orders" />
            <LinkedStat label="待接單" value={`${pendingOrders}`} href="/merchant/orders?status=pending" />
            <LinkedStat label="製作中" value={`${acceptedOrders}`} href="/merchant/orders?status=accepted" />
            <LinkedStat label="待確認接收" value={`${completedOrders}`} href="/merchant/orders?status=completed" />
            <LinkedStat label="待平台撥款" value={`${payoutOrders}`} href="/merchant/orders?status=payout" />
            <LinkedStat label="已完成訂單" value={`${settledOrders}`} href="/merchant/orders?status=settled" />
          </div>
        </section>

        <section className="meal-panel p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="meal-kicker">Merchant profile</p>
              <h2 className="text-3xl font-extrabold">{dashboard.merchant.name}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                這裡只顯示店家基本資訊與營運概況。若要修改店名、地址、介紹與收款錢包，請從右側按鈕進入店家資訊頁。
              </p>
            </div>
            <Link
              href="/merchant/profile"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/40"
            >
              <Settings className="h-4 w-4" />
              編輯店家資訊
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <InfoCard label="店家地址" value={dashboard.merchant.address || "尚未填寫"} />
            <InfoCard label="收款錢包" value={dashboard.merchant.payoutAddress || "尚未綁定"} breakAll />
            <InfoCard
              label="目前菜單品項"
              value={`${dashboard.merchant.menu.length} 項`}
              href="/merchant/menu"
              hint="前往菜單管理"
            />
            <InfoCard
              label="累積營業額"
              value={formatWei(dashboard.totalRevenueWei || "0")}
              href="/merchant/analytics"
              hint="查看營運分析"
            />
            <InfoCard
              label="平均星等"
              value={`${(merchantDetail?.merchant.averageRating || 0).toFixed(1)} / 5`}
              href="/merchant/reviews"
              hint="查看評分留言"
            />
            <InfoCard
              label="留言數"
              value={`${merchantDetail?.merchant.reviewCount || 0} 則`}
              href="/merchant/reviews"
              hint="查看評分留言"
            />
          </div>
          <div className="mt-5 rounded-[1.3rem] border border-border bg-background/70 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">店家介紹</p>
            <p className="mt-3 text-sm leading-7 text-foreground">{dashboard.merchant.description || "尚未填寫"}</p>
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </section>
  );
}

function InfoCard({
  label,
  value,
  breakAll = false,
  href,
  hint
}: {
  label: string;
  value: string;
  breakAll?: boolean;
  href?: string;
  hint?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-3 text-sm text-foreground ${breakAll ? "break-all" : ""}`}>{value}</p>
      {hint ? <p className="mt-3 text-xs font-semibold text-primary">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="rounded-[1.3rem] border border-border bg-background/70 p-4 transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]">
        {content}
      </Link>
    );
  }

  return <div className="rounded-[1.3rem] border border-border bg-background/70 p-4">{content}</div>;
}

function LinkedStat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-[1.3rem] border border-border bg-background/70 p-4 transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]"
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-extrabold text-foreground">{value}</p>
    </Link>
  );
}
