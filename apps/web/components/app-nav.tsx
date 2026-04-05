"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { clearStoredToken, fetchMe, getStoredToken, setStoredToken, type Member } from "@/lib/api";
import { authenticateWithWallet, clearWalletConnection, getConnectedWalletAddress } from "@/lib/wallet-auth";

const links = [
  { href: "/member", label: "會員" },
  { href: "/governance", label: "治理" },
  { href: "/leaderboard", label: "排行榜" },
  { href: "/records", label: "紀錄" }
] as const;

export function AppNav() {
  return <AppNavInner showLinks interactiveWalletStatus />;
}

export function AppNavCompact() {
  return <AppNavInner showLinks={false} interactiveWalletStatus={false} />;
}

function AppNavInner({
  showLinks,
  interactiveWalletStatus
}: {
  showLinks: boolean;
  interactiveWalletStatus: boolean;
}) {
  const pathname = usePathname();
  const [member, setMember] = useState<Member | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [walletActionPending, setWalletActionPending] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const reloaded = useMemo(() => {
    if (typeof window === "undefined") return false;
    const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return navigation?.type === "reload";
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      if (reloaded) {
        clearStoredToken();
        clearWalletConnection();
        if (active) {
          setMember(null);
          setWalletAddress("");
        }
        return;
      }
      try {
        const address = await getConnectedWalletAddress();
        if (active) {
          setWalletAddress(address);
        }
      } catch {
        if (active) {
          setWalletAddress("");
        }
      }

      if (!getStoredToken()) {
        if (active) {
          setMember(null);
        }
        return;
      }

      try {
        const me = await fetchMe();
        if (active) {
          setMember(me);
        }
      } catch {
        clearStoredToken();
        clearWalletConnection();
        if (active) {
          setMember(null);
          setWalletAddress("");
        }
      }
    }

    loadStatus();
    return () => {
      active = false;
    };
  }, [pathname, reloaded]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
    setWalletMenuOpen(false);
    setWalletMessage("");
  }, [pathname]);

  const handleLogout = useCallback(() => {
    clearStoredToken();
    clearWalletConnection();
    setMember(null);
    setWalletAddress("");
    window.location.replace("/");
  }, []);

  const handleWalletLogin = useCallback(async () => {
    setWalletActionPending(true);
    setWalletMessage("");
    try {
      clearStoredToken();
      clearWalletConnection();
      const result = await authenticateWithWallet({});
      setStoredToken(result.token);
      setMember(result.member);
      setWalletAddress(result.member.walletAddress || "");
      const nextLocation = result.member.subscriptionActive ? "/member" : "/subscribe";
      window.location.replace(nextLocation);
    } catch (error) {
      if (error instanceof Error && error.message.includes("displayName is required")) {
        const message = "第一次建立會員必須先在首頁填寫顯示名稱，再連結錢包登入。";
        window.alert(message);
        setWalletMessage(message);
      } else {
        setWalletMessage(error instanceof Error ? error.message : "錢包授權失敗");
      }
    } finally {
      setWalletActionPending(false);
    }
  }, []);

  const handleWalletStatusClick = useCallback(() => {
    if (member) {
      setWalletMenuOpen((prev) => !prev);
      return;
    }
    void handleWalletLogin();
  }, [handleWalletLogin, member]);

  const connectedAddress = member?.walletAddress || walletAddress || "";
  const statusLabel = connectedAddress ? `已連接 ${shortAddress(connectedAddress)}` : "未連接";

  return (
    <div className="relative z-[80] flex items-center justify-end gap-3">
      {showLinks ? (
        <nav className="hidden flex-wrap items-center gap-2 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full border px-4 py-2 text-sm font-bold tracking-[0.08em] transition ${
                  active
                    ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,255,255,0.82)] text-primary shadow-[0_10px_24px_rgba(148,74,0,0.08)]"
                    : "border-[rgba(220,193,177,0.46)] bg-[rgba(251,242,237,0.72)] text-muted-foreground hover:border-[rgba(148,74,0,0.24)] hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="relative hidden md:block">
        <button
          type="button"
          onClick={interactiveWalletStatus ? handleWalletStatusClick : undefined}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-bold text-muted-foreground shadow-[0_10px_24px_rgba(148,74,0,0.06)] transition hover:border-[rgba(148,74,0,0.24)] hover:text-primary disabled:cursor-wait"
          aria-label={member ? "查看錢包連結狀態" : "連接錢包並登入"}
          disabled={walletActionPending || !interactiveWalletStatus}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${connectedAddress ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
          <span>{walletActionPending ? "授權中..." : statusLabel}</span>
        </button>
      </div>
      {walletMessage ? <p className="hidden text-xs text-[hsl(7_65%_42%)] md:block">{walletMessage}</p> : null}

      {/* Mobile hamburger */}
      {showLinks ? (
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="inline-flex cursor-pointer items-center justify-center rounded-full border border-border bg-card p-2.5 text-foreground transition hover:border-foreground/40 md:hidden"
          aria-label={menuOpen ? "關閉選單" : "開啟選單"}
          aria-expanded={menuOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </>
            )}
          </svg>
        </button>
      ) : (
        <div className="md:hidden">
          <button
            type="button"
            onClick={interactiveWalletStatus ? handleWalletStatusClick : undefined}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-[rgba(148,74,0,0.24)] hover:text-primary disabled:cursor-wait"
            aria-label={member ? "查看錢包連結狀態" : "連接錢包並登入"}
            disabled={walletActionPending || !interactiveWalletStatus}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${connectedAddress ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
            <span>{walletActionPending ? "授權中..." : statusLabel}</span>
          </button>
        </div>
      )}

      {menuOpen ? (
        <div className="absolute right-4 top-full z-50 mt-3 w-56 rounded-[1.5rem] border border-[rgba(220,193,177,0.42)] bg-[rgba(255,251,247,0.94)] p-3 shadow-float backdrop-blur md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 border-t border-border pt-2">
            <button
              type="button"
              onClick={member ? handleLogout : () => void handleWalletLogin()}
              className="w-full cursor-pointer rounded-xl px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:bg-secondary disabled:cursor-wait"
              disabled={walletActionPending}
            >
              {walletActionPending ? "授權中..." : member ? "登出" : statusLabel}
            </button>
            <div className="px-4 pb-2">
              <p className="break-all text-xs text-muted-foreground">{connectedAddress || "尚未連接錢包"}</p>
              <p className="mt-2 text-xs text-muted-foreground">{member ? "已連接後可從這裡登出" : "點擊上方可重新連接並登入"}</p>
            </div>
            {walletMessage ? <p className="px-4 pb-2 text-xs text-[hsl(7_65%_42%)]">{walletMessage}</p> : null}
          </div>
        </div>
      ) : null}

      {mounted && interactiveWalletStatus && walletMenuOpen && member
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="關閉錢包選單"
                className="fixed inset-0 z-[150] cursor-default bg-transparent"
                onClick={() => setWalletMenuOpen(false)}
              />
              <div className="fixed right-4 top-20 z-[160] min-w-56 rounded-[1.5rem] border border-[rgba(220,193,177,0.42)] bg-[rgba(255,251,247,0.98)] p-3 shadow-float backdrop-blur md:right-6">
                <p className="px-3 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">目前錢包</p>
                <p className="mt-1 break-all px-3 text-sm font-semibold text-foreground">{member.walletAddress || connectedAddress}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 w-full rounded-[1rem] border border-[rgba(220,193,177,0.46)] bg-[rgba(251,242,237,0.72)] px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:bg-secondary"
                >
                  登出
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

function shortAddress(address: string) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
