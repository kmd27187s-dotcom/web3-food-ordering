"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchMerchants, type Merchant } from "@/lib/api";
import { getMerchantBuildingInfo } from "@/lib/achievement-demo";

function renderStars(rating: number) {
  const rounded = Math.round(rating);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

export function MemberMerchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchMerchants()
      .then(setMerchants)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家列表失敗。"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">讀取店家列表中...</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Merchant directory</p>
        <h1 className="text-3xl font-extrabold">店家資訊頁面</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          會員可在這裡查看每間店的建築成長、店家勳章、菜單與評論互動資訊。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {merchants.map((merchant) => {
          const building = getMerchantBuildingInfo(merchant);
          return (
            <Link
              key={merchant.id}
              href={`/member/merchants/${merchant.id}`}
              className="meal-panel p-6 transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold">{merchant.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{merchant.address || "尚未填寫地址"}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{renderStars(merchant.averageRating || 0)}</p>
                  <p className="mt-1">{(merchant.averageRating || 0).toFixed(1)} / 5</p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex items-end gap-4">
                  <div className="flex h-28 w-24 items-end justify-center rounded-[1rem] border border-[rgba(148,74,0,0.18)] bg-[linear-gradient(180deg,#f6e4cf_0%,#d89d62_100%)]">
                    <div
                      className="w-16 rounded-t-[0.65rem] border border-[rgba(126,77,22,0.25)] bg-[rgba(126,77,22,0.16)]"
                      style={{ height: `${Math.max(36, building.floors * 9)}px` }}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-foreground">{building.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {building.stage}．{building.floors} 層
                    </p>
                    <p className="text-sm text-primary">建築分數 {building.score}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {building.badges.map((badge) => (
                    <span key={badge.label} className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-foreground">
                      {badge.label}
                    </span>
                  ))}
                  {building.badges.length === 0 ? (
                    <span className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">尚未解鎖店家勳章</span>
                  ) : null}
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-muted-foreground">{merchant.description || "尚未填寫店家介紹"}</p>
              <p className="mt-4 text-sm text-muted-foreground">{merchant.reviewCount || 0} 則原始評論</p>
            </Link>
          );
        })}
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
