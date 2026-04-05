import { AppNavCompact } from "@/components/app-nav";
import { SessionGate } from "@/components/session-gate";
import { SubscriptionCheckpoint } from "@/components/subscription-checkpoint";

export default function SubscribePage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="meal-kicker">MealVote / Activation</p>
          <p className="mt-2 text-sm text-muted-foreground">登入已完成，這裡只處理開通。</p>
        </div>
        <AppNavCompact />
      </div>

      <SessionGate>
        <SubscriptionCheckpoint />
      </SessionGate>
    </main>
  );
}
