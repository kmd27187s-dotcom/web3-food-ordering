import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MerchantDetailView } from "@/components/merchant-detail-view";
import { SessionGate } from "@/components/session-gate";

export default async function MemberMerchantDetailPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">MealVote / Merchant Detail</Link>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MerchantDetailView merchantId={merchantId} />
      </SessionGate>
    </main>
  );
}
