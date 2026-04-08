import { AppNav } from "@/components/app-nav";
import { SessionGate } from "@/components/session-gate";
import { UsageLedger } from "@/components/usage-ledger";

export default async function RecordsPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: "usage" | "proposal-coupon" | "vote-coupon" | "create-order-coupon" | "invite" }>;
}) {
  const params = (await searchParams) ?? {};
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="meal-kicker">MealVote / Records</p>
        </div>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <UsageLedger initialTab={params.tab || "usage"} />
      </SessionGate>
    </main>
  );
}
