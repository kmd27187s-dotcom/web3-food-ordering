import Link from "next/link";
import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { SessionGate } from "@/components/session-gate";

export default function MemberOrderingLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <BrandHomeLink>MealVote / Member Ordering</BrandHomeLink>
        <AppNav />
      </div>
      <SessionGate requireSubscription>
        {children}
      </SessionGate>
    </main>
  );
}
