import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MemberOngoingOrdersView } from "@/components/member-ongoing-orders";
import { SessionGate } from "@/components/session-gate";

export default function MemberOngoingOrdersPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Ongoing Orders</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberOngoingOrdersView />
      </SessionGate>
    </main>
  );
}
