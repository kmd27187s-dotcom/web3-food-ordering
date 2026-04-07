import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MerchantMenuOverview } from "@/components/merchant-menu-manager";
import { SessionGate } from "@/components/session-gate";

export default function MerchantMenuPage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Merchant Menu</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantMenuOverview />
      </SessionGate>
    </main>
  );
}
