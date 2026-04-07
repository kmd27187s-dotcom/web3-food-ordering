import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MemberAccount } from "@/components/member-account";
import { SessionGate } from "@/components/session-gate";

export default function MemberAccountPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">MealVote / Member Account</Link>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberAccount />
      </SessionGate>
    </main>
  );
}
