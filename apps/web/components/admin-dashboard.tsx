"use client";

import Link from "next/link";
import { BarChart3, CreditCard, ScrollText, Store, Users, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchAdminDashboard, fetchMe, passwordLogin, setStoredToken, type AdminDashboard as AdminDashboardData, type Member } from "@/lib/api";

const statCards = [
  { key: "memberCount", label: "會員數", href: "/admin/metrics?view=members", icon: Users },
  { key: "groupCount", label: "群組數", href: "/admin/metrics?view=groups", icon: UsersRound },
  { key: "merchantCount", label: "店家數", href: "/admin/metrics?view=merchants", icon: Store },
  { key: "orderCount", label: "點餐次數", href: "/admin/metrics?view=orders", icon: CreditCard },
  { key: "dinerCount", label: "點餐人次", href: "/admin/metrics?view=diners", icon: BarChart3 },
  { key: "totalServings", label: "餐點份數", href: "/admin/metrics?view=servings", icon: ScrollText },
  { key: "pendingMenuReviews", label: "菜單待審", href: "/admin/menu-reviews", icon: ScrollText },
  { key: "pendingMerchantDelists", label: "下架待審", href: "/admin/merchant-delists", icon: Store }
] as const;

const adminActions = [
  {
    href: "/admin/metrics",
    title: "數據總覽",
    body: "查看會員、店家與訂單詳細資料。"
  },
  {
    href: "/admin/payouts",
    title: "平台錢包與撥款",
    body: "綁定平台中心錢包並處理待撥款訂單。"
  },
  {
    href: "/admin/menu-reviews",
    title: "菜單審核",
    body: "審核店家新增、修改、刪除菜單申請。"
  },
  {
    href: "/admin/merchant-delists",
    title: "下架審核",
    body: "處理店家送出的下架申請。"
  },
  {
    href: "/admin/settings",
    title: "治理參數設定",
    body: "設定建立訂單費、提案費、投票費、退款比例、積分與逾期時間。"
  }
] as const;

export function AdminDashboard() {
  const [member, setMember] = useState<Member | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "alice@example.com",
    password: "demo1234"
  });

  async function refresh() {
    const [me, dashboard] = await Promise.all([fetchMe(), fetchAdminDashboard()]);
    setMember(me);
    setData(dashboard);
  }

  useEffect(() => {
    refresh()
      .catch(() => {
        setMember(null);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin() {
    setPending(true);
    setMessage("");
    try {
      const result = await passwordLogin(credentials.email, credentials.password);
      setStoredToken(result.token);
      await refresh();
      setMessage("平台管理者登入成功。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入平台後台...</div>;
  }

  if (!member || !member.isAdmin || !data) {
    return (
      <section className="meal-panel max-w-2xl p-8">
        <p className="meal-kicker">Platform admin login</p>
        <h1>平台管理者登入</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">預設帳號：`alice@example.com`，密碼：`demo1234`。</p>
        <div className="mt-6 space-y-4">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">Email (必填)</span>
            <input className="meal-field" value={credentials.email} onChange={(event) => setCredentials((prev) => ({ ...prev, email: event.target.value }))} placeholder="請輸入 Email（必填）" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">Password (必填)</span>
            <input className="meal-field" type="password" value={credentials.password} onChange={(event) => setCredentials((prev) => ({ ...prev, password: event.target.value }))} placeholder="請輸入 Password（必填）" />
          </label>
          <Button disabled={pending} onClick={handleLogin}>登入後台</Button>
        </div>
        {message ? <p className="mt-4 text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {(() => {
        const governanceParams = data.governanceParams;
        return (
      <section className="meal-panel p-8">
        <p className="meal-kicker">Admin home</p>
        <h1 className="text-3xl font-extrabold">平台管理首頁</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          上方數據卡可直接點進詳細資料；平台錢包、撥款、菜單審核與下架審核都已拆到獨立頁面處理。
        </p>
        {governanceParams ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryStat label="建立訂單費" value={`${governanceParams.createFeeWei} Wei`} />
            <SummaryStat label="提案費" value={`${governanceParams.proposalFeeWei} Wei`} />
            <SummaryStat label="投票費" value={`${governanceParams.voteFeeWei} Wei / 票`} />
          </div>
        ) : null}
      </section>
        );
      })()}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = `${data[card.key]}`;
          return (
            <Link key={card.href} href={card.href} className="rounded-[1.4rem] border border-border bg-background/70 p-5 transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">{card.label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-3 text-2xl font-extrabold text-foreground">{value}</p>
              <p className="mt-2 text-sm text-muted-foreground">點擊查看詳細資料</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {adminActions.map((action) => (
          <Link key={action.href} href={action.href} className="meal-panel p-8 transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]">
            <p className="meal-kicker">Admin action</p>
            <h2 className="text-2xl font-extrabold">{action.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{action.body}</p>
          </Link>
        ))}
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
