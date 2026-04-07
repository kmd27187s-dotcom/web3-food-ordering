import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MemberGroups } from "@/components/member-groups";
import { SessionGate } from "@/components/session-gate";

export default function MemberGroupsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">MealVote / Member Groups</Link>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberGroups />
      </SessionGate>
    </main>
  );
}
