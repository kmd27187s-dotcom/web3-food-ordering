"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

export function BrandHomeLink({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const href = resolveHomeHref(pathname);

  return (
    <Link href={href} className="meal-kicker">
      {children}
    </Link>
  );
}

function resolveHomeHref(pathname: string) {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/merchant")) return "/merchant/profile";
  if (pathname.startsWith("/member") || pathname.startsWith("/records")) return "/member";
  return "/";
}
