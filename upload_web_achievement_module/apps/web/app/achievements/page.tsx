"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";
import {
  createAchievementComment,
  fetchAchievementComments,
  fetchAchievementRanking,
  fetchAchievementStores,
  fetchAchievementUser,
  type AchievementComment,
  type AchievementRankingEntry,
  type AchievementStoreSummary,
  type AchievementUser
} from "@/lib/api";

const wallets = ["0xabc123", "0xdef456", "0xghi789", "0xjkl012", "0xlmn345"];
const categories = ["餐點", "服務", "環境", "價格", "出餐速度", "推薦程度", "其他"];
const defaultStoreID = "store_001";

export default function AchievementsPage() {
  const [commentWallet, setCommentWallet] = useState(wallets[0]);
  const [achievementWallet, setAchievementWallet] = useState(wallets[0]);
  const [storeId, setStoreId] = useState(defaultStoreID);
  const [category, setCategory] = useState(categories[0]);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [comments, setComments] = useState<AchievementComment[]>([]);
  const [ranking, setRanking] = useState<AchievementRankingEntry[]>([]);
  const [stores, setStores] = useState<AchievementStoreSummary[]>([]);
  const [achievement, setAchievement] = useState<AchievementUser | null>(null);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [sortMode, setSortMode] = useState<"latest" | "highestRating">("latest");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshAll();
  }, [storeId, achievementWallet]);

  async function refreshAll() {
    setError("");
    try {
      const [commentData, rankingData, storeData, achievementData] = await Promise.all([
        fetchAchievementComments(storeId),
        fetchAchievementRanking(10),
        fetchAchievementStores(),
        fetchAchievementUser(achievementWallet)
      ]);
      setComments(commentData);
      setRanking(rankingData);
      setStores(storeData);
      setAchievement(achievementData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入資料失敗");
    }
  }

  async function handleSubmit() {
    setMessage("");
    setError("");
    try {
      const result = await createAchievementComment({
        storeId,
        walletAddress: commentWallet,
        category,
        rating,
        content
      });
      setMessage(`評論已送出，本次獲得 ${result.pointsAdded} 分，目前總分 ${result.totalPoints}。`);
      setContent("");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出評論失敗");
    }
  }

  const categoryCounts = comments.reduce<Record<string, number>>(
    (acc, item) => {
      acc["全部"] += 1;
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    },
    { 全部: 0 }
  );

  const filteredComments = comments
    .filter((item) => activeCategory === "全部" || item.category === activeCategory)
    .sort((left, right) => {
      if (sortMode === "highestRating" && right.rating !== left.rating) {
        return right.rating - left.rating;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  return (
    <main id="main-content" className="min-h-screen bg-[#fff8f5]">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <div className="mb-10 flex items-center justify-between gap-4">
          <p className="text-xl font-bold text-primary">MealVote</p>
          <AppNav />
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <h1 className="text-3xl font-black tracking-tight text-primary">成就系統與評論模組</h1>
              <p className="mt-3 text-sm leading-7 text-stone-500">
                這一頁是你負責模組的整合版測試入口。資料獨立保存，不會進主體原本的會員、投票、點餐資料流。
              </p>
            </div>

            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-primary">新增評論</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="使用者錢包">
                  <select value={commentWallet} onChange={(e) => setCommentWallet(e.target.value)} className={inputClass}>
                    {wallets.map((wallet) => <option key={wallet} value={wallet}>{wallet}</option>)}
                  </select>
                </Field>
                <Field label="店家代號">
                  <input value={storeId} onChange={(e) => setStoreId(e.target.value)} className={inputClass} />
                </Field>
                <Field label="評論分類">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                    {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="評論星等">
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className={inputClass}>
                    {[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item} 顆星</option>)}
                  </select>
                </Field>
              </div>

              <Field label="評論內容" className="mt-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={`${inputClass} min-h-28`}
                  placeholder="例如：餐點份量很夠，整體體驗不錯"
                />
              </Field>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleSubmit()} className={primaryButtonClass}>送出評論</button>
                <button type="button" onClick={() => void refreshAll()} className={secondaryButtonClass}>重新整理資料</button>
              </div>

              {message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
              {error ? <p className="mt-4 text-sm font-semibold text-[hsl(7_65%_42%)]">{error}</p> : null}
            </div>

            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-primary">評論分類瀏覽</h2>
                  <p className="mt-2 text-sm text-stone-500">模擬 Google 店家評論分類，快速篩選你要看的主題。</p>
                </div>
                <Field label="排序方式" className="min-w-44">
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "latest" | "highestRating")} className={inputClass}>
                    <option value="latest">最新優先</option>
                    <option value="highestRating">星等優先</option>
                  </select>
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["全部", ...categories.filter((item) => categoryCounts[item] > 0)].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveCategory(item)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      activeCategory === item ? "bg-primary text-white" : "border border-orange-100 bg-orange-50 text-primary"
                    }`}
                  >
                    {item} {categoryCounts[item] || 0}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-primary">店家評論列表</h2>
              <div className="mt-4 space-y-4">
                {filteredComments.length === 0 ? (
                  <p className="text-sm text-stone-500">這個分類目前還沒有評論。</p>
                ) : (
                  filteredComments.map((comment) => (
                    <article key={comment.id} className="rounded-[1.3rem] border border-orange-100 bg-[#fffaf7] p-4">
                      <p className="text-xs text-stone-500">
                        {comment.walletAddress} ・ {comment.storeId} ・ {new Date(comment.createdAt).toLocaleString()}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-primary">{comment.category}</span>
                        <span className="text-sm font-bold text-amber-600">{renderStars(comment.rating)}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-stone-700">{comment.content}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-primary">個人成就看板</h2>
              <Field label="查詢錢包" className="mt-4">
                <select value={achievementWallet} onChange={(e) => setAchievementWallet(e.target.value)} className={inputClass}>
                  {wallets.map((wallet) => <option key={wallet} value={wallet}>{wallet}</option>)}
                </select>
              </Field>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatCard label="總積分" value={achievement?.totalPoints ?? 0} />
                <StatCard label="評論數" value={achievement?.summary.commentCount ?? 0} />
                <StatCard label="回覆數" value={achievement?.summary.replyCount ?? 0} />
                <StatCard label="收到回覆數" value={achievement?.summary.receivedReplyCount ?? 0} />
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-primary">成就排行榜</h2>
              <div className="mt-4 space-y-3">
                {ranking.length === 0 ? <p className="text-sm text-stone-500">目前還沒有排行榜資料。</p> : null}
                {ranking.map((entry) => (
                  <div key={entry.walletAddress} className="rounded-[1.2rem] border border-orange-100 bg-[#fffaf7] p-4">
                    <p className="text-sm font-bold text-primary">第 {entry.rank} 名 ・ {entry.walletAddress}</p>
                    <p className="mt-2 text-xs text-stone-500">
                      總積分 {entry.totalPoints} ・ 評論 {entry.commentCount} ・ 回覆 {entry.replyCount} ・ 收到回覆 {entry.receivedReplyCount}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-primary">店家星等與互動摘要</h2>
              <div className="mt-4 space-y-4">
                {stores.length === 0 ? <p className="text-sm text-stone-500">目前還沒有店家互動資料。</p> : null}
                {stores.map((store) => (
                  <div key={store.id} className="rounded-[1.2rem] border border-orange-100 bg-[#fffaf7] p-4">
                    <p className="text-sm font-bold text-primary">{store.id}</p>
                    <p className="mt-2 text-xs text-stone-500">評論 {store.commentCount} 則 ・ 回覆 {store.replyCount} 則</p>
                    <p className="mt-2 text-xs text-stone-500">
                      平均星等：{renderStars(Math.round(store.averageRating || 0))}（{Number(store.averageRating || 0).toFixed(1)} / {store.ratingCount} 則評分）
                    </p>
                    <div className="mt-4 space-y-2">
                      {renderBreakdownRows(store.ratingBreakdown, store.ratingCount)}
                    </div>
                    <p className="mt-4 text-xs text-stone-500">最新內容：{store.latestComment || "-"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-primary">成就紀錄</h2>
              <div className="mt-4 space-y-3">
                {!achievement?.logs.length ? <p className="text-sm text-stone-500">這個錢包目前還沒有成就紀錄。</p> : null}
                {achievement?.logs.map((log) => (
                  <div key={`${log.createdAt}-${log.sourceId}`} className="rounded-[1.2rem] border border-orange-100 bg-[#fffaf7] p-4">
                    <p className="text-sm font-bold text-primary">+{log.points} 分</p>
                    <p className="mt-2 text-xs text-stone-500">{reasonLabel(log.reason)}</p>
                    <p className="mt-1 text-xs text-stone-500">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm font-semibold text-stone-500 ${className || ""}`}>
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.3rem] border border-orange-100 bg-[#fffaf7] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-primary">{value}</p>
    </div>
  );
}

function renderStars(rating: number) {
  const value = Math.max(1, Math.min(5, Number(rating || 0)));
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function renderBreakdownRows(
  breakdown: AchievementStoreSummary["ratingBreakdown"],
  total: number
) {
  const levels = [
    { label: "5 星", count: breakdown.five || 0 },
    { label: "4 星", count: breakdown.four || 0 },
    { label: "3 星", count: breakdown.three || 0 },
    { label: "2 星", count: breakdown.two || 0 },
    { label: "1 星", count: breakdown.one || 0 }
  ];

  return levels.map((level) => {
    const width = total > 0 ? (level.count / total) * 100 : 0;
    return (
      <div key={level.label} className="grid grid-cols-[42px_1fr_28px] items-center gap-2 text-xs text-stone-500">
        <span>{level.label}</span>
        <div className="h-2 overflow-hidden rounded-full bg-orange-100">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-primary" style={{ width: `${width}%` }} />
        </div>
        <span>{level.count}</span>
      </div>
    );
  });
}

function reasonLabel(reason: string) {
  if (reason === "comment_reward") return "發表評論";
  if (reason === "reply_reward") return "回覆他人";
  if (reason === "reply_received_reward") return "收到回覆";
  return reason;
}

const inputClass =
  "w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 text-foreground outline-none transition focus:border-primary";

const primaryButtonClass =
  "rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90";

const secondaryButtonClass =
  "rounded-full border border-orange-100 bg-[#fffaf7] px-5 py-3 text-sm font-bold text-foreground transition hover:bg-orange-50";
