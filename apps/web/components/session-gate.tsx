"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearStoredToken, fetchMe, getStoredToken } from "@/lib/api";
import { clearWalletConnection } from "@/lib/wallet-auth";

export function SessionGate({
  children,
  requireSubscription = false
}: {
  children: React.ReactNode;
  requireSubscription?: boolean;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      const navigation = typeof window !== "undefined" ? window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined : undefined;
      if (navigation?.type === "reload") {
        clearStoredToken();
        clearWalletConnection();
        router.replace("/");
        return;
      }
      if (!getStoredToken()) {
        router.replace("/");
        return;
      }
      if (!requireSubscription) {
        if (active) setReady(true);
        return;
      }
      try {
        const member = await fetchMe();
        if (!member.subscriptionActive) {
          router.replace("/subscribe");
          return;
        }
        if (active) setReady(true);
      } catch {
        router.replace("/");
      }
    }

    void verifyAccess();
    return () => {
      active = false;
    };
  }, [requireSubscription, router]);

  if (!ready) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-muted-foreground">正在驗證登入狀態...</div>;
  }

  return <>{children}</>;
}
