import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { GroupDetailView } from "@/components/group-detail";
import { SessionGate } from "@/components/session-gate";

export default async function MemberGroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Group Detail</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <GroupDetailView groupId={Number(groupId)} />
      </SessionGate>
    </main>
  );
}
