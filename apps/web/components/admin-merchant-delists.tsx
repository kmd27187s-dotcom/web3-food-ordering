"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchAdminDashboard, reviewAdminMerchantDelist, type AdminDashboard } from "@/lib/api";

export function AdminMerchantDelists() {
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
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取下架審核資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function handleReviewMerchantDelist(merchantId: string, decision: "approve" | "reject") {
    setPending(true);
    try {
      await reviewAdminMerchantDelist(merchantId, decision);
      await refresh();
      setMessage(decision === "approve" ? "已核准店家下架申請。" : "已駁回店家下架申請。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "店家下架審核失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入下架審核頁...</div>;
  }

  if (!data) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "讀取資料失敗"}</div>;
  }

  const sortedRequests = [...data.merchantDelistRequests].sort((left, right) => {
    switch (sortBy) {
      case "oldest":
        return new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime();
      case "name":
        return left.merchantName.localeCompare(right.merchantName, "zh-TW");
      case "owner":
        return (left.ownerDisplayName || "").localeCompare(right.ownerDisplayName || "", "zh-TW");
      case "status":
        return Number(left.currentlyDelisted) - Number(right.currentlyDelisted);
      case "newest":
      default:
        return new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime();
    }
  });

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Merchant governance</p>
        <h1 className="text-3xl font-extrabold">店家下架申請審核</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">這一頁只處理店家下架申請，避免和其他管理功能混在同一頁。</p>
      </section>

      <section className="meal-panel p-8">
        <div className="max-w-xs">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">排序方式</span>
            <select className="meal-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="newest">依申請時間新到舊</option>
              <option value="oldest">依申請時間舊到新</option>
              <option value="name">依店家名稱排序</option>
              <option value="owner">依負責人排序</option>
              <option value="status">依狀態排序</option>
            </select>
          </label>
        </div>
        <div className="space-y-4">
          {sortedRequests.length === 0 ? <p className="text-sm text-muted-foreground">目前沒有待審的下架申請。</p> : null}
          {sortedRequests.map((request) => (
            <div key={request.merchantId} className="rounded-[1.4rem] border border-border bg-background/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{request.merchantName} / {request.merchantId}</p>
                  <p className="mt-2 text-sm text-muted-foreground">店家負責人：{request.ownerDisplayName || "未命名"} • 會員 #{request.ownerMemberId}</p>
                  <p className="mt-2 break-all text-sm text-muted-foreground">收款錢包：{request.payoutAddress || "尚未綁定"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{request.currentlyDelisted ? "已下架" : "待審核"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">申請時間 {new Date(request.requestedAt).toLocaleString("zh-TW")}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button disabled={pending} onClick={() => handleReviewMerchantDelist(request.merchantId, "approve")}>核准下架</Button>
                <Button variant="ghost" disabled={pending} onClick={() => handleReviewMerchantDelist(request.merchantId, "reject")}>駁回申請</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}
