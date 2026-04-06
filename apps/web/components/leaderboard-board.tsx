"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchLeaderboard, type LeaderboardEntry } from "@/lib/api";

export function LeaderboardBoard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      setEntries(await fetchLeaderboard());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "目前無法讀取排行榜");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="rounded-[1.75rem] border border-orange-100 bg-white p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="meal-section-heading max-w-none">
          <p className="meal-kicker">排行榜</p>
          <h1>積分排行榜</h1>
          <p>排名與積分。</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          {loading ? "更新中..." : "重新整理"}
        </Button>
      </div>

      <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-orange-100">
        <div className="hidden grid-cols-[80px_1.4fr_120px_1.1fr] gap-4 bg-[#fffaf7] px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-stone-400 md:grid">
          <span>排名</span>
          <span>會員</span>
          <span>積分</span>
          <span>建築</span>
        </div>
        {loading ? (
          <div className="space-y-3 bg-[#fffaf7] p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-background/70" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-[#fffaf7] p-6 text-sm text-stone-500">目前還沒有可顯示的排行資料。</div>
        ) : (
          <div className="divide-y divide-orange-100 bg-white">
            {entries.map((entry) => (
              <article key={entry.memberId} className="flex items-center gap-4 px-5 py-4 text-sm md:grid md:grid-cols-[80px_1.4fr_120px_1.1fr]">
                <span className="shrink-0 font-semibold">#{entry.rank}</span>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.displayName} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                      {entry.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="block truncate font-semibold">{entry.displayName}</span>
                    <span className="block text-xs text-muted-foreground md:hidden">{entry.points} pts · {entry.buildingName || "—"}</span>
                  </div>
                </div>
                <span className="hidden font-semibold md:block">{entry.points} pts</span>
                <span className="hidden text-muted-foreground md:block">{entry.buildingName || "—"}</span>
              </article>
            ))}
          </div>
        )}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="mt-6 text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </div>
    </section>
  );
}
