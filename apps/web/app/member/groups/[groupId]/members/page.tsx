import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { GroupMembersView } from "@/components/group-members-view";
import { SessionGate } from "@/components/session-gate";

export default async function MemberGroupMembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Group Members</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <GroupMembersView groupId={Number(groupId)} />
      </SessionGate>
    </main>
  );
}
