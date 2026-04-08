"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchAdminDashboard, markAdminOrderPaid, markAdminOrdersPaid, updateGovernanceParams, updatePlatformTreasury, type AdminDashboard } from "@/lib/api";
import { connectWallet } from "@/lib/wallet-auth";

export function AdminPayouts() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(false);
  const [autoPayoutDelayDays, setAutoPayoutDelayDays] = useState("2");

  async function refresh() {
    const dashboard = await fetchAdminDashboard();
    setData(dashboard);
    setAutoPayoutEnabled(Boolean(dashboard.governanceParams?.autoPayoutEnabled));
    setAutoPayoutDelayDays(String(dashboard.governanceParams?.autoPayoutDelayDays ?? 2));
    setSelectedOrderIds((current) => current.filter((orderId) => dashboard.readyPayoutOrders.some((order) => order.orderId === orderId)));
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取平台撥款資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function handleBindPlatformTreasury() {
    setPending(true);
    setMessage("");
    try {
      const address = await connectWallet();
      await updatePlatformTreasury(address);
      await refresh();
      setMessage("平台中心錢包已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "平台中心錢包更新失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveAutoPayout() {
    if (!data?.governanceParams) return;
    setPending(true);
    setMessage("");
    try {
      const delay = Math.max(0, Math.trunc(Number(autoPayoutDelayDays) || 0));
      await updateGovernanceParams({
        ...data.governanceParams,
        autoPayoutEnabled,
        autoPayoutDelayDays: delay
      });
      await refresh();
      setMessage("自動撥款設定已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "自動撥款設定更新失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleReleasePayout(orderId: number) {
    setPending(true);
    setMessage("");
    try {
      await markAdminOrderPaid(orderId);
      await refresh();
      setMessage("已完成手動撥款，該訂單會從待撥款清單移除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "手動撥款失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleBatchReleasePayout() {
    if (!selectedOrderIds.length) {
      setMessage("請先勾選至少一筆待撥款訂單。");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const result = await markAdminOrdersPaid(selectedOrderIds);
      await refresh();
      setSelectedOrderIds([]);
      setMessage(`已完成 ${result.count} 筆批次手動撥款。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批次手動撥款失敗");
    } finally {
      setPending(false);
    }
  }

  function toggleOrderSelection(orderId: number, checked: boolean) {
    setSelectedOrderIds((current) =>
      checked ? Array.from(new Set([...current, orderId])) : current.filter((item) => item !== orderId)
    );
  }

  function toggleSelectAll(checked: boolean) {
    if (!data) return;
    setSelectedOrderIds(checked ? data.readyPayoutOrders.map((order) => order.orderId) : []);
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入平台撥款頁...</div>;
  }

  if (!data) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "讀取資料失敗"}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Platform treasury</p>
        <h1 className="text-3xl font-extrabold">平台錢包與撥款</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">平台管理者在這裡綁定中心錢包，並處理會員完成取餐後的撥款。</p>
      </section>

      <section className="meal-panel p-8">
        <h2 className="text-2xl font-extrabold">平台中心錢包</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-[1.2rem] border border-[rgba(220,193,177,0.38)] bg-[rgba(255,255,255,0.62)] px-4 py-4 text-sm text-muted-foreground">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">目前平台錢包</p>
            <p className="mt-2 break-all text-sm text-foreground">{data.platformTreasury || "尚未設定"}</p>
          </div>
          <Button disabled={pending} onClick={handleBindPlatformTreasury}>
            {data.platformTreasury ? "更換平台錢包" : "連結並設定平台錢包"}
          </Button>
        </div>
      </section>

      <section className="meal-panel p-8">
        <h2 className="text-2xl font-extrabold">自動撥款設定</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          會員確認收餐後，訂單會先進入待撥款清單；如果啟用自動撥款，系統會在延遲天數到期當天的 23:59 自動批次處理。
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-end">
          <label className="flex items-center gap-3 rounded-[1rem] border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={autoPayoutEnabled}
              onChange={(event) => setAutoPayoutEnabled(event.target.checked)}
            />
            啟用自動撥款
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">自動撥款延遲天數</span>
            <input
              type="number"
              min={0}
              className="meal-field"
              value={autoPayoutDelayDays}
              onChange={(event) => setAutoPayoutDelayDays(event.target.value)}
            />
          </label>
          <Button disabled={pending} onClick={handleSaveAutoPayout}>
            儲存自動撥款設定
          </Button>
        </div>
      </section>

      <section className="meal-panel p-8">
        <h2 className="text-2xl font-extrabold">待撥款訂單</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border bg-background/60 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 font-semibold text-foreground">
            <input
              type="checkbox"
              checked={Boolean(data.readyPayoutOrders.length) && selectedOrderIds.length === data.readyPayoutOrders.length}
              onChange={(event) => toggleSelectAll(event.target.checked)}
            />
            全選待撥款訂單
          </label>
          <Button disabled={pending || selectedOrderIds.length === 0} onClick={handleBatchReleasePayout}>
            批次手動撥款 {selectedOrderIds.length ? `(${selectedOrderIds.length})` : ""}
          </Button>
        </div>
        <div className="mt-6 space-y-4">
          {data.readyPayoutOrders.length === 0 ? <p className="text-sm text-muted-foreground">目前沒有待撥款訂單。</p> : null}
          {data.readyPayoutOrders.map((order) => (
            <div key={order.orderId} className="rounded-[1.4rem] border border-border bg-background/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.orderId)}
                      onChange={(event) => toggleOrderSelection(order.orderId, event.target.checked)}
                    />
                    納入批次手動撥款
                  </label>
                  <p className="font-bold">{order.title || `訂單 #${order.orderId}`} / {order.merchantName}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{order.memberName} • {new Date(order.createdAt).toLocaleString("zh-TW")}</p>
                  {order.confirmedAt ? <p className="mt-2 text-sm text-muted-foreground">會員確認時間：{new Date(order.confirmedAt).toLocaleString("zh-TW")}</p> : null}
                  {order.autoPayoutAt ? <p className="mt-2 text-sm text-[hsl(25_85%_36%)]">自動撥款時間：{new Date(order.autoPayoutAt).toLocaleString("zh-TW")}</p> : null}
                  <p className="mt-2 break-all text-sm text-muted-foreground">店家收款錢包：{order.merchantPayoutAddress}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatWeiToEth(order.amountWei)} ETH</p>
                  <p className="mt-1 text-sm text-muted-foreground">{order.status}</p>
                </div>
              </div>
              <Button className="mt-4" disabled={pending} onClick={() => handleReleasePayout(order.orderId)}>
                手動撥款
              </Button>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}

function formatWeiToEth(value: string | number | bigint) {
  const amount = BigInt(value || 0);
  const integer = amount / 10n ** 18n;
  const fraction = amount % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${integer.toString()}${fractionText ? `.${fractionText}` : ""}`;
}
