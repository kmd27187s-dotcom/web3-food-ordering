import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MemberOrderHistoryView } from "@/components/member-order-history";
import { SessionGate } from "@/components/session-gate";

export default function MemberOrdersPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Member Orders</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberOrderHistoryView />
      </SessionGate>
    </main>
  );
}
