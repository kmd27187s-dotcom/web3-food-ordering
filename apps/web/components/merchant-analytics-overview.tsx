"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchMerchantDashboard, type MerchantDashboard as MerchantDashboardData } from "@/lib/api";

function formatWei(value: bigint) {
  const integer = value / 10n ** 18n;
  const fraction = value % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${integer.toString()}${fractionText ? `.${fractionText}` : ""} ETH`;
}

export function MerchantAnalyticsOverview() {
  const [dashboard, setDashboard] = useState<MerchantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchMerchantDashboard()
      .then(setDashboard)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取營運分析失敗"))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const paidOrders = (dashboard?.orders || []).filter((order) => order.status === "platform_paid");
    const sevenDays = paidOrders.filter((order) => now - new Date(order.paidOutAt || order.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000);
    const thirtyDays = paidOrders.filter((order) => now - new Date(order.paidOutAt || order.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000);
    const ninetyDays = paidOrders.filter((order) => now - new Date(order.paidOutAt || order.createdAt).getTime() <= 90 * 24 * 60 * 60 * 1000);

    function sumAmount(orders: typeof paidOrders) {
      return orders.reduce((total, order) => total + BigInt(order.amountWei || "0"), 0n);
    }

    return {
      allRevenue: sumAmount(paidOrders),
      sevenDayRevenue: sumAmount(sevenDays),
      thirtyDayRevenue: sumAmount(thirtyDays),
      ninetyDayRevenue: sumAmount(ninetyDays),
      allCount: paidOrders.length,
      sevenDayCount: sevenDays.length,
      thirtyDayCount: thirtyDays.length,
      ninetyDayCount: ninetyDays.length
    };
  }, [dashboard]);

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入營運分析...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="meal-panel p-8">
        <p className="meal-kicker">Merchant analytics</p>
        <h1 className="text-3xl font-extrabold">營運分析</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          這裡會依時間區間整理目前店家的撥款後營收與訂單筆數，方便你快速看近期與長期營運狀況。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="近 7 天營收" value={formatWei(stats.sevenDayRevenue)} meta={`${stats.sevenDayCount} 筆已撥款訂單`} />
        <StatCard label="近 30 天營收" value={formatWei(stats.thirtyDayRevenue)} meta={`${stats.thirtyDayCount} 筆已撥款訂單`} />
        <StatCard label="近 90 天營收" value={formatWei(stats.ninetyDayRevenue)} meta={`${stats.ninetyDayCount} 筆已撥款訂單`} />
        <StatCard label="累積營收" value={formatWei(stats.allRevenue)} meta={`${stats.allCount} 筆已撥款訂單`} />
      </div>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </section>
  );
}

function StatCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="meal-panel p-6">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-extrabold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{meta}</p>
    </div>
  );
}
