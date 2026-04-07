import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { GroupInviteUsageView } from "@/components/group-invite-usage-view";
import { SessionGate } from "@/components/session-gate";

export default async function MemberGroupInviteUsagePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">MealVote / Group Invite Usage</Link>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <GroupInviteUsageView groupId={Number(groupId)} />
      </SessionGate>
    </main>
  );
}
