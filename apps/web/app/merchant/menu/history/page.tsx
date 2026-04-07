import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MerchantMenuRequestHistory } from "@/components/merchant-menu-manager";
import { SessionGate } from "@/components/session-gate";

export default function MerchantMenuHistoryPage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Merchant Menu History</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantMenuRequestHistory />
      </SessionGate>
    </main>
  );
}
