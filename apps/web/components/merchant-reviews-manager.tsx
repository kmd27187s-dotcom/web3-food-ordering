"use client";

import { useEffect, useState } from "react";

import { fetchMerchantDashboard, fetchMerchantDetail, type MerchantDetail } from "@/lib/api";

export function MerchantReviewsManager() {
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const dashboard = await fetchMerchantDashboard();
      if (!dashboard.merchant?.id) {
        throw new Error("目前沒有已連結的店家。");
      }
      const merchantDetail = await fetchMerchantDetail(dashboard.merchant.id);
      setDetail(merchantDetail);
    }

    load()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家評分失敗"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入店家評分與留言...</div>;
  }

  if (!detail) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到店家評分資料"}</div>;
  }

  return (
    <section className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Merchant reviews</p>
        <h1 className="text-3xl font-extrabold">{detail.merchant.name} / 評分與留言</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="平均星等" value={`${(detail.merchant.averageRating || 0).toFixed(1)} / 5`} />
          <Stat label="留言總數" value={`${detail.merchant.reviewCount || 0} 則`} />
          <Stat label="最新留言時間" value={detail.reviews[0] ? new Date(detail.reviews[0].createdAt).toLocaleString("zh-TW") : "尚無留言"} />
        </div>
      </section>

      <section className="meal-panel p-8">
        <p className="meal-kicker">Comments</p>
        <h2 className="text-2xl font-extrabold">所有留言評論</h2>
        <div className="mt-6 space-y-3">
          {detail.reviews.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有會員留言評論。</p> : null}
          {detail.reviews.map((review) => (
            <div key={review.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">{review.memberName}</p>
                <p className="text-sm text-muted-foreground">{renderStars(review.rating)} ({review.rating}/5)</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{review.comment}</p>
              <p className="mt-3 text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString("zh-TW")}</p>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </section>
  );
}

function renderStars(rating: number) {
  const rounded = Math.round(rating);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
