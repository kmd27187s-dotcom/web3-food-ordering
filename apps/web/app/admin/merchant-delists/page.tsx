import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { AdminMerchantDelists } from "@/components/admin-merchant-delists";
import { BrandHomeLink } from "@/components/brand-home-link";
import { SessionGate } from "@/components/session-gate";

export default function AdminMerchantDelistsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Admin Merchant Delists</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate allowedRole="admin">
        <AdminMerchantDelists />
      </SessionGate>
    </main>
  );
}
