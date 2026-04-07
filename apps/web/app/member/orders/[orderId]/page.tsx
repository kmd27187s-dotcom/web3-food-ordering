import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MemberOrderDetailView } from "@/components/member-order-detail";
import { SessionGate } from "@/components/session-gate";

export default async function MemberOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Member Order Detail</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberOrderDetailView orderId={Number(orderId)} />
      </SessionGate>
    </main>
  );
}
