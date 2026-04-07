import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MerchantMenuManager } from "@/components/merchant-menu-manager";
import { SessionGate } from "@/components/session-gate";

export default function MerchantMenuEditPage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Merchant Menu Edit</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantMenuManager mode="manage" />
      </SessionGate>
    </main>
  );
}
