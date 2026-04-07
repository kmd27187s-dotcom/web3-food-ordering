import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Store, Users } from "lucide-react";

import { AppNavCompact } from "@/components/app-nav";
import { LoginPanel } from "@/components/login-panel";
import { Button } from "@/components/ui/button";

const foundations = [
  ["Wallet", "MetaMask 登入"],
  ["Governance", "提案、投票、點餐"],
  ["Sepolia", "鏈上付款"]
] as const;

const heroNotes = [
  "提案階段先建立候選餐廳。",
  "投票階段用 token 權重決定方向。",
  "點餐階段直接跳 MetaMask 完成付款。"
] as const;

const roleCards = [
  {
    href: "/member",
    title: "會員入口",
    body: "治理、投票、點餐與紀錄。",
    icon: Users
  },
  {
    href: "/merchant",
    title: "店家入口",
    body: "連結錢包後接單、查看訂單、送審菜單。",
    icon: Store
  },
  {
    href: "/admin",
    title: "平台管理",
    body: "帳密登入看後台統計與菜單審核。",
    icon: ShieldCheck
  }
] as const;

export default function HomePage() {
  return (
    <main id="main-content" className="meal-shell">
      <div className="pointer-events-none absolute inset-0 meal-grid" />
      <div className="pointer-events-none absolute left-[-7rem] top-24 h-60 w-60 rounded-full bg-[rgba(194,119,60,0.13)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-5rem] right-[-3rem] h-72 w-72 rounded-full bg-[rgba(79,54,31,0.12)] blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-[88rem] flex-col px-6 py-8 md:px-10">
        <div className="relative z-30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="meal-hero-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_16px_28px_rgba(154,68,45,0.22)]">
              <span className="text-lg font-black">M</span>
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-primary">MealVote</p>
              <p className="mt-1 text-sm text-muted-foreground">辦公室去中心化訂餐系統</p>
            </div>
          </div>
          <AppNavCompact />
        </div>

        <section className="grid flex-1 items-center gap-14 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
          <div className="space-y-10 lg:pr-8">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-[rgba(220,193,177,0.45)] bg-white/70 px-4 py-1.5 text-[11px] font-black tracking-[0.26em] text-muted-foreground backdrop-blur">
                Blockchain secured dining
              </span>
              <div className="space-y-5">
                <p className="meal-kicker">Office dining, coordinated by consensus</p>
                <h1 className="max-w-4xl font-[var(--font-heading)] text-5xl font-extrabold tracking-[-0.05em] text-balance md:text-7xl">
                  用治理決定
                  <br />
                  今天吃什麼。
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">提案、投票、付款，一次完成。</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {foundations.map(([title, body]) => (
                <div key={title} className="meal-glass-card rounded-[1.6rem] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
                  <p className="mt-3 max-w-xs text-sm leading-7 text-foreground/80">{body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="secondary" className="rounded-full border border-[rgba(220,193,177,0.42)] bg-white/80 px-6 backdrop-blur hover:bg-white">
                <Link href="/member">
                  查看系統頁
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <span className="text-sm text-muted-foreground">未登入或未訂閱時會回入口。</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {roleCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.href} href={card.href} className="meal-glass-card rounded-[1.6rem] p-5 transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]">
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-primary" />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-4 text-lg font-bold text-foreground">{card.title}</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.body}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -top-12 -left-12 hidden h-64 w-64 rounded-full bg-[rgba(224,122,95,0.18)] blur-[100px] lg:block" />
            <div className="pointer-events-none absolute -bottom-12 -right-12 hidden h-64 w-64 rounded-full bg-[rgba(25,169,146,0.1)] blur-[100px] lg:block" />

            <div className="relative overflow-hidden rounded-[2rem] border-4 border-white/40 meal-ambient-shadow">
              <div className="meal-hero-gradient absolute inset-0 opacity-15" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.5),transparent_20rem),linear-gradient(180deg,rgba(255,248,245,0.28),rgba(154,68,45,0.08))]" />
              <div className="relative grid gap-6 p-6 xl:grid-cols-[1.08fr_0.92fr] xl:p-8">
                <div className="grid gap-6">
                  <div className="overflow-hidden rounded-[1.8rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.08)),url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center min-h-[24rem]">
                    <div className="flex h-full flex-col justify-between bg-[linear-gradient(180deg,rgba(34,27,22,0.14),rgba(34,27,22,0.68))] p-6 text-white">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.26em] text-white/75">Today&apos;s flow</p>
                        <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                          Wallet gated
                        </span>
                      </div>
                      <div>
                        <h2 className="max-w-md text-3xl font-extrabold tracking-[-0.04em]">登入後直接進入治理。</h2>
                        <div className="mt-5 space-y-3 text-sm text-white/85">
                          {heroNotes.map((item) => (
                            <div key={item} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="flex items-center">
                  <LoginPanel />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="relative z-10 pb-10">
          <div className="meal-glass-card rounded-[1.8rem] p-6 md:flex md:items-center md:justify-between">
            <div>
              <p className="meal-kicker">Platform admin preset</p>
              <h2 className="mt-2 text-2xl font-extrabold text-foreground">測試用平台管理者帳號已開好</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">帳號 `alice@example.com`，密碼 `demo1234`。登入後可進入平台儀表板審核店家菜單。</p>
            </div>
            <Button asChild className="mt-4 rounded-full px-6 md:mt-0">
              <Link href="/admin">進入平台管理</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
