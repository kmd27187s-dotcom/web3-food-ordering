"use client";

import Link from "next/link";
import { CreditCard, FolderKanban, Gift, Settings, Store, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { claimTickets, fetchGroups, fetchMe, fetchMyOrderHistory, fetchProposals, type Group, type Member, type MemberOrderHistory, type Proposal } from "@/lib/api";

type DashboardState = {
  member: Member | null;
  groups: Group[];
  orderHistory: MemberOrderHistory | null;
  proposals: Proposal[];
};

export function MemberDashboard({ openSubscribe = false }: { openSubscribe?: boolean }) {
  const [state, setState] = useState<DashboardState>({ member: null, groups: [], orderHistory: null, proposals: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(openSubscribe ? "請先開通月訂閱。" : "");
  const [pending, setPending] = useState(false);

  async function refresh() {
    return Promise.all([fetchMe(), fetchGroups().catch(() => []), fetchMyOrderHistory().catch(() => ({ orders: [] })), fetchProposals().catch(() => [])])
      .then(([member, groups, orderHistory, proposals]) => {
        setState({ member, groups, orderHistory, proposals });
      });
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "目前無法讀取會員資料"))
      .finally(() => setLoading(false));
  }, [openSubscribe]);

  async function handleClaimTickets() {
    setPending(true);
    try {
      const result = await claimTickets();
      setState((current) => ({
        ...current,
        member: result.member
      }));
      await refresh();
      setMessage(`已領取提案券 ${result.claimedProposalTickets} 張、投票券 ${result.claimedVoteTickets} 張、建立訂單券 ${result.claimedCreateOrderTickets} 張。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "領券失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入會員中心...</div>;
  }

  if (!state.member) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">找不到會員 session，請重新登入。</div>;
  }

  const activeProposalCount = state.proposals.filter((proposal) => ["proposing", "voting", "ordering"].includes(proposal.status)).length;

  return (
    <div className="space-y-6">
      <section className="meal-panel grid gap-6 p-8 md:grid-cols-[1fr_0.95fr]">
        <div className="space-y-5">
          <div className="meal-section-heading max-w-none">
            <p className="meal-kicker">Member hub</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1>{state.member.displayName}</h1>
              <Link href="/member/account" className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/40">
                <Settings className="h-4 w-4" />
                會員資訊
              </Link>
            </div>
            <p className="break-all">{state.member.walletAddress || "尚未綁定錢包地址"}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Stat label="積分" value={`${state.member.points} pts`} />
            <Stat label="Token" value={`${state.member.tokenBalance}`} />
            <LinkedStat label="參與群組數" value={`${state.groups.length}`} href="/member/groups" />
            <LinkedStat label="訂單紀錄" value={`${state.orderHistory?.orders.length || 0}`} href="/member/orders" />
            <LinkedStat label="成立中訂單數" value={`${activeProposalCount}`} href="/member/ongoing-orders" />
            <LinkedStat label="提案券" value={`${state.member.proposalTicketCount} 張`} href="/records?tab=proposal-ticket" />
            <LinkedStat label="投票券" value={`${state.member.voteTicketCount} 張`} href="/records?tab=vote-ticket" />
            <LinkedStat label="建立訂單券" value={`${state.member.createOrderTicketCount} 張`} href="/records?tab=create-order-ticket" />
            <LinkedStat label="個人邀請碼" value={state.member.registrationInviteCode || "尚未產生"} href="/records?tab=invite" />
          </div>
        </div>

        <div className="meal-glass-card rounded-[1.75rem] p-6">
          <p className="meal-kicker">Status</p>
          <div className="mt-5 grid gap-4">
            <LinkedStat label="訂閱狀態" value={state.member.subscriptionActive ? "已訂閱" : "尚未訂閱成為會員"} href="/member/subscription" />
            <Stat label="待領提案券" value={`${state.member.claimableProposalTickets} 張`} />
            <Stat label="待領投票券" value={`${state.member.claimableVoteTickets} 張`} />
            <Stat label="待領建立訂單券" value={`${state.member.claimableCreateOrderTickets} 張`} />
            <Stat
              label="訂閱到期"
              value={state.member.subscriptionExpiresAt ? new Date(state.member.subscriptionExpiresAt).toLocaleString("zh-TW") : "尚未開通"}
            />
          </div>
          <button
            type="button"
            onClick={handleClaimTickets}
            disabled={pending || (state.member.claimableProposalTickets <= 0 && state.member.claimableVoteTickets <= 0 && state.member.claimableCreateOrderTickets <= 0)}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Gift className="h-4 w-4" />
            {pending ? "領取中..." : "領取今日券"}
          </button>
        </div>
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}

function LinkedStat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="meal-stat transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </Link>
  );
}
