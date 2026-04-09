"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DEMO_REVIEW_CATEGORIES,
  addDemoComment,
  addDemoMenuRecord,
  getCurrentMemberTitle,
  getMerchantBuildingInfo,
  getMerchantComments,
  getMerchantMenuRecords,
  mergeMerchantReviews
} from "@/lib/achievement-demo";
import { fetchMe, fetchMerchantDetail, type Member, type MerchantDetail } from "@/lib/api";

function renderStars(rating: number) {
  const rounded = Math.round(rating);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

export function MerchantDetailView({ merchantId }: { merchantId: string }) {
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState("5");
  const [category, setCategory] = useState<(typeof DEMO_REVIEW_CATEGORIES)[number]>("餐點");
  const [comment, setComment] = useState("");
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [menuDescription, setMenuDescription] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  async function refresh() {
    const [merchantDetail, currentMember] = await Promise.all([fetchMerchantDetail(merchantId), fetchMe()]);
    setDetail(merchantDetail);
    setMember(currentMember);
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家資訊失敗。"))
      .finally(() => setLoading(false));
  }, [merchantId]);

  const demoComments = useMemo(() => getMerchantComments(merchantId), [merchantId, refreshKey]);
  const demoMenus = useMemo(() => getMerchantMenuRecords(merchantId), [merchantId, refreshKey]);
  const mergedReviews = useMemo(
    () => mergeMerchantReviews(detail?.reviews || [], demoComments),
    [detail?.reviews, demoComments]
  );
  const building = useMemo(
    () => (detail ? getMerchantBuildingInfo(detail.merchant, mergedReviews) : null),
    [detail, mergedReviews]
  );

  async function handleReviewSubmit() {
    if (!member || !comment.trim()) return;
    setPending(true);
    try {
      addDemoComment({
        merchantId,
        memberId: member.id,
        memberName: member.displayName,
        category,
        rating: Number(rating),
        content: comment.trim()
      });
      setComment("");
      setRefreshKey((value) => value + 1);
      setMessage("已新增測試版個人評論，並同步累積個人勳章積分。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增評論失敗。");
    } finally {
      setPending(false);
    }
  }

  function handleMenuSubmit() {
    if (!member || !menuName.trim() || !menuPrice.trim()) return;
    addDemoMenuRecord({
      merchantId,
      name: menuName.trim(),
      price: Number(menuPrice),
      description: menuDescription.trim(),
      createdByMemberId: member.id,
      createdByName: member.displayName
    });
    setMenuName("");
    setMenuPrice("");
    setMenuDescription("");
    setRefreshKey((value) => value + 1);
    setMessage("已新增測試版菜單項目。");
  }

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">讀取店家資訊中...</div>;
  if (!detail || !building) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "目前找不到這家店的資訊。"}</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Merchant detail</p>
        <h1 className="text-3xl font-extrabold">{detail.merchant.name}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{detail.merchant.description || "尚未填寫店家介紹。"}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="地址" value={detail.merchant.address || "尚未填寫"} />
          <Stat label="平均星等" value={`${(detail.merchant.averageRating || 0).toFixed(1)} / 5`} />
          <Stat label="評論總數" value={`${mergedReviews.length} 則`} />
        </div>
      </section>

      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="meal-kicker">Store building</p>
            <h2 className="text-2xl font-extrabold">建築詳細資訊 + 店家勳章系統</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              依據店家目前星等與評論數，自動轉換為建築分數、樓層與勳章顯示。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {building.badges.map((badge) => (
                <span key={badge.label} className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-foreground">
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-5 rounded-[1.5rem] border border-border bg-background/70 px-6 py-5">
            <div className="flex h-44 w-28 items-end justify-center rounded-[1rem] border border-[rgba(148,74,0,0.16)] bg-[linear-gradient(180deg,#f8ead7_0%,#d49358_100%)]">
              <div
                className="w-20 rounded-t-[0.8rem] border border-[rgba(126,77,22,0.24)] bg-[rgba(126,77,22,0.18)]"
                style={{ height: `${Math.max(50, building.floors * 11)}px` }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-bold">{building.title}</p>
              <p className="text-sm text-muted-foreground">{building.stage}</p>
              <p className="text-sm text-primary">{building.floors} 層</p>
              <p className="text-sm text-muted-foreground">建築分數 {building.score}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="meal-panel p-8">
          <p className="meal-kicker">Personal review</p>
          <h2 className="text-2xl font-extrabold">分類評論 + 星等 + 評論內容</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-foreground">評論分類</span>
              <select className="meal-field" value={category} onChange={(event) => setCategory(event.target.value as (typeof DEMO_REVIEW_CATEGORIES)[number])}>
                {DEMO_REVIEW_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-foreground">星等</span>
              <select className="meal-field" value={rating} onChange={(event) => setRating(event.target.value)}>
                <option value="5">5 星</option>
                <option value="4">4 星</option>
                <option value="3">3 星</option>
                <option value="2">2 星</option>
                <option value="1">1 星</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-foreground">會員稱號</span>
              <input className="meal-field" value={member ? getCurrentMemberTitle(member.id) || "尚未裝備稱號" : "尚未登入"} readOnly />
            </label>
          </div>
          <label className="mt-4 grid gap-2 text-sm">
            <span className="font-semibold text-foreground">評論內容</span>
            <textarea
              className="meal-field min-h-32"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="輸入你對這家店的餐點、環境、服務或價格評價。"
            />
          </label>
          <Button className="mt-4" onClick={handleReviewSubmit} disabled={pending || !comment.trim()}>
            送出評論
          </Button>

          <div className="mt-8">
            <p className="meal-kicker">Menu demo</p>
            <h3 className="text-xl font-bold">新增菜單</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <input className="meal-field" value={menuName} onChange={(event) => setMenuName(event.target.value)} placeholder="菜單名稱" />
              <input className="meal-field" value={menuPrice} onChange={(event) => setMenuPrice(event.target.value)} placeholder="價格" />
              <input className="meal-field" value={menuDescription} onChange={(event) => setMenuDescription(event.target.value)} placeholder="菜單描述" />
            </div>
            <Button variant="secondary" className="mt-4" onClick={handleMenuSubmit} disabled={!menuName.trim() || !menuPrice.trim()}>
              新增菜單
            </Button>

            <div className="mt-4 space-y-3">
              {[...demoMenus, ...detail.merchant.menu.map((item) => ({
                id: item.id,
                merchantId,
                name: item.name,
                price: Number(item.priceWei || 0),
                description: item.description,
                createdByMemberId: 0,
                createdByName: "店家原始菜單",
                createdAt: new Date().toISOString()
              }))].map((item) => (
                <div key={item.id} className="rounded-[1.1rem] border border-border bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description || "尚未填寫描述"}</p>
                    </div>
                    <p className="text-sm font-semibold text-primary">${item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="meal-panel p-8">
          <p className="meal-kicker">Reviews</p>
          <h2 className="text-2xl font-extrabold">會員評論紀錄</h2>
          <div className="mt-6 space-y-3">
            {mergedReviews.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有任何評論。</p> : null}
            {mergedReviews.map((review) => {
              const title = review.memberId ? getCurrentMemberTitle(review.memberId) : "";
              return (
                <div key={`${review.id}-${review.createdAt}`} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{review.memberName}</p>
                      <p className="mt-1 text-xs text-primary">{title || "尚未裝備稱號"}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{renderStars(review.rating)} ({review.rating}/5)</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{review.comment}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString("zh-TW")}</p>
                </div>
              );
            })}
          </div>
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
