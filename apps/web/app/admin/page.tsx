import Link from "next/link";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";

export default function AdminPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Admin</BrandHomeLink>
        <AppNav />
      </div>
      <AdminDashboard />
    </main>
  );
}
