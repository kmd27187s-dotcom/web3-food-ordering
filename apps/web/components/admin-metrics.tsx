"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { fetchAdminDashboard, fetchAdminInsights, type AdminDashboard, type AdminInsights } from "@/lib/api";

const metricTabs = [
  { id: "groups", label: "群組清單" },
  { id: "members", label: "會員清單" },
  { id: "merchants", label: "店家清單" },
  { id: "orders", label: "訂單清單" },
  { id: "diners", label: "點餐人次" },
  { id: "servings", label: "餐點份數" }
] as const;

export function AdminMetrics() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "groups";
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    Promise.all([fetchAdminDashboard(), fetchAdminInsights()])
      .then(([dashboardData, insightsData]) => {
        setDashboard(dashboardData);
        setInsights(insightsData);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取平台數據失敗"))
      .finally(() => setLoading(false));
  }, []);

  const dinerRows = useMemo(() => {
    if (!insights) return [];
    const summary = new Map<number, { memberName: string; count: number; amountWei: bigint }>();
    insights.orders.forEach((order) => {
      const current = summary.get(order.memberId) || { memberName: order.memberName, count: 0, amountWei: 0n };
      current.count += 1;
      current.amountWei += BigInt(order.amountWei || "0");
      summary.set(order.memberId, current);
    });
    return Array.from(summary.entries()).map(([memberId, value]) => ({ memberId, ...value })).sort((a, b) => b.count - a.count);
  }, [insights]);

  const servingRows = useMemo(() => {
    if (!insights) return [];
    return insights.orders.map((order) => ({
      orderId: order.id,
      memberName: order.memberName,
      merchantName: order.merchantName || order.merchantId,
      totalServings: order.items.reduce((sum, item) => sum + item.quantity, 0)
    }));
  }, [insights]);

  const sortedGroups = useMemo(() => {
    if (!insights) return [];
    return [...insights.groups].sort((left, right) => {
      switch (sortBy) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "name":
          return left.name.localeCompare(right.name, "zh-TW");
        case "members_desc":
          return right.memberCount - left.memberCount;
        case "members_asc":
          return left.memberCount - right.memberCount;
        case "id_asc":
          return left.id - right.id;
        case "id_desc":
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }, [insights, sortBy]);

  const sortedMembers = useMemo(() => {
    if (!insights) return [];
    return [...insights.members].sort((left, right) => {
      switch (sortBy) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "name":
          return left.displayName.localeCompare(right.displayName, "zh-TW");
        case "points_desc":
          return right.points - left.points;
        case "token_desc":
          return right.tokenBalance - left.tokenBalance;
        case "id_asc":
          return left.id - right.id;
        case "id_desc":
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }, [insights, sortBy]);

  const sortedMerchants = useMemo(() => {
    if (!insights) return [];
    return [...insights.merchants].sort((left, right) => {
      switch (sortBy) {
        case "name":
          return left.name.localeCompare(right.name, "zh-TW");
        case "rating_desc":
          return (right.averageRating || 0) - (left.averageRating || 0);
        case "reviews_desc":
          return (right.reviewCount || 0) - (left.reviewCount || 0);
        case "menu_desc":
          return right.menu.length - left.menu.length;
        case "id_asc":
          return left.id.localeCompare(right.id, "zh-TW");
        case "id_desc":
        case "newest":
        default:
          return right.id.localeCompare(left.id, "zh-TW");
      }
    });
  }, [insights, sortBy]);

  const sortedOrders = useMemo(() => {
    if (!insights) return [];
    return [...insights.orders].sort((left, right) => {
      switch (sortBy) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "amount_desc":
          return BigInt(right.amountWei || "0") > BigInt(left.amountWei || "0") ? 1 : BigInt(right.amountWei || "0") < BigInt(left.amountWei || "0") ? -1 : 0;
        case "status":
          return left.status.localeCompare(right.status, "zh-TW");
        case "id_asc":
          return left.id - right.id;
        case "id_desc":
          return right.id - left.id;
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }, [insights, sortBy]);

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入數據總覽...</div>;
  }

  if (!dashboard || !insights) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "讀取數據失敗"}</div>;
  }

  const sortOptions = currentView === "groups"
    ? [
        ["newest", "依建立時間新到舊"],
        ["oldest", "依建立時間舊到新"],
        ["name", "依群組名稱排序"],
        ["members_desc", "依成員數多到少"],
        ["members_asc", "依成員數少到多"],
        ["id_desc", "依 ID 大到小"],
        ["id_asc", "依 ID 小到大"]
      ]
    : currentView === "members"
      ? [
          ["newest", "依建立時間新到舊"],
          ["oldest", "依建立時間舊到新"],
          ["name", "依名稱排序"],
          ["points_desc", "依積分高到低"],
          ["token_desc", "依 Token 高到低"],
          ["id_desc", "依 ID 大到小"],
          ["id_asc", "依 ID 小到大"]
        ]
      : currentView === "merchants"
        ? [
            ["name", "依店家名稱排序"],
            ["rating_desc", "依評分高到低"],
            ["reviews_desc", "依留言數多到少"],
            ["menu_desc", "依菜單數多到少"],
            ["id_desc", "依 ID 大到小"],
            ["id_asc", "依 ID 小到大"]
          ]
        : currentView === "orders"
          ? [
              ["newest", "依建立時間新到舊"],
              ["oldest", "依建立時間舊到新"],
              ["amount_desc", "依金額高到低"],
              ["status", "依狀態排序"],
              ["id_desc", "依 ID 大到小"],
              ["id_asc", "依 ID 小到大"]
            ]
          : [
              ["newest", "依預設排序顯示"]
            ];

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Metrics hub</p>
        <h1 className="text-3xl font-extrabold">平台數據總覽</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">點不同分類，就可以查看平台目前群組、會員、店家與訂單的詳細資料。</p>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metricTabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin/metrics?view=${tab.id}`}
            className={`rounded-[1.2rem] border px-4 py-4 text-sm font-bold transition ${currentView === tab.id ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,255,255,0.9)] text-primary" : "border-border bg-background/70 text-muted-foreground hover:border-[rgba(148,74,0,0.24)] hover:text-primary"}`}
          >
            {tab.label}
          </Link>
        ))}
      </section>

      <section className="max-w-xs">
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-foreground">排序方式</span>
          <select className="meal-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {sortOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </section>

      {currentView === "groups" ? (
        <section className="meal-panel p-8">
          <h2 className="text-2xl font-extrabold">群組清單</h2>
          <div className="mt-6 space-y-3">
            {sortedGroups.map((group) => (
              <div key={group.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{group.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      群組 #{group.id} • 建立於 {new Date(group.createdAt).toLocaleString("zh-TW")}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      建立者：{group.ownerDisplayName || `會員 #${group.ownerMemberId}`}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {group.description || "目前沒有群組說明。"}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{group.memberCount} 位成員</p>
                    <Link href={`/admin/groups/${group.id}`} className="mt-3 inline-flex text-sm font-semibold text-primary">
                      查看群組詳細資訊
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {currentView === "members" ? (
        <section className="meal-panel p-8">
          <h2 className="text-2xl font-extrabold">會員清單</h2>
          <div className="mt-6 space-y-3">
            {sortedMembers.map((member) => (
              <div key={member.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{member.displayName}</p>
                    <p className="mt-2 text-sm text-muted-foreground">會員 #{member.id} • {member.email}</p>
                    <p className="mt-2 text-sm text-muted-foreground">錢包：{member.walletAddress || "尚未綁定"}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{member.isAdmin ? "管理者" : "一般會員"}</p>
                    <p className="mt-1">{member.subscriptionActive ? "已訂閱" : "未訂閱"}</p>
                    <p className="mt-1">Token {member.tokenBalance} / Points {member.points}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {currentView === "merchants" ? (
        <section className="meal-panel p-8">
          <h2 className="text-2xl font-extrabold">店家清單</h2>
          <div className="mt-6 space-y-3">
            {sortedMerchants.map((merchant) => (
              <div key={merchant.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{merchant.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{merchant.id} • {merchant.address || "尚未填地址"}</p>
                    <p className="mt-2 text-sm text-muted-foreground">負責人：{merchant.ownerDisplayName || "未綁定"}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{merchant.delistedAt ? "已下架" : merchant.delistRequestedAt ? "申請下架中" : "上架中"}</p>
                    <p className="mt-1">菜單 {merchant.menu.length} 項</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {currentView === "orders" ? (
        <section className="meal-panel p-8">
          <h2 className="text-2xl font-extrabold">訂單清單</h2>
          <div className="mt-6 space-y-3">
            {sortedOrders.map((order) => (
              <div key={order.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">訂單 #{order.id} / {order.merchantName || order.merchantId}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{order.memberName} • {new Date(order.createdAt).toLocaleString("zh-TW")}</p>
                    <p className="mt-2 text-sm text-muted-foreground">共 {order.items.reduce((sum, item) => sum + item.quantity, 0)} 份</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{order.amountWei} Wei</p>
                    <p className="mt-1">{order.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {currentView === "diners" ? (
        <section className="meal-panel p-8">
          <h2 className="text-2xl font-extrabold">點餐人次明細</h2>
          <p className="mt-3 text-sm text-muted-foreground">目前共有 {dashboard.dinerCount} 位曾經下單的會員。</p>
          <div className="mt-6 space-y-3">
            {dinerRows.map((row) => (
              <div key={row.memberId} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{row.memberName}</p>
                    <p className="mt-2 text-sm text-muted-foreground">會員 #{row.memberId}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{row.count} 次下單</p>
                    <p className="mt-1">{row.amountWei.toString()} Wei</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {currentView === "servings" ? (
        <section className="meal-panel p-8">
          <h2 className="text-2xl font-extrabold">餐點份數明細</h2>
          <p className="mt-3 text-sm text-muted-foreground">目前平台累計送出 {dashboard.totalServings} 份餐點。</p>
          <div className="mt-6 space-y-3">
            {servingRows.map((row) => (
              <div key={row.orderId} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">訂單 #{row.orderId}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{row.memberName} / {row.merchantName}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">{row.totalServings} 份</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
