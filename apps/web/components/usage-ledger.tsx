"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchUsage, type UsageRecord } from "@/lib/api";

export function UsageLedger() {
  const [items, setItems] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      setItems(await fetchUsage(60));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "目前無法讀取使用紀錄");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="meal-panel p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="meal-section-heading max-w-none">
          <p className="meal-kicker">Usage ledger</p>
          <h1>使用紀錄</h1>
          <p>查看 Token、提案券與 ETH 流水。</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          {loading ? "更新中..." : "重新整理"}
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {loading ? <LedgerPlaceholder /> : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
            尚無可顯示的使用紀錄。
          </div>
        ) : null}
        {!loading
          ? items.map((item) => (
              <article key={item.id} className="meal-ledger-row">
                <div className="space-y-1">
                  <p className="text-base font-semibold">{humanizeAction(item.action)}</p>
                  <p className="text-sm text-muted-foreground">{item.note || formatAssetLabel(item.assetType)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-base font-semibold ${item.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatAmount(item)}
                  </p>
                  <p className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleString("zh-TW")}</p>
                </div>
              </article>
            ))
          : null}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="mt-6 text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </div>
    </section>
  );
}

function LedgerPlaceholder() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-2xl border border-border/60 bg-background/60" />
      ))}
    </>
  );
}

function humanizeAction(action: string) {
  const labels: Record<string, string> = {
    create_proposal: "建立提案",
    add_option: "提名店家",
    vote: "投票",
    place_order: "點餐支付",
    cancel_order: "取消訂單",
    subscribe: "月訂閱",
    settlement_reward: "結算獎勵",
    claim_faucet: "領取 Token",
    claim_ticket_reward: "領取提案券",
    daily_login_reward: "每日登入獎勵"
  };
  return labels[action] || action;
}

function formatAssetLabel(assetType: string) {
  if (assetType === "token") return "Token";
  if (assetType === "native") return "ETH";
  if (assetType === "proposal_ticket") return "提案券";
  return assetType || "";
}

function formatAmount(item: UsageRecord) {
  const prefix = item.direction === "credit" ? "+" : "-";
  if (item.assetType === "proposal_ticket") {
    return `${prefix}${item.amount} 張提案券`;
  }
  if (item.assetType === "native") {
    return `${prefix}${formatWeiLedgerFriendly(item.amount)}`;
  }
  return `${prefix}${item.amount} ${formatAssetLabel(item.assetType)}`;
}

const APPROX_TWD_PER_ETH = 120000n;
const WEI_PER_ETH = 1000000000000000000n;
const LEDGER_ETH_DECIMALS = 8n;
const LEDGER_ETH_SCALE = 10n ** LEDGER_ETH_DECIMALS;

function formatWeiLedgerFriendly(value: string) {
  const wei = parseWei(value);
  if (wei <= 0n) {
    return "0.00000000 ETH / NT$0";
  }

  const scaledEth = (wei * LEDGER_ETH_SCALE) / WEI_PER_ETH;
  const whole = scaledEth / LEDGER_ETH_SCALE;
  const fraction = (scaledEth % LEDGER_ETH_SCALE).toString().padStart(Number(LEDGER_ETH_DECIMALS), "0");
  const twd = Number((wei * APPROX_TWD_PER_ETH) / WEI_PER_ETH).toLocaleString("zh-TW");

  return `${whole.toString()}.${fraction} ETH / NT$${twd}`;
}

function parseWei(value: string) {
  try {
    return BigInt(value || "0");
  } catch {
    return 0n;
  }
}
