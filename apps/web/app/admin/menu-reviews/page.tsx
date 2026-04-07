import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { AdminMenuReviews } from "@/components/admin-menu-reviews";
import { BrandHomeLink } from "@/components/brand-home-link";
import { SessionGate } from "@/components/session-gate";

export default function AdminMenuReviewsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Admin Menu Reviews</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate allowedRole="admin">
        <AdminMenuReviews />
      </SessionGate>
    </main>
  );
}
