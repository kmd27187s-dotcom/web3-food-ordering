"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchAdminDashboard, reviewAdminMenuChange, type AdminDashboard } from "@/lib/api";

export function AdminMenuReviews() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  async function refresh() {
    setData(await fetchAdminDashboard());
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取菜單審核資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function handleReview(changeId: number, decision: "approve" | "reject") {
    setPending(true);
    try {
      await reviewAdminMenuChange(changeId, decision);
      await refresh();
      setMessage(decision === "approve" ? "已核准，將於隔日 00:00 生效。" : "已退回店家修改。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "審核失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入菜單審核頁...</div>;
  }

  if (!data) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "讀取資料失敗"}</div>;
  }

  const sortedRequests = [...data.menuChangeRequests].sort((left, right) => {
    switch (sortBy) {
      case "oldest":
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      case "id_asc":
        return left.id - right.id;
      case "id_desc":
        return right.id - left.id;
      case "price_desc":
        return right.priceWei - left.priceWei;
      case "status":
        return left.status.localeCompare(right.status, "zh-TW");
      case "newest":
      default:
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
  });

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Menu governance</p>
        <h1 className="text-3xl font-extrabold">店家菜單審核</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">所有店家新增、修改、刪除菜單都集中在這一頁審核，不再和其他後台功能堆在一起。</p>
      </section>

      <section className="meal-panel p-8">
        <div className="max-w-xs">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">排序方式</span>
            <select className="meal-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="newest">依送審時間新到舊</option>
              <option value="oldest">依送審時間舊到新</option>
              <option value="id_desc">依案件 ID 大到小</option>
              <option value="id_asc">依案件 ID 小到大</option>
              <option value="price_desc">依價格高到低</option>
              <option value="status">依狀態排序</option>
            </select>
          </label>
        </div>
        <div className="space-y-4">
          {sortedRequests.length === 0 ? <p className="text-sm text-muted-foreground">目前沒有店家送審案件。</p> : null}
          {sortedRequests.map((request) => (
            <div key={request.id} className="rounded-[1.4rem] border border-border bg-background/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{request.merchantId} / {request.itemName || request.menuItemId}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{request.action} • {request.status} • 申請者 {request.requestedByName}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{request.description || "無描述"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{request.priceWei} Wei</p>
                  {request.effectiveAt ? <p className="mt-1 text-sm text-muted-foreground">預計生效 {new Date(request.effectiveAt).toLocaleString("zh-TW")}</p> : null}
                </div>
              </div>
              {request.status === "pending" ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button disabled={pending} onClick={() => handleReview(request.id, "approve")}>核准</Button>
                  <Button variant="ghost" disabled={pending} onClick={() => handleReview(request.id, "reject")}>退回</Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}
