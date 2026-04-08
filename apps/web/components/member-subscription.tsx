"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cancelSubscription, fetchContractInfo, fetchMe, fetchPublicGovernanceParams, syncSubscription, type ContractInfo, type GovernanceParams, type Member } from "@/lib/api";
import { ensureSepoliaClients, GOVERNANCE_ABI, isUsableContractAddress, toFriendlyWalletError, waitForSubscriptionPaid } from "@/lib/chain";

export function MemberSubscription() {
  const [member, setMember] = useState<Member | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [governanceParams, setGovernanceParams] = useState<GovernanceParams | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([fetchMe(), fetchContractInfo().catch(() => null), fetchPublicGovernanceParams().catch(() => null)])
      .then(([nextMember, nextContract, nextParams]) => {
        setMember(nextMember);
        setContractInfo(nextContract);
        setGovernanceParams(nextParams);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取訂閱資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function refresh() {
    const [nextMember, nextContract, nextParams] = await Promise.all([
      fetchMe(),
      fetchContractInfo().catch(() => null),
      fetchPublicGovernanceParams().catch(() => null)
    ]);
    setMember(nextMember);
    setContractInfo(nextContract);
    setGovernanceParams(nextParams);
  }

  async function handleSubscribe() {
    setPending(true);
    try {
      const activeContractInfo = contractInfo;
      if (!isUsableContractAddress(activeContractInfo?.governanceContract) || !member?.walletAddress || !governanceParams) {
        throw new Error("目前尚未配置可用的治理合約或會員錢包。");
      }
      const governanceAddress = activeContractInfo!.governanceContract as `0x${string}`;
      const { walletClient, account } = await ensureSepoliaClients();
      const txHash = await walletClient.writeContract({
        address: governanceAddress,
        abi: GOVERNANCE_ABI,
        functionName: "subscribeMonthly",
        args: [],
        account,
        chain: walletClient.chain,
        value: BigInt(governanceParams.subscriptionFeeWei)
      });
      const paid = await waitForSubscriptionPaid(txHash);
      await syncSubscription({
        txHash,
        amountWei: paid.amountWei.toString(),
        expiresAt: new Date(paid.expiresAt * 1000).toISOString()
      });
      await refresh();
      setMessage("月訂閱已開通，期限已更新。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "訂閱付款未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  async function handleCancelSubscription() {
    setPending(true);
    try {
      const activeContractInfo = contractInfo;
      if (isUsableContractAddress(activeContractInfo?.governanceContract) && member?.walletAddress) {
        const governanceAddress = activeContractInfo!.governanceContract as `0x${string}`;
        const { walletClient, account } = await ensureSepoliaClients();
        await walletClient.writeContract({
          address: governanceAddress,
          abi: GOVERNANCE_ABI,
          functionName: "cancelSubscription",
          args: [],
          account,
          chain: walletClient.chain
        });
      }
      const updated = await cancelSubscription();
      setMember(updated);
      setMessage("已取消月訂閱，訂閱資格會立即失效。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "取消訂閱未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入訂閱管理...</div>;
  if (!member) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到訂閱資料"}</div>;

  return (
    <section className="meal-panel p-8">
      <p className="meal-kicker">Subscription</p>
      <h1 className="text-3xl font-extrabold">訂閱管理</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="目前狀態" value={member.subscriptionActive ? "已訂閱" : "尚未訂閱成為會員"} />
        <Stat label="到期時間" value={member.subscriptionExpiresAt ? new Date(member.subscriptionExpiresAt).toLocaleString("zh-TW") : "尚未開通"} />
        <Stat label="費用" value={governanceParams ? `${governanceParams.subscriptionFeeWei} Wei / ${governanceParams.subscriptionDurationDays} 天` : "鏈上月訂閱"} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={handleSubscribe} disabled={pending}>{member.subscriptionActive ? "續訂鏈上月訂閱" : "立即訂閱"}</Button>
        <Button variant="secondary" onClick={handleCancelSubscription} disabled={pending || !member.subscriptionActive}>取消訂閱</Button>
      </div>
      {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
