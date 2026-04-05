"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { clearStoredToken } from "@/lib/api";
import { clearWalletConnection } from "@/lib/wallet-auth";

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const navigation = typeof window !== "undefined"
      ? (window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
      : undefined;
    if (navigation?.type === "reload") {
      clearStoredToken();
      clearWalletConnection();
    }
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
