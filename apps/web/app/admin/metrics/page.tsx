import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { AdminMetrics } from "@/components/admin-metrics";
import { SessionGate } from "@/components/session-gate";

export default function AdminMetricsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Admin Metrics</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate allowedRole="admin">
        <AdminMetrics />
      </SessionGate>
    </main>
  );
}
