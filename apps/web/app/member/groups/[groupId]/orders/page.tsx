import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { GroupOrdersView } from "@/components/group-orders-view";
import { SessionGate } from "@/components/session-gate";

export default async function MemberGroupOrdersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Group Orders</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <GroupOrdersView groupId={Number(groupId)} />
      </SessionGate>
    </main>
  );
}
