"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchContractInfo, fetchMe, fetchPublicGovernanceParams, registerPendingTransaction, syncSubscription, type ContractInfo, type GovernanceParams, type Member } from "@/lib/api";
import { isUsableContractAddress, sendNativePayment, toFriendlyWalletError } from "@/lib/chain";

const SUBSCRIPTION_SYNC_KEY = "member-subscription-pending-sync";

function readPendingSubscriptionSync() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(SUBSCRIPTION_SYNC_KEY) || "";
}

function writePendingSubscriptionSync(txHash: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SUBSCRIPTION_SYNC_KEY, txHash);
}

function clearPendingSubscriptionSync() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SUBSCRIPTION_SYNC_KEY);
}

function redirectToMemberHome() {
  if (typeof window !== "undefined") {
    window.location.assign("/member");
    return;
  }
}

export function SubscriptionCheckpoint() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [governanceParams, setGovernanceParams] = useState<GovernanceParams | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([fetchMe(), fetchContractInfo().catch(() => null), fetchPublicGovernanceParams().catch(() => null)])
      .then(([nextMember, nextContract, nextParams]) => {
        if (nextMember.subscriptionActive) {
          redirectToMemberHome();
          return;
        }
        setMember(nextMember);
        setContractInfo(nextContract);
        setGovernanceParams(nextParams);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "目前無法讀取訂閱狀態");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (loading) return;
    const pendingTxHash = readPendingSubscriptionSync();
    if (!pendingTxHash) return;
    setPending(true);
    setMessage("偵測到上一筆訂閱付款已送出，正在補回同步結果...");
    syncSubscription({ txHash: pendingTxHash, expiresAt: "" })
      .then(() => {
        clearPendingSubscriptionSync();
        redirectToMemberHome();
      })
      .catch(() => setMessage("上一筆訂閱付款已送出，但同步仍在處理中。請稍後重新整理確認結果，暫時不要重複付款。"))
      .finally(() => setPending(false));
  }, [loading, router]);

  async function handleSubscribe() {
    setPending(true);
    setMessage("");
    let paymentSubmitted = false;
    try {
      const activeContractInfo = contractInfo;
      if (!isUsableContractAddress(activeContractInfo?.platformTreasury) || !governanceParams) {
        throw new Error("目前尚未配置可用的平台收款錢包。");
      }
      const { hash } = await sendNativePayment(
        activeContractInfo!.platformTreasury as `0x${string}`,
        BigInt(governanceParams.subscriptionFeeWei)
      );
      writePendingSubscriptionSync(hash);
      paymentSubmitted = true;
      await registerPendingTransaction({
        proposalId: 0,
        action: "subscribe",
        txHash: hash,
        walletAddress: member?.walletAddress || undefined
      }).catch(() => undefined);
      await syncSubscription({
        txHash: hash,
        expiresAt: ""
      });
      clearPendingSubscriptionSync();
      redirectToMemberHome();
    } catch (error) {
      setMessage(
        paymentSubmitted
          ? "付款已送出，但訂閱同步失敗。請重新整理後確認是否已開通；若仍未更新，再重新操作。"
          : toFriendlyWalletError(error, "訂閱付款未成功，請重新操作。")
      );
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="meal-panel p-8 text-sm text-muted-foreground">正在確認訂閱狀態...</div>;
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[rgba(194,119,60,0.22)] bg-[linear-gradient(135deg,rgba(255,250,244,0.98),rgba(245,235,224,0.94))] p-8 shadow-[0_24px_64px_rgba(93,54,27,0.1)]">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="meal-section-heading">
            <p className="meal-kicker">Subscription checkpoint</p>
            <h1>尚未訂閱成為會員。</h1>
            <p>{governanceParams ? `${formatWeiToEth(governanceParams.subscriptionFeeWei)} ETH / ${governanceParams.subscriptionDurationDays} 天。` : "鏈上月訂閱。"}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <AccessStat label="會員" value={member?.displayName || "—"} />
            <AccessStat label="訂閱費用" value={governanceParams ? `${formatWeiToEth(governanceParams.subscriptionFeeWei)} ETH` : "鏈上月訂閱"} />
            <AccessStat label="有效期間" value={governanceParams ? `${governanceParams.subscriptionDurationDays} 天` : "30 天"} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSubscribe} disabled={pending} className="meal-hero-gradient min-w-[16rem] rounded-[1.2rem] px-6 py-3.5 text-sm font-bold tracking-[0.04em] text-white shadow-[0_18px_32px_rgba(154,68,45,0.18)]">
              {pending ? "處理中..." : "立即訂閱"}
            </Button>
            <Button variant="ghost" onClick={() => router.push("/")}>離開</Button>
            <p className="text-sm text-muted-foreground">付款後進入會員頁。</p>
          </div>
        </div>

        <div className="meal-glass-card rounded-[1.75rem] p-6">
          <p className="meal-kicker">開通後立即可用</p>
          <div className="mt-5 space-y-4">
            {[
              "會員頁",
              "建立訂單 / 成立中訂單",
              "紀錄頁"
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-2 h-2.5 w-2.5 rounded-full bg-foreground/75" />
                <p className="text-sm leading-7 text-foreground/78">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="mt-6 text-sm text-primary">{message}</p> : null}
      </div>
    </section>
  );
}

function formatWeiToEth(value: number) {
  const amount = BigInt(value || 0);
  const integer = amount / 10n ** 18n;
  const fraction = amount % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${integer.toString()}${fractionText ? `.${fractionText}` : ""}`;
}

function AccessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[rgba(220,193,177,0.38)] bg-white/72 px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
