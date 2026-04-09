import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { MemberBadgesDemo } from "@/components/member-badges-demo";
import { SessionGate } from "@/components/session-gate";

export default function MemberBadgesPage() {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Member Badges</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        <MemberBadgesDemo />
      </SessionGate>
    </main>
  );
}
