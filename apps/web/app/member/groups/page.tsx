import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MemberGroups } from "@/components/member-groups";
import { SessionGate } from "@/components/session-gate";

export default function MemberGroupsPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Member Groups</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberGroups />
      </SessionGate>
    </main>
  );
}
