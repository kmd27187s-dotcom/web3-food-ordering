import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MerchantAnalyticsOverview } from "@/components/merchant-analytics-overview";
import { SessionGate } from "@/components/session-gate";

export default function MerchantAnalyticsPage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Merchant Home</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantAnalyticsOverview />
      </SessionGate>
    </main>
  );
}
