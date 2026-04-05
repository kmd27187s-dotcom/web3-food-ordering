import { AppNav } from "@/components/app-nav";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { SessionGate } from "@/components/session-gate";

export default function LeaderboardPage() {
  return (
    <main id="main-content" className="meal-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="meal-kicker">MealVote / Leaderboard</p>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <LeaderboardBoard />
      </SessionGate>
    </main>
  );
}
