import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MerchantProfileManager } from "@/components/merchant-profile-manager";
import { SessionGate } from "@/components/session-gate";

export default function MerchantPage() {
  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Merchant Home</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantProfileManager />
      </SessionGate>
    </main>
  );
}
