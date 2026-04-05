import type { Metadata } from "next";

import { Web3Provider } from "@/components/providers/web3-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "MealVote",
  description: "Group meal proposal, weighted voting, and on-chain ordering on Sepolia."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="font-[var(--font-body)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-2xl focus:bg-primary focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-float"
        >
          跳至主要內容
        </a>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
