"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchMerchants, type Merchant } from "@/lib/api";

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
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家清單失敗"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入店家清單...</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Merchant directory</p>
        <h1 className="text-3xl font-extrabold">店家清單</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">像地圖服務那樣先看店名、簡介、星等與留言數，再點進去看完整評論。</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {merchants.map((merchant) => (
          <Link key={merchant.id} href={`/member/merchants/${merchant.id}`} className="meal-panel p-6 transition hover:-translate-y-0.5 hover:border-[rgba(148,74,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-bold">{merchant.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">{merchant.address || "尚未填地址"}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{renderStars(merchant.averageRating || 0)}</p>
                <p className="mt-1">{(merchant.averageRating || 0).toFixed(1)} / 5</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{merchant.description || "尚未填寫店家簡介"}</p>
            <p className="mt-4 text-sm text-muted-foreground">{merchant.reviewCount || 0} 則留言評論</p>
          </Link>
        ))}
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
