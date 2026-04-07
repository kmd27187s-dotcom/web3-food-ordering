import Link from "next/link";

import { AdminGroupDetailView } from "@/components/admin-group-detail";
import { AppNav } from "@/components/app-nav";
import { SessionGate } from "@/components/session-gate";

export default async function AdminGroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const resolvedParams = await params;
  const groupId = Number(resolvedParams.groupId);

  return (
    <main id="main-content" className="meal-page max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin/metrics" className="meal-kicker">
          MealVote / Admin Group Detail
        </Link>
        <AppNav />
      </div>
      <SessionGate allowedRole="admin">
        <AdminGroupDetailView groupId={groupId} />
      </SessionGate>
    </main>
  );
}
