import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { AdminPayouts } from "@/components/admin-payouts";
import { BrandHomeLink } from "@/components/brand-home-link";
import { SessionGate } from "@/components/session-gate";

export default function AdminPayoutsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Admin Payouts</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate allowedRole="admin">
        <AdminPayouts />
      </SessionGate>
    </main>
  );
}
