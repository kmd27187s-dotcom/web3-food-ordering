import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MerchantDashboard } from "@/components/merchant-dashboard";
import { SessionGate } from "@/components/session-gate";

export default function MerchantOrdersPage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Merchant Orders</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantDashboard />
      </SessionGate>
    </main>
  );
}
