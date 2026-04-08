"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { confirmMemberOrder, fetchContractInfo, fetchGroupDetail, fetchMyOrderHistory, type ContractInfo, type Order } from "@/lib/api";
import { ESCROW_ABI, ensureSepoliaClients, isUsableContractAddress, toFriendlyWalletError } from "@/lib/chain";
import { OrderDetailPanel } from "@/components/member-order-shared";

type MemberOrderDetailProps =
  | { orderId: number; groupId?: undefined }
  | { orderId: number; groupId: number };

export function MemberOrderDetailView(props: MemberOrderDetailProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    if (props.groupId) {
      const detail = await fetchGroupDetail(props.groupId);
      const dedup = new Map<number, Order>();
      detail.members.forEach((member) => {
        member.recentOrders.forEach((order) => {
          if (!dedup.has(order.id)) dedup.set(order.id, order);
        });
      });
      setOrders(Array.from(dedup.values()));
      setContractInfo(await fetchContractInfo().catch(() => null));
      return;
    }

    const [history, contract] = await Promise.all([fetchMyOrderHistory(), fetchContractInfo().catch(() => null)]);
    setOrders(history.orders);
    setContractInfo(contract);
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取訂單詳細資料失敗"))
      .finally(() => setLoading(false));
  }, [props.groupId, props.orderId]);

  const order = useMemo(() => orders.find((item) => item.id === props.orderId) || null, [orders, props.orderId]);

  async function handleConfirm() {
    if (!order) return;
    setPending(true);
    try {
      if (order.escrowOrderId && isUsableContractAddress(contractInfo?.orderEscrowContract)) {
        const { walletClient, publicClient, account } = await ensureSepoliaClients();
        const txHash = await walletClient.writeContract({
          address: contractInfo!.orderEscrowContract as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: "memberConfirmReceived",
          args: [BigInt(order.escrowOrderId)],
          account,
          chain: walletClient.chain
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      await confirmMemberOrder(order.id);
      await refresh();
      setMessage("已確認接收訂單。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "確認收貨未成功，請重新操作。"));
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入訂單詳細資料...</div>;
  }

  if (!order) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到這筆訂單"}</div>;
  }

  return (
    <div className="space-y-6">
      <OrderDetailPanel
        order={order}
        backHref={props.groupId ? `/member/groups/${props.groupId}/orders` : "/member/orders"}
        backLabel={props.groupId ? "回群組歷史訂單" : "回訂單紀錄"}
        action={order.status === "merchant_completed" && !props.groupId ? (
          <Button disabled={pending} onClick={handleConfirm}>確認接收</Button>
        ) : undefined}
      />
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
