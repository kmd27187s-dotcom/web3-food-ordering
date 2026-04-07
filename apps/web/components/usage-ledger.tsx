"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchRegistrationInviteUsage, fetchUsage, type RegistrationInviteUsage, type UsageRecord } from "@/lib/api";

type LedgerTab = "usage" | "proposal-ticket" | "vote-ticket" | "create-order-ticket" | "invite";

export function UsageLedger({ initialTab = "usage" }: { initialTab?: LedgerTab }) {
  const [items, setItems] = useState<UsageRecord[]>([]);
  const [inviteItems, setInviteItems] = useState<RegistrationInviteUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<LedgerTab>(initialTab);

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const [usage, inviteUsage] = await Promise.all([
        fetchUsage(120),
        fetchRegistrationInviteUsage().catch(() => [])
      ]);
      setItems(usage);
      setInviteItems(inviteUsage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "目前無法讀取使用紀錄");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredItems = items.filter((item) => {
    if (tab === "proposal-ticket") return item.assetType === "proposal_ticket";
    if (tab === "vote-ticket") return item.assetType === "vote_ticket";
    if (tab === "create-order-ticket") return item.assetType === "create_order_ticket";
    if (tab === "usage") return true;
    return false;
  });

  return (
    <section className="meal-panel p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="meal-section-heading max-w-none">
          <p className="meal-kicker">Usage ledger</p>
          <h1>使用紀錄</h1>
          <p>查看 Token、提案券、建立訂單券與邀請碼使用紀錄。</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          {loading ? "更新中..." : "重新整理"}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {[
          ["usage", "全部流水"],
          ["proposal-ticket", "提案券紀錄"],
          ["vote-ticket", "投票券紀錄"],
          ["create-order-ticket", "建立訂單券紀錄"],
          ["invite", "個人邀請碼紀錄"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as LedgerTab)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === value
                ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,255,255,0.85)] text-primary"
                : "border-border bg-background/70 text-muted-foreground hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        {loading ? <LedgerPlaceholder /> : null}
        {!loading && tab === "invite" && inviteItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
            目前還沒有個人邀請碼使用紀錄。
          </div>
        ) : null}
        {!loading && tab !== "invite" && filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
            尚無可顯示的使用紀錄。
          </div>
        ) : null}
        {!loading && tab === "invite"
          ? inviteItems.map((item) => (
              <article key={item.id} className="meal-ledger-row">
                <div className="space-y-1">
                  <p className="text-base font-semibold">邀請新會員成功</p>
                  <p className="text-sm text-muted-foreground">使用人：{item.usedByName}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-emerald-600">{item.inviteCode}</p>
                  <p className="text-sm text-muted-foreground">{new Date(item.usedAt).toLocaleString("zh-TW")}</p>
                </div>
              </article>
            ))
          : !loading
            ? filteredItems.map((item) => (
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
    claim_order_ticket_reward: "領取建立訂單券",
    daily_login_reward: "每日登入獎勵"
  };
  return labels[action] || action;
}

function formatAssetLabel(assetType: string) {
  if (assetType === "token") return "Token";
  if (assetType === "native") return "ETH";
  if (assetType === "proposal_ticket") return "提案券";
  if (assetType === "vote_ticket") return "投票券";
  if (assetType === "create_order_ticket") return "建立訂單券";
  return assetType || "";
}

function formatAmount(item: UsageRecord) {
  const prefix = item.direction === "credit" ? "+" : "-";
  if (item.assetType === "proposal_ticket") {
    return `${prefix}${item.amount} 張提案券`;
  }
  if (item.assetType === "vote_ticket") {
    return `${prefix}${item.amount} 張投票券`;
  }
  if (item.assetType === "create_order_ticket") {
    return `${prefix}${item.amount} 張建立訂單券`;
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
