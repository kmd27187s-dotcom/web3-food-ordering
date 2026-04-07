import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MemberDashboard } from "@/components/member-dashboard";
import { SessionGate } from "@/components/session-gate";

export default async function MemberPage({
  searchParams
}: {
  searchParams?: Promise<{ subscribe?: string }>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Member</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberDashboard openSubscribe={params.subscribe === "1"} />
      </SessionGate>
    </main>
  );
}
