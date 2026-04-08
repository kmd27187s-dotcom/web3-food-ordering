import { AdminGovernanceSettings } from "@/components/admin-governance-settings";
import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { SessionGate } from "@/components/session-gate";

export default function AdminSettingsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Admin Settings</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate allowedRole="admin">
        <AdminGovernanceSettings />
      </SessionGate>
    </main>
  );
}
