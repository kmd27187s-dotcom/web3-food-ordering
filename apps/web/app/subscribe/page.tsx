import { AppNavCompact } from "@/components/app-nav";
import { SessionGate } from "@/components/session-gate";
import { SubscriptionCheckpoint } from "@/components/subscription-checkpoint";

export default function SubscribePage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#fff8f5]">
      <div className="mx-auto max-w-4xl px-6 py-8 md:py-10">
        <div className="mb-10 flex items-center justify-between gap-4">
          <p className="text-xl font-bold text-primary">MealVote</p>
          <AppNavCompact />
        </div>

        <SessionGate>
          <div className="space-y-12 py-8">
            <SubscriptionCheckpoint />
          </div>
        </SessionGate>
      </div>
    </main>
  );
}
