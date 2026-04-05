import { AppNav } from "@/components/app-nav";
import { GovernanceBoard } from "@/components/governance-board";
import { SessionGate } from "@/components/session-gate";

export default function GovernancePage() {
  return (
    <main id="main-content" className="meal-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="meal-kicker">MealVote / Governance</p>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <GovernanceBoard />
      </SessionGate>
    </main>
  );
}
