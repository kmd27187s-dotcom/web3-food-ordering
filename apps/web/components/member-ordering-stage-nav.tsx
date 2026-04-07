"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/member/ordering/create", label: "建立訂單" },
  { href: "/member/ordering/proposals", label: "店家提案階段" },
  { href: "/member/ordering/voting", label: "投票階段" },
  { href: "/member/ordering/ordering", label: "點餐階段" },
  { href: "/member/ordering/submitted", label: "完成送出訂單階段" }
] as const;

export function MemberOrderingStageNav() {
  const pathname = usePathname();

  return (
    <section className="meal-glass-card rounded-[1.6rem] p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full border px-5 py-3 text-center text-sm font-bold tracking-[0.08em] transition ${
                active
                  ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,255,255,0.85)] text-primary shadow-[0_10px_24px_rgba(148,74,0,0.08)]"
                  : "border-[rgba(220,193,177,0.46)] bg-[rgba(251,242,237,0.72)] text-muted-foreground hover:border-[rgba(148,74,0,0.24)] hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
