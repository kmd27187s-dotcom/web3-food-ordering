import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MemberOrderDetailView } from "@/components/member-order-detail";
import { SessionGate } from "@/components/session-gate";

export default async function MemberGroupOrderDetailPage({ params }: { params: Promise<{ groupId: string; orderId: string }> }) {
  const { groupId, orderId } = await params;
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">MealVote / Group Order Detail</Link>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberOrderDetailView groupId={Number(groupId)} orderId={Number(orderId)} />
      </SessionGate>
    </main>
  );
}
