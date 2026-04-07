import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MemberSubscription } from "@/components/member-subscription";
import { SessionGate } from "@/components/session-gate";

export default function MemberSubscriptionPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">MealVote / Member Subscription</Link>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberSubscription />
      </SessionGate>
    </main>
  );
}
