import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MemberDashboard } from "@/components/member-dashboard";
import { SessionGate } from "@/components/session-gate";

export default async function MemberPage({
  searchParams
}: {
  searchParams?: Promise<{ subscribe?: string }>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <main id="main-content" className="min-h-screen bg-[#fff8f5]">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-primary">
            MealVote
          </Link>
          <AppNav />
        </div>
        <SessionGate requireSubscription>
          <div className="space-y-12 py-8">
            <MemberDashboard openSubscribe={params.subscribe === "1"} />
          </div>
        </SessionGate>
      </div>
    </main>
  );
}
