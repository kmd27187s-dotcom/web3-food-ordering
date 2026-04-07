"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchAdminDashboard, markAdminOrderPaid, updatePlatformTreasury, type AdminDashboard } from "@/lib/api";
import { ensureSepoliaWallet, isUsableContractAddress } from "@/lib/chain";
import { connectWallet } from "@/lib/wallet-auth";

export function AdminPayouts() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const dashboard = await fetchAdminDashboard();
    setData(dashboard);
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

  async function handleReleasePayout(orderId: number, payoutAddress: string, amountWei: string) {
    if (!data?.platformTreasury || !isUsableContractAddress(data.platformTreasury)) {
      setMessage("請先設定可用的平台中心錢包。");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const walletClient = await ensureSepoliaWallet();
      const [walletAddress] = await walletClient.getAddresses();
      if (walletAddress.toLowerCase() !== data.platformTreasury.toLowerCase()) {
        throw new Error("目前連結的 MetaMask 不是已綁定的平台中心錢包。");
      }
      await walletClient.sendTransaction({
        to: payoutAddress as `0x${string}`,
        value: BigInt(amountWei),
        account: walletAddress
      });
      await markAdminOrderPaid(orderId);
      await refresh();
      setMessage("已從平台中心錢包撥款給店家。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "平台撥款失敗");
    } finally {
      setPending(false);
    }
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
        <h2 className="text-2xl font-extrabold">待撥款訂單</h2>
        <div className="mt-6 space-y-4">
          {data.readyPayoutOrders.length === 0 ? <p className="text-sm text-muted-foreground">目前沒有待撥款訂單。</p> : null}
          {data.readyPayoutOrders.map((order) => (
            <div key={order.orderId} className="rounded-[1.4rem] border border-border bg-background/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">訂單 #{order.orderId} / {order.merchantName}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{order.memberName} • {new Date(order.createdAt).toLocaleString("zh-TW")}</p>
                  <p className="mt-2 break-all text-sm text-muted-foreground">店家收款錢包：{order.merchantPayoutAddress}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{order.amountWei} Wei</p>
                  <p className="mt-1 text-sm text-muted-foreground">{order.status}</p>
                </div>
              </div>
              <Button className="mt-4" disabled={pending} onClick={() => handleReleasePayout(order.orderId, order.merchantPayoutAddress, order.amountWei)}>
                從平台錢包撥款
              </Button>
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}
