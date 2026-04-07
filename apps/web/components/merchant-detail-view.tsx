"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createMerchantReview, fetchMerchantDetail, type MerchantDetail } from "@/lib/api";

function renderStars(rating: number) {
  const rounded = Math.round(rating);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

export function MerchantDetailView({ merchantId }: { merchantId: string }) {
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");

  async function refresh() {
    setDetail(await fetchMerchantDetail(merchantId));
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家詳細資料失敗"))
      .finally(() => setLoading(false));
  }, [merchantId]);

  async function handleReviewSubmit() {
    setPending(true);
    try {
      await createMerchantReview(merchantId, { rating: Number(rating), comment: comment.trim() });
      setComment("");
      await refresh();
      setMessage("已送出店家評論。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "送出評論失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入店家詳細資料...</div>;
  if (!detail) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到店家資料"}</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Merchant detail</p>
        <h1 className="text-3xl font-extrabold">{detail.merchant.name}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{detail.merchant.description || "尚未填寫店家簡介"}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="地址" value={detail.merchant.address || "尚未填地址"} />
          <Stat label="平均星等" value={`${(detail.merchant.averageRating || 0).toFixed(1)} / 5`} />
          <Stat label="留言數" value={`${detail.merchant.reviewCount || 0} 則`} />
        </div>
      </section>

      <section className="meal-panel p-8">
        <p className="meal-kicker">Write review</p>
        <h2 className="text-2xl font-extrabold">留下評論</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-[200px_1fr]">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">星等 (必填)</span>
            <select className="meal-field" value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="5">5 顆星</option>
              <option value="4">4 顆星</option>
              <option value="3">3 顆星</option>
              <option value="2">2 顆星</option>
              <option value="1">1 顆星</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">評論內容 (必填)</span>
            <textarea className="meal-field min-h-32" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="請輸入評論內容（必填）" />
          </label>
        </div>
        <Button className="mt-4" onClick={handleReviewSubmit} disabled={pending || !comment.trim()}>送出評論</Button>
      </section>

      <section className="meal-panel p-8">
        <p className="meal-kicker">Reviews</p>
        <h2 className="text-2xl font-extrabold">所有留言評論</h2>
        <div className="mt-6 space-y-3">
          {detail.reviews.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有留言評論。</p> : null}
          {detail.reviews.map((review) => (
            <div key={review.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
              <div className="flex items-center justify-between gap-3">
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
