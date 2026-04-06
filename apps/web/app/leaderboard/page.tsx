import { AppNav } from "@/components/app-nav";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { SessionGate } from "@/components/session-gate";

export default function LeaderboardPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#fff8f5]">
      <div className="mx-auto max-w-5xl px-6 py-8 md:py-10">
        <div className="mb-10 flex items-center justify-between gap-4">
          <p className="text-xl font-bold text-primary">MealVote</p>
          <AppNav />
        </div>
        <SessionGate requireSubscription>
          <div className="space-y-12 py-8">
            <LeaderboardBoard />
          </div>
        </SessionGate>
      </div>
    </main>
  );
}
