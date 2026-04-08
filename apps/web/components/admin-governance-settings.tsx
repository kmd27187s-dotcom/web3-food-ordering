"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchGovernanceParams, updateGovernanceParams, type GovernanceParams } from "@/lib/api";

type NumericGovernanceKey = {
  [K in keyof GovernanceParams]: GovernanceParams[K] extends number | undefined ? K : never;
}[keyof GovernanceParams];

type DurationStage = "proposal" | "vote" | "ordering";

const feeKeys = new Set<NumericGovernanceKey>([
  "createFeeWei",
  "proposalFeeWei",
  "voteFeeWei",
  "subscriptionFeeWei"
]);

const fieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: NumericGovernanceKey; label: string; help: string }>;
}> = [
  {
    title: "費率設定",
    description: "建立訂單、提案、投票與訂閱費用都以 ETH 顯示與輸入。",
    fields: [
      { key: "createFeeWei", label: "建立訂單費 (必填)", help: "建立一筆訂單 round 的固定費，請用 ETH 輸入。" },
      { key: "proposalFeeWei", label: "提案費 (必填)", help: "每提一間店要支付的固定費率，請用 ETH 輸入。" },
      { key: "voteFeeWei", label: "投票費 (必填)", help: "每 1 票對應的固定費率，請用 ETH 輸入。" },
      { key: "subscriptionFeeWei", label: "訂閱月費 (必填)", help: "每次月訂閱要支付的鏈上費用，請用 ETH 輸入。" }
    ]
  },
  {
    title: "退款與獎勵比例",
    description: "皆以 bps 萬分比設定，例如 9000 代表 90%。",
    fields: [
      { key: "winnerProposalRefundBps", label: "優勝提案退款比例 (必填)", help: "優勝店提案人退款比例。" },
      { key: "loserProposalRefundBps", label: "落選提案退款比例 (必填)", help: "落選店提案人退款比例。" },
      { key: "voteRefundBps", label: "投票退款比例 (必填)", help: "所有投票人退款比例。" },
      { key: "winnerBonusBps", label: "優勝提案人獎勵比例 (必填)", help: "依該店投票池退款後餘額計算。" },
      { key: "loserBonusBps", label: "落選提案人安慰獎比例 (必填)", help: "依該店投票池退款後餘額計算。" },
      { key: "platformEscrowFeeBps", label: "平台餐費抽成比例 (必填)", help: "Escrow 餐費可抽成比例，可先設 0。" }
    ]
  },
  {
    title: "積分與每日券",
    description: "會員完成治理行為後取得的積分與每日可領優惠券張數。",
    fields: [
      { key: "winnerProposalPoints", label: "優勝提案積分 (必填)", help: "優勝店提案人可獲得的積分。" },
      { key: "winnerVotePointsPerVote", label: "優勝投票每票積分 (必填)", help: "投給優勝店每票給幾分。" },
      { key: "dailyCreateCouponCount", label: "每日建立訂單優惠券數 (必填)", help: "每天 00:00 後可重新領取的張數。" },
      { key: "dailyProposalCouponCount", label: "每日提案優惠券數 (必填)", help: "每天 00:00 後可重新領取的張數。" },
      { key: "dailyVoteCouponCount", label: "每日投票優惠券數 (必填)", help: "每天 00:00 後可重新領取的張數。" }
    ]
  },
  {
    title: "時間設定",
    description: "在同一區塊設定每個階段的預設分鐘數，以及前端下拉式選單可讓會員選擇的時間組合。",
    fields: [
      { key: "proposalDurationMinutes", label: "提案階段預設分鐘數 (必填)", help: "如果前端沒有另外指定，會先帶入這個預設值。" },
      { key: "voteDurationMinutes", label: "投票階段預設分鐘數 (必填)", help: "如果前端沒有另外指定，會先帶入這個預設值。" },
      { key: "orderingDurationMinutes", label: "點餐階段預設分鐘數 (必填)", help: "如果前端沒有另外指定，會先帶入這個預設值。" },
    ]
  },
  {
    title: "逾時設定",
    description: "店家、會員與 claim timeout 等逾時規則。",
    fields: [
      { key: "autoPayoutDelayDays", label: "自動撥款延遲天數 (必填)", help: "會員確認收餐後，延遲幾天於當天 23:59 自動批次撥款。" },
      { key: "merchantAcceptTimeoutMins", label: "店家接單逾時分鐘數 (必填)", help: "超過此時間可進入逾時處理。" },
      { key: "merchantCompleteTimeoutMins", label: "店家完成逾時分鐘數 (必填)", help: "店家已接單後最晚應完成的時間。" },
      { key: "memberConfirmTimeoutMins", label: "會員確認逾時分鐘數 (必填)", help: "超過後可自動視為已完成。" },
      { key: "governanceClaimTimeoutMins", label: "治理款領取逾時分鐘數 (必填)", help: "超過後可進 timeout recovery。" },
      { key: "escrowClaimTimeoutMins", label: "Escrow 領款逾時分鐘數 (必填)", help: "超過後可進 timeout recovery。" }
    ]
  },
  {
    title: "訂閱設定",
    description: "月訂閱的鏈上費用與有效天數。",
    fields: [
      { key: "subscriptionDurationDays", label: "訂閱有效天數 (必填)", help: "每次成功訂閱後往後延長的天數。" }
    ]
  }
];

export function AdminGovernanceSettings() {
  const [params, setParams] = useState<GovernanceParams | null>(null);
  const [feeText, setFeeText] = useState<Record<string, string>>({});
  const [durationOptionText, setDurationOptionText] = useState({
    proposal: "",
    vote: "",
    ordering: ""
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetchGovernanceParams()
      .then((next) => {
        setParams(next);
        setFeeText(buildFeeText(next));
        setDurationOptionText({
          proposal: (next.proposalDurationOptions || [next.proposalDurationMinutes]).join(", "),
          vote: (next.voteDurationOptions || [next.voteDurationMinutes]).join(", "),
          ordering: (next.orderingDurationOptions || [next.orderingDurationMinutes]).join(", ")
        });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取治理參數失敗"))
      .finally(() => setLoading(false));
  }, []);

  const fieldCount = useMemo(() => fieldGroups.reduce((sum, group) => sum + group.fields.length, 0), []);
  const currentDurationOptions = useMemo(
    () => ({
      proposal: parseOptionText(durationOptionText.proposal, params?.proposalDurationMinutes ?? 1),
      vote: parseOptionText(durationOptionText.vote, params?.voteDurationMinutes ?? 1),
      ordering: parseOptionText(durationOptionText.ordering, params?.orderingDurationMinutes ?? 1)
    }),
    [durationOptionText, params]
  );

  function updateField(key: NumericGovernanceKey, value: string) {
    if (feeKeys.has(key)) {
      const fieldKey = key as string;
      setFeeText((current) => ({ ...current, [fieldKey]: value }));
      setParams((current) => {
        if (!current) return current;
        return {
          ...current,
          [fieldKey]: parseEthToWeiNumber(value)
        } as GovernanceParams;
      });
      return;
    }
    setParams((current) => {
      if (!current) return current;
      const next = Number(value);
      const fieldKey = key as string;
      return {
        ...current,
        [fieldKey]: Number.isFinite(next) ? next : 0
      } as GovernanceParams;
    });
  }

  function parseOptionText(value: string, fallback: number) {
    const values = value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0)
      .map((item) => Math.trunc(item));
    return Array.from(new Set([fallback, ...values])).sort((a, b) => a - b);
  }

  function removeDurationOption(stage: "proposal" | "vote" | "ordering", minutes: number) {
    setDurationOptionText((current) => {
      const fallback =
        stage === "proposal"
          ? params?.proposalDurationMinutes ?? 1
          : stage === "vote"
            ? params?.voteDurationMinutes ?? 1
            : params?.orderingDurationMinutes ?? 1;
      const nextValues = parseOptionText(current[stage], fallback).filter((item) => item !== minutes);
      return {
        ...current,
        [stage]: nextValues.join(", ")
      };
    });
  }

  function getDurationStageConfig(key: NumericGovernanceKey): { stage: DurationStage; options: number[]; text: string } | null {
    if (key === "proposalDurationMinutes") {
      return { stage: "proposal", options: currentDurationOptions.proposal, text: durationOptionText.proposal };
    }
    if (key === "voteDurationMinutes") {
      return { stage: "vote", options: currentDurationOptions.vote, text: durationOptionText.vote };
    }
    if (key === "orderingDurationMinutes") {
      return { stage: "ordering", options: currentDurationOptions.ordering, text: durationOptionText.ordering };
    }
    return null;
  }

  async function handleSave() {
    if (!params) return;
    setPending(true);
    setMessage("");
    try {
      const next = await updateGovernanceParams({
        ...params,
        proposalDurationOptions: parseOptionText(durationOptionText.proposal, params.proposalDurationMinutes),
        voteDurationOptions: parseOptionText(durationOptionText.vote, params.voteDurationMinutes),
        orderingDurationOptions: parseOptionText(durationOptionText.ordering, params.orderingDurationMinutes)
      });
      setParams(next);
      setFeeText(buildFeeText(next));
      setDurationOptionText({
        proposal: (next.proposalDurationOptions || [next.proposalDurationMinutes]).join(", "),
        vote: (next.voteDurationOptions || [next.voteDurationMinutes]).join(", "),
        ordering: (next.orderingDurationOptions || [next.orderingDurationMinutes]).join(", ")
      });
      setMessage("治理參數已更新，之後新建立的 round 會套用新數值。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新治理參數失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入治理參數...</div>;
  }

  if (!params) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">目前無法讀取治理參數。</div>;
  }

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Governance params</p>
        <h1 className="text-3xl font-extrabold">治理參數設定</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          這裡的數值會作用在之後新建立的 round；既有 round 會保留建立當下的參數快照。共 {fieldCount} 個可調欄位。
        </p>
      </section>

      {fieldGroups.map((group) => (
        <section key={group.title} className="meal-panel p-8">
          <p className="meal-kicker">{group.title}</p>
          <h2 className="text-2xl font-extrabold">{group.title}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{group.description}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {group.fields.map((field) => (
              (() => {
                const fieldKey = field.key as string;
                const isFeeField = feeKeys.has(field.key);
                const durationConfig = getDurationStageConfig(field.key);
                return (
                  <label key={field.key} className="grid gap-2 text-sm">
                    <span className="font-semibold text-foreground">{field.label}</span>
                    <input
                      type="text"
                      inputMode={isFeeField ? "decimal" : "numeric"}
                      className="meal-field"
                      value={isFeeField ? feeText[fieldKey] ?? "" : String(Number(params[field.key as keyof GovernanceParams] ?? 0))}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      placeholder={isFeeField ? "例如：0.001" : field.label}
                    />
                    <span className="text-xs leading-6 text-muted-foreground">
                      {field.help}
                      {isFeeField ? ` 目前約 ${formatWeiToEthString(Number(params[field.key as keyof GovernanceParams] ?? 0))} ETH。` : ""}
                    </span>
                    {durationConfig ? (
                      <div className="mt-2 rounded-[1rem] border border-border/70 bg-secondary/30 p-3">
                        <p className="text-xs font-semibold text-foreground">前端可選時間</p>
                        <p className="mt-1 text-xs leading-6 text-muted-foreground">
                          目前已設定 {durationConfig.options.length} 種選項。可直接在下方輸入多個分鐘數，或點擊既有選項移除。
                        </p>
                        <input
                          className="meal-field mt-3"
                          value={durationConfig.text}
                          onChange={(event) =>
                            setDurationOptionText((current) => ({
                              ...current,
                              [durationConfig.stage]: event.target.value
                            }))
                          }
                          placeholder="1, 10, 20, 30"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {durationConfig.options.map((item) => (
                            <button
                              key={`${durationConfig.stage}-${item}`}
                              type="button"
                              className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground transition hover:border-destructive hover:text-destructive"
                              onClick={() => removeDurationOption(durationConfig.stage, item)}
                            >
                              {item} 分鐘 ×
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </label>
                );
              })()
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "儲存中..." : "儲存治理參數"}
        </Button>
        {message ? <p className="text-sm text-primary">{message}</p> : null}
      </div>
    </div>
  );
}

function buildFeeText(params: GovernanceParams) {
  return {
    createFeeWei: formatWeiToEthString(params.createFeeWei),
    proposalFeeWei: formatWeiToEthString(params.proposalFeeWei),
    voteFeeWei: formatWeiToEthString(params.voteFeeWei),
    subscriptionFeeWei: formatWeiToEthString(params.subscriptionFeeWei)
  };
}

function formatWeiToEthString(value: number) {
  const amount = BigInt(value || 0);
  const integer = amount / 10n ** 18n;
  const fraction = amount % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "");
  return fractionText ? `${integer}.${fractionText}` : integer.toString();
}

function parseEthToWeiNumber(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0;
  const [whole, decimal = ""] = trimmed.split(".");
  const normalized = `${whole}.${decimal}`.replace(/\.$/, "");
  const [normalizedWhole, normalizedDecimal = ""] = normalized.split(".");
  const wei =
    BigInt(normalizedWhole || "0") * 10n ** 18n +
    BigInt((normalizedDecimal + "0".repeat(18)).slice(0, 18) || "0");
  return Number(wei);
}
