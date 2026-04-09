"use client";

import Link from "next/link";
import { Gift, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  claimTickets,
  fetchGroups,
  fetchMe,
  fetchMyOrderHistory,
  fetchProposals,
  type Group,
  type Member,
  type MemberOrderHistory,
  type Proposal
} from "@/lib/api";
import { getAvailableMemberPoints, getCurrentMemberTitle } from "@/lib/achievement-demo";

type DashboardState = {
  member: Member | null;
  groups: Group[];
  orderHistory: MemberOrderHistory | null;
  proposals: Proposal[];
};

export function MemberDashboard({ openSubscribe = false }: { openSubscribe?: boolean }) {
  const pathname = usePathname();
  const [state, setState] = useState<DashboardState>({ member: null, groups: [], orderHistory: null, proposals: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(openSubscribe ? "可從這裡查看目前會員狀態。" : "");
  const [pending, setPending] = useState(false);
  const [demoTitle, setDemoTitle] = useState("");
  const [demoPoints, setDemoPoints] = useState(0);

  async function refresh() {
    const [memberResult, groupsResult, orderHistoryResult, proposalsResult] = await Promise.allSettled([
      fetchMe(),
      fetchGroups(),
      fetchMyOrderHistory(),
      fetchProposals()
    ]);

    if (memberResult.status !== "fulfilled") {
      throw memberResult.reason;
    }

    const groups = groupsResult.status === "fulfilled" ? groupsResult.value : [];
    const orderHistory = orderHistoryResult.status === "fulfilled" ? orderHistoryResult.value : { orders: [] };
    const proposals = proposalsResult.status === "fulfilled" ? proposalsResult.value : [];

    setState({
      member: memberResult.value,
      groups,
      orderHistory,
      proposals
    });
    setDemoTitle(getCurrentMemberTitle(memberResult.value.id));
    setDemoPoints(getAvailableMemberPoints(memberResult.value.id));

    const messages: string[] = [];
    if (groupsResult.status !== "fulfilled") messages.push("群組資料目前暫時無法更新。");
    if (orderHistoryResult.status !== "fulfilled") messages.push("訂單紀錄目前暫時無法更新。");
    if (proposalsResult.status !== "fulfilled") messages.push("提案資料目前暫時無法更新。");
    if (messages.length > 0) setMessage(messages.join(" "));
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取會員首頁資料失敗。"))
      .finally(() => setLoading(false));
  }, [openSubscribe, pathname]);

  async function handleClaimTickets() {
    setPending(true);
    try {
      const result = await claimTickets();
      setState((current) => ({
        ...current,
        member: result.member
      }));
      await refresh();
      setMessage(
        `已領取提案券 ${result.claimedProposalTickets} 張、投票券 ${result.claimedVoteTickets} 張、建立訂單券 ${result.claimedCreateOrderTickets} 張。`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "領取票券失敗。");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">讀取會員首頁資料中...</div>;
  }

  if (!state.member) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">目前沒有可用的會員資料。</div>;
  }

  const now = Date.now();
  const activeProposalCount = state.proposals.filter((proposal) => {
    if (proposal.status === "proposing" || proposal.status === "voting") return true;
    const hasWinner = proposal.options.some((option) => option.id === proposal.winnerOptionId);
    const deadline = new Date(proposal.orderDeadline).getTime();
    return hasWinner && Number.isFinite(deadline) && deadline > now;
  }).length;
  const submittedProposalCount = Array.from(
    new Set(
      state.proposals
        .filter((proposal) => {
          const hasWinner = proposal.options.some((option) => option.id === proposal.winnerOptionId);
          const deadlinePassed = new Date(proposal.orderDeadline).getTime() <= now;
          return hasWinner && deadlinePassed && proposal.orders.length > 0 && proposal.orders.some((order) => order.status !== "platform_paid");
        })
        .map((proposal) => proposal.id)
    )
  ).length;
  const historyProposalCount = Array.from(
    new Set((state.orderHistory?.orders || []).filter((order) => order.status === "platform_paid").map((order) => order.proposalId))
  ).length;

  return (
    <div className="space-y-6">
      <section className="meal-panel grid gap-6 p-8 md:grid-cols-[1fr_0.95fr]">
        <div className="space-y-5">
          <div className="meal-section-heading max-w-none">
            <p className="meal-kicker">Member hub</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1>{state.member.displayName}</h1>
              <Link
                href="/member/account"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/40"
              >
                <Settings className="h-4 w-4" />
                會員設定
              </Link>
            </div>
            <p className="text-sm font-semibold text-primary">{demoTitle || "尚未裝備勳章稱號"}</p>
            <p className="break-all">{state.member.walletAddress || "尚未綁定錢包地址"}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <LinkedStat label="勳章積分" value={`${demoPoints} pts`} href="/member/badges" />
            <LinkedStat label="群組數量" value={`${state.groups.length}`} href="/member/groups" />
            <LinkedStat label="訂單紀錄" value={`${state.orderHistory?.orders.length || 0}`} href="/member/orders" />
            <LinkedStat label="進行中提案" value={`${activeProposalCount}`} href="/member/ongoing-orders" />
            <LinkedStat label="待結算訂單" value={`${submittedProposalCount}`} href="/member/ordering/submitted" />
            <LinkedStat label="歷史訂單" value={`${historyProposalCount}`} href="/member/orders" />
            <LinkedStat label="提案券" value={`${state.member.proposalCouponCount} 張`} href="/records?tab=proposal-coupon" />
            <LinkedStat label="投票券" value={`${state.member.voteCouponCount} 張`} href="/records?tab=vote-coupon" />
            <LinkedStat label="建立訂單券" value={`${state.member.createOrderCouponCount} 張`} href="/records?tab=create-order-coupon" />
            <LinkedStat label="邀請碼" value={state.member.registrationInviteCode || "尚未產生"} href="/records?tab=invite" />
          </div>
        </div>

        <div className="meal-glass-card rounded-[1.75rem] p-6">
          <p className="meal-kicker">Status</p>
          <div className="mt-5 grid gap-4">
            <LinkedStat label="訂閱狀態" value={state.member.subscriptionActive ? "已啟用" : "尚未啟用"} href="/member/subscription" />
            <Stat label="可領取提案券" value={`${state.member.claimableProposalCoupons} 張`} />
            <Stat label="可領取投票券" value={`${state.member.claimableVoteCoupons} 張`} />
            <Stat label="可領取建立訂單券" value={`${state.member.claimableCreateOrderCoupons} 張`} />
            <Stat
              label="訂閱到期日"
              value={state.member.subscriptionExpiresAt ? new Date(state.member.subscriptionExpiresAt).toLocaleString("zh-TW") : "尚未啟用"}
            />
          </div>
          <button
            type="button"
            onClick={handleClaimTickets}
            disabled={pending || (state.member.claimableProposalCoupons <= 0 && state.member.claimableVoteCoupons <= 0 && state.member.claimableCreateOrderCoupons <= 0)}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Gift className="h-4 w-4" />
            {pending ? "領取中..." : "領取票券"}
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
