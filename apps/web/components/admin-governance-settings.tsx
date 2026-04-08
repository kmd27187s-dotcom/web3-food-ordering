"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchGovernanceParams, updateGovernanceParams, type GovernanceParams } from "@/lib/api";

const fieldGroups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: keyof GovernanceParams; label: string; help: string }>;
}> = [
  {
    title: "費率設定",
    description: "建立訂單、提案與投票每票要支付的固定費率。",
    fields: [
      { key: "createFeeWei", label: "建立訂單費 (必填)", help: "建立一筆訂單 round 的固定費。" },
      { key: "proposalFeeWei", label: "提案費 (必填)", help: "每提一間店要支付的固定費率。" },
      { key: "voteFeeWei", label: "投票費 (必填)", help: "每 1 票對應的固定費率。" },
      { key: "subscriptionFeeWei", label: "訂閱月費 (必填)", help: "每次月訂閱要支付的鏈上費用。" }
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
    description: "建立新 round 後會套用到新的提案、投票、點餐與 timeout 規則。",
    fields: [
      { key: "proposalDurationMinutes", label: "提案階段分鐘數 (必填)", help: "新建立訂單預設提案階段長度。" },
      { key: "voteDurationMinutes", label: "投票階段分鐘數 (必填)", help: "新建立訂單預設投票階段長度。" },
      { key: "orderingDurationMinutes", label: "點餐階段分鐘數 (必填)", help: "新建立訂單預設點餐階段長度。" },
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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetchGovernanceParams()
      .then(setParams)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取治理參數失敗"))
      .finally(() => setLoading(false));
  }, []);

  const fieldCount = useMemo(() => fieldGroups.reduce((sum, group) => sum + group.fields.length, 0), []);

  function updateField(key: keyof GovernanceParams, value: string) {
    setParams((current) => {
      if (!current) return current;
      const next = Number(value);
      return {
        ...current,
        [key]: Number.isFinite(next) ? next : 0
      };
    });
  }

  async function handleSave() {
    if (!params) return;
    setPending(true);
    setMessage("");
    try {
      const next = await updateGovernanceParams(params);
      setParams(next);
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
              <label key={field.key} className="grid gap-2 text-sm">
                <span className="font-semibold text-foreground">{field.label}</span>
                <input
                  type="number"
                  min={0}
                  className="meal-field"
                  value={params[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  placeholder={field.label}
                />
                <span className="text-xs leading-6 text-muted-foreground">{field.help}</span>
              </label>
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
