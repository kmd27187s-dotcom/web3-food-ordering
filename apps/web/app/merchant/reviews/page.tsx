import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MerchantReviewsManager } from "@/components/merchant-reviews-manager";
import { SessionGate } from "@/components/session-gate";

export default function MerchantReviewsPage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">
          MealVote / Merchant Reviews
        </Link>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantReviewsManager />
      </SessionGate>
    </main>
  );
}
