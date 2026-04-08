"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchGroups, fetchProposals, type Group, type Proposal } from "@/lib/api";

export function MemberOngoingOrdersView() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    Promise.all([fetchGroups(), fetchProposals()])
      .then(([nextGroups, nextProposals]) => {
        setGroups(nextGroups);
        setProposals(nextProposals);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取成立中訂單失敗"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      Promise.all([fetchGroups(), fetchProposals()])
        .then(([nextGroups, nextProposals]) => {
          setGroups(nextGroups);
          setProposals(nextProposals);
        })
        .catch(() => null);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const groupIds = new Set(groups.map((group) => group.id));
  const active = useMemo(
    () => proposals.filter((proposal) => groupIds.has(proposal.groupId) && ["proposing", "voting", "ordering"].includes(proposal.status)),
    [proposals, groups]
  );
  const sections = [
    { key: "proposing", label: "店家提案階段", href: "/member/ordering/proposals" },
    { key: "voting", label: "投票階段", href: "/member/ordering/voting" },
    { key: "ordering", label: "點餐階段", href: "/member/ordering/ordering" }
  ] as const;

  if (loading) return <div className="meal-panel p-8">正在載入成立中訂單...</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Ongoing orders</p>
        <h1 className="text-3xl font-extrabold">成立中訂單</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">這裡會列出你目前參與群組中，正在進行店家提案、投票或點餐的所有訂單。</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <Link key={section.key} href={section.href} className="meal-stat transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{section.label}</p>
              <p className="mt-2 text-base font-semibold">{active.filter((proposal) => proposal.status === section.key).length} 筆</p>
            </Link>
          ))}
        </div>
      </section>

      {sections.map((section) => {
        const items = active.filter((proposal) => proposal.status === section.key);
        return (
          <section key={section.key} className="meal-panel p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="meal-kicker">Stage</p>
                <h2 className="text-2xl font-extrabold">{section.label}</h2>
              </div>
              <Link href={section.href} className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-primary">
                進入該階段
              </Link>
            </div>
            <div className="mt-6 space-y-3">
              {items.length ? items.map((proposal) => (
                <div key={proposal.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{proposal.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">群組編號：{proposal.groupId} · 提案店家數：{proposal.options.length}</p>
                      <p className="mt-1 text-sm text-[hsl(25_85%_36%)]">
                        {section.key === "proposing"
                          ? `剩餘提案時間：${formatCountdown(proposal.proposalDeadline, now)}`
                          : section.key === "voting"
                            ? `剩餘投票時間：${formatCountdown(proposal.voteDeadline, now)}`
                            : `剩餘點餐時間：${formatCountdown(proposal.orderDeadline, now)}`}
                      </p>
                    </div>
                    <Link href={`${section.href}/${proposal.id}`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary">詳細資訊</Link>
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">目前沒有這個階段的成立中訂單。</p>}
            </div>
          </section>
        );
      })}

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

function formatCountdown(deadline: string | Date, now: number) {
  const target = new Date(deadline).getTime();
  const diff = Math.max(0, target - now);
  if (!Number.isFinite(target) || diff <= 0) return "已截止";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return days > 0 ? `${days} 天 ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}
