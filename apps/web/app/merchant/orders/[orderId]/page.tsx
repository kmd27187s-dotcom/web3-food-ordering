import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MerchantOrderDetail } from "@/components/merchant-order-detail";
import { SessionGate } from "@/components/session-gate";

export default async function MerchantOrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolved = await params;
  const orderId = Number(resolved.orderId);

  return (
    <main id="main-content" className="meal-page max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="meal-kicker">
          MealVote / Merchant Order
        </Link>
        <AppNav />
      </div>
      <SessionGate>
        <MerchantOrderDetail orderId={orderId} />
      </SessionGate>
    </main>
  );
}
