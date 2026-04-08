"use client";

import { useEffect, useState } from "react";

import { fetchGroups, fetchMe, type Group, type Member } from "@/lib/api";

export function MemberOrderingHeader() {
  const [member, setMember] = useState<Member | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    Promise.all([fetchMe(), fetchGroups().catch(() => [])])
      .then(([nextMember, nextGroups]) => {
        setMember(nextMember);
        setGroups(nextGroups);
      })
      .catch(() => undefined);
  }, []);

  return (
    <section className="meal-panel grid gap-6 p-8 md:grid-cols-[1fr_0.95fr]">
      <div className="meal-section-heading max-w-none">
        <p className="meal-kicker">Ordering workspace</p>
        <h1>建立訂單工作台</h1>
        <p>每個階段都有獨立頁面，先看清單，再點進詳細資訊操作。</p>
      </div>

      <div className="meal-glass-card rounded-[1.75rem] p-6">
        <p className="meal-kicker">Status</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Stat label="我的提案優惠券" value={`${member?.proposalCouponCount || 0} 張`} />
          <Stat label="待領提案優惠券" value={`${member?.claimableProposalCoupons || 0} 張`} />
          <Stat label="我的投票優惠券" value={`${member?.voteCouponCount || 0} 張`} />
          <Stat label="待領投票優惠券" value={`${member?.claimableVoteCoupons || 0} 張`} />
          <Stat label="我的建立訂單優惠券" value={`${member?.createOrderCouponCount || 0} 張`} />
          <Stat label="待領建立訂單優惠券" value={`${member?.claimableCreateOrderCoupons || 0} 張`} />
          <Stat label="我的積分" value={`${member?.points || 0} pts`} />
          <Stat label="參與群組數" value={`${groups.length} 個`} />
          <Stat label="訂閱狀態" value={member?.subscriptionActive ? "已訂閱" : "尚未訂閱成為會員"} />
        </div>
      </div>
    </section>
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
