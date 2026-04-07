import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MemberMerchants } from "@/components/member-merchants";
import { SessionGate } from "@/components/session-gate";

export default function MemberMerchantsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Member Merchants</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberMerchants />
      </SessionGate>
    </main>
  );
}
