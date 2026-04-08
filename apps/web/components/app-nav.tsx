"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { clearStoredToken, fetchMe, fetchMerchantDashboard, getStoredToken, setStoredToken, type Member } from "@/lib/api";
import { authenticateWithWallet, clearWalletConnection, getConnectedWalletAddress } from "@/lib/wallet-auth";

const memberLinks = [
  { href: "/member/groups", label: "群組" },
  { href: "/member/ordering", label: "建立訂單" },
  { href: "/member/ongoing-orders", label: "成立中訂單" },
  { href: "/member/ordering/submitted", label: "完成送出訂單" },
  { href: "/member/merchants", label: "店家清單" }
] as const;

const adminLinks = [
  { href: "/admin", label: "後台總覽" },
  { href: "/admin/metrics", label: "數據總覽" },
  { href: "/admin/settings", label: "治理參數" },
  { href: "/admin/payouts", label: "平台撥款" },
  { href: "/admin/menu-reviews", label: "菜單審核" },
  { href: "/admin/merchant-delists", label: "下架審核" }
] as const;
const merchantLinks = [
  { href: "/merchant", label: "店家資訊" },
  { href: "/merchant/orders", label: "訂單工作台" },
  { href: "/merchant/menu", label: "菜單管理" },
  { href: "/merchant/reviews", label: "評分留言" }
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
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [walletActionPending, setWalletActionPending] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [merchantBound, setMerchantBound] = useState(false);
  const [merchantDisplayName, setMerchantDisplayName] = useState("");
  const [roleMenuPosition, setRoleMenuPosition] = useState({ top: 0, right: 0 });
  const roleSwitcherRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
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
        if (!me.isAdmin) {
          try {
            const dashboard = await fetchMerchantDashboard();
            if (active) {
              setMerchantBound(Boolean(dashboard.merchant));
              setMerchantDisplayName(dashboard.merchant?.name || "");
            }
          } catch {
            if (active) {
              setMerchantBound(false);
              setMerchantDisplayName("");
            }
          }
        } else if (active) {
          setMerchantBound(false);
          setMerchantDisplayName("");
        }
      } catch {
        clearStoredToken();
        clearWalletConnection();
        if (active) {
          setMember(null);
          setWalletAddress("");
          setMerchantBound(false);
          setMerchantDisplayName("");
        }
      }
    }

    loadStatus();
    return () => {
      active = false;
    };
  }, [pathname]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
    setWalletMenuOpen(false);
    setRoleMenuOpen(false);
    setWalletMessage("");
  }, [pathname]);

  useEffect(() => {
    if (!roleMenuOpen || !roleSwitcherRef.current) return;
    const rect = roleSwitcherRef.current.getBoundingClientRect();
    setRoleMenuPosition({
      top: rect.bottom + 12,
      right: Math.max(window.innerWidth - rect.right, 16)
    });
  }, [roleMenuOpen]);

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
  const isAdmin = Boolean(member?.isAdmin);
  const adminContext = isAdmin || pathname === "/admin";
  const merchantContext = pathname.startsWith("/merchant");
  const currentIdentity = member?.isAdmin
    ? "平台管理者"
    : merchantContext
      ? merchantDisplayName || "店家中心"
      : member?.displayName || "會員";
  const statusLabel = member ? currentIdentity : connectedAddress ? `已連接 ${shortAddress(connectedAddress)}` : "未連接";
  const currentPathLabel = describePath(pathname).join(" / ");
  const visibleLinks = adminContext ? adminLinks : merchantContext ? merchantLinks : memberLinks;
  const canSwitchRoles = Boolean(member) && !adminContext;
  const roleOptions = [
    { href: "/member", label: "會員中心", status: member ? "已綁定" : "未綁定" },
    { href: "/merchant", label: "店家中心", status: merchantBound ? "已綁定" : "未綁定" }
  ] as const;
  const currentRoleOption = merchantContext ? roleOptions[1] : roleOptions[0];

  return (
    <div className="relative z-[80] flex items-center justify-end gap-3">
      <div className="hidden items-center gap-2 md:flex">
        <span className="rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-bold tracking-[0.04em] text-primary">
          {currentPathLabel}
        </span>
      </div>
      {showLinks ? (
        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex flex-wrap items-center gap-2">
            {visibleLinks.map((link) => {
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
          {canSwitchRoles ? (
            <div className="relative">
              <button
                ref={roleSwitcherRef}
                type="button"
                onClick={() => setRoleMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-[rgba(148,74,0,0.24)] hover:text-primary"
              >
                <span>{currentRoleOption.label}</span>
                <ChevronDown className={`h-4 w-4 transition ${roleMenuOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          ) : null}
          {member ? (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={interactiveWalletStatus ? handleWalletStatusClick : undefined}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-bold text-muted-foreground shadow-[0_10px_24px_rgba(148,74,0,0.06)] transition hover:border-[rgba(148,74,0,0.24)] hover:text-primary disabled:cursor-wait"
                aria-label="查看帳號與錢包狀態"
                disabled={walletActionPending || !interactiveWalletStatus}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${connectedAddress ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                <span>{walletActionPending ? "授權中..." : currentIdentity}</span>
              </button>
            </div>
          ) : null}
          {member ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(255,251,247,0.88)] px-4 py-2 text-sm font-bold tracking-[0.08em] text-foreground transition hover:border-[rgba(148,74,0,0.24)] hover:text-primary"
            >
              登出
            </button>
          ) : null}
        </div>
      ) : null}

      {!member || !showLinks ? (
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
      ) : null}
      {walletMessage ? <p className="hidden text-xs text-[hsl(7_65%_42%)] md:block">{walletMessage}</p> : null}

      {/* Mobile hamburger */}
      {showLinks ? (
        <div className="flex items-center gap-2 md:hidden">
          <span className="max-w-[9rem] truncate rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-primary">{currentPathLabel}</span>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-border bg-card p-2.5 text-foreground transition hover:border-foreground/40"
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
        </div>
      ) : (
        <div className="md:hidden">
          {member ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-[rgba(148,74,0,0.24)] hover:text-primary"
            >
              登出
            </button>
          ) : (
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
          )}
        </div>
      )}

      {menuOpen ? (
        <div className="absolute right-4 top-full z-50 mt-3 w-56 rounded-[1.5rem] border border-[rgba(220,193,177,0.42)] bg-[rgba(255,251,247,0.94)] p-3 shadow-float backdrop-blur md:hidden">
          {canSwitchRoles ? (
            <div className="mb-3 rounded-[1.2rem] border border-[rgba(220,193,177,0.42)] bg-[rgba(255,255,255,0.82)] p-2">
              <p className="px-2 pb-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">角色切換</p>
              <nav className="grid gap-1">
                {roleOptions.map((link) => {
                  const active = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`rounded-[0.95rem] px-3 py-3 text-center text-sm font-semibold transition ${
                        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span>{link.label}</span>
                      <span className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>({link.status})</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
          <nav className="flex flex-col gap-1">
            {visibleLinks.map((link) => {
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
              <p className="text-xs font-semibold text-foreground">{currentIdentity}</p>
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
                <p className="px-3 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">目前帳號</p>
                <p className="mt-1 px-3 text-sm font-semibold text-foreground">{currentIdentity}</p>
                <p className="mt-3 px-3 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">錢包地址</p>
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
      {mounted && roleMenuOpen && canSwitchRoles
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="關閉角色切換選單"
                className="fixed inset-0 z-[170] cursor-default bg-transparent"
                onClick={() => setRoleMenuOpen(false)}
              />
              <div
                className="fixed z-[180] min-w-56 rounded-[1.4rem] border border-[rgba(220,193,177,0.42)] bg-[rgba(255,251,247,0.98)] p-2 shadow-float backdrop-blur"
                style={{ top: `${roleMenuPosition.top}px`, right: `${roleMenuPosition.right}px` }}
              >
                {roleOptions.map((option) => {
                  const active = pathname.startsWith(option.href);
                  return (
                    <Link
                      key={option.href}
                      href={option.href}
                      className={`flex items-center justify-between gap-4 rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>({option.status})</span>
                    </Link>
                  );
                })}
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

function describePath(pathname: string) {
  const entries: Array<[RegExp, string[]]> = [
    [/^\/$/, ["首頁"]],
    [/^\/member$/, ["會員中心"]],
    [/^\/member\/account$/, ["會員中心", "會員設定"]],
    [/^\/member\/subscription$/, ["會員中心", "訂閱管理"]],
    [/^\/member\/groups$/, ["會員中心", "群組清單"]],
    [/^\/member\/groups\/\d+$/, ["會員中心", "群組清單", "群組詳細資料"]],
    [/^\/member\/groups\/\d+\/members$/, ["會員中心", "群組清單", "群組會員清單"]],
    [/^\/member\/groups\/\d+\/orders$/, ["會員中心", "群組清單", "群組歷史訂單"]],
    [/^\/member\/groups\/\d+\/invite-usage$/, ["會員中心", "群組清單", "群組邀請碼紀錄"]],
    [/^\/member\/merchants$/, ["會員中心", "店家清單"]],
    [/^\/member\/merchants\/[^/]+$/, ["會員中心", "店家清單", "店家詳細資料"]],
    [/^\/member\/orders$/, ["會員中心", "訂單紀錄"]],
    [/^\/member\/orders\/\d+$/, ["會員中心", "訂單紀錄", "訂單詳細資料"]],
    [/^\/member\/ordering(\/create)?$/, ["會員中心", "建立訂單"]],
    [/^\/member\/ordering\/proposals/, ["會員中心", "成立中訂單", "店家提案階段"]],
    [/^\/member\/ordering\/voting/, ["會員中心", "成立中訂單", "投票階段"]],
    [/^\/member\/ordering\/ordering/, ["會員中心", "成立中訂單", "點餐階段"]],
    [/^\/member\/ordering\/submitted/, ["會員中心", "完成送出訂單"]],
    [/^\/member\/ongoing-orders$/, ["會員中心", "成立中訂單"]],
    [/^\/records$/, ["會員中心", "使用紀錄"]],
    [/^\/merchant$/, ["店家中心", "店家資訊"]],
    [/^\/merchant\/profile$/, ["店家中心", "店家資訊"]],
    [/^\/merchant\/orders$/, ["店家中心", "訂單工作台"]],
    [/^\/merchant\/menu$/, ["店家中心", "菜單管理"]],
    [/^\/merchant\/menu\/edit$/, ["店家中心", "菜單管理", "編輯菜單"]],
    [/^\/merchant\/menu\/new$/, ["店家中心", "菜單管理", "新增品項"]],
    [/^\/merchant\/reviews$/, ["店家中心", "評分留言"]],
    [/^\/merchant\/orders\/\d+$/, ["店家中心", "訂單工作台", "訂單詳細資料"]],
    [/^\/admin$/, ["平台管理", "後台總覽"]],
    [/^\/admin\/metrics$/, ["平台管理", "數據總覽"]],
    [/^\/admin\/payouts$/, ["平台管理", "平台撥款"]],
    [/^\/admin\/menu-reviews$/, ["平台管理", "菜單審核"]],
    [/^\/admin\/merchant-delists$/, ["平台管理", "下架審核"]],
    [/^\/admin\/groups\/\d+$/, ["平台管理", "群組清單", "群組詳細資料"]],
    [/^\/subscribe$/, ["首頁", "訂閱頁面"]]
  ];
  const matched = entries.find(([pattern]) => pattern.test(pathname));
  return matched?.[1] || pathname.split("/").filter(Boolean);
}

function shortAddress(address: string) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
