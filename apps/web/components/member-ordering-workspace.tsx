"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBasket, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  addProposalOption,
  confirmMemberOrder,
  createProposal,
  deleteProposal,
  fetchContractInfo,
  fetchGroups,
  fetchMe,
  fetchMerchant,
  fetchMerchants,
  fetchProposals,
  finalizeOrder,
  quoteVote,
  registerPendingTransaction,
  signOrder,
  type ContractInfo,
  type Group,
  type Member,
  type Merchant,
  type Order,
  type Proposal,
  type VoteRecord,
  voteProposal
} from "@/lib/api";
import { ensureSepoliaWallet, getWalletBalanceWei, isUsableContractAddress, ORDER_ABI } from "@/lib/chain";
import { OrderSummaryCard } from "@/components/member-order-shared";

type Stage = "create" | "proposal" | "voting" | "ordering" | "submitted";

type CreateDraft = {
  groupId: string;
  title: string;
  maxOptions: string;
  proposalMinutes: string;
  voteMinutes: string;
  orderMinutes: string;
  merchantId: string;
};

type WorkspaceState = {
  member: Member | null;
  groups: Group[];
  proposals: Proposal[];
  merchants: Merchant[];
  contractInfo: ContractInfo | null;
};

const stageDurationOptions = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const APPROX_TWD_PER_ETH = 120000;
const defaultCreateDraft: CreateDraft = {
  groupId: "",
  title: "",
  maxOptions: "5",
  proposalMinutes: "1",
  voteMinutes: "1",
  orderMinutes: "1",
  merchantId: ""
};

type StageSortKey = "newest" | "oldest" | "title" | "options_desc" | "votes_desc" | "orders_desc" | "deadline_soon";

export function MemberOrderingWorkspace({ stage, proposalId }: { stage: Stage; proposalId?: number }) {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState>({ member: null, groups: [], proposals: [], merchants: [], contractInfo: null });
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [createDraft, setCreateDraft] = useState<CreateDraft>(defaultCreateDraft);
  const [createMerchantQuery, setCreateMerchantQuery] = useState("");
  const [optionMerchantId, setOptionMerchantId] = useState("");
  const [optionMerchantQuery, setOptionMerchantQuery] = useState("");
  const [voteTokens, setVoteTokens] = useState("");
  const [useCreateOrderTicket, setUseCreateOrderTicket] = useState(false);
  const [useProposalTicket, setUseProposalTicket] = useState(false);
  const [useVoteTicket, setUseVoteTicket] = useState(false);
  const [voteQuoteMessage, setVoteQuoteMessage] = useState("");
  const [menus, setMenus] = useState<Record<string, Merchant>>({});
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [stageSort, setStageSort] = useState<StageSortKey>("newest");

  const refresh = useCallback(async () => {
    const [me, groups, proposals, contractInfo, merchants] = await Promise.all([
      fetchMe(),
      fetchGroups(),
      fetchProposals(),
      fetchContractInfo().catch(() => null),
      fetchMerchants().catch(() => [])
    ]);
    const normalizedProposals = safeArray(proposals).map(normalizeProposal);
    setState({
      member: me,
      groups,
      proposals: normalizedProposals,
      merchants: Array.isArray(merchants) ? merchants : [],
      contractInfo
    });
    setCreateDraft((current) => ({
      ...current,
      groupId: current.groupId || (groups[0] ? String(groups[0].id) : "")
    }));
  }, []);

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取建立訂單資料失敗"))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const targetMerchantIds = new Set<string>();
    state.proposals.forEach((proposal) => {
      const winner = proposal.options.find((option) => option.id === proposal.winnerOptionId);
      if (winner?.merchantId) targetMerchantIds.add(winner.merchantId);
    });
    targetMerchantIds.forEach((merchantId) => {
      if (menus[merchantId]) return;
      fetchMerchant(merchantId)
        .then((merchant) => setMenus((current) => ({ ...current, [merchantId]: merchant })))
        .catch(() => undefined);
    });
  }, [menus, state.proposals]);

  const stageProposals = useMemo(() => {
    switch (stage) {
      case "proposal":
        return state.proposals.filter((proposal) => proposal.status === "proposing");
      case "voting":
        return state.proposals.filter((proposal) => proposal.status === "voting");
      case "ordering":
        return state.proposals.filter((proposal) => proposal.status === "ordering");
      case "submitted":
        return state.proposals.filter((proposal) => {
          const hasWinner = proposal.options.some((option) => option.id === proposal.winnerOptionId);
          return hasWinner || proposal.orderMemberCount > 0 || proposal.orders.length > 0;
        });
      case "create":
      default:
        return state.proposals.filter((proposal) => proposal.status === "proposing");
    }
  }, [stage, state.proposals]);
  const sortedStageProposals = useMemo(() => {
    const items = [...stageProposals];
    return items.sort((left, right) => {
      switch (stageSort) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "title":
          return left.title.localeCompare(right.title, "zh-TW");
        case "options_desc":
          return right.options.length - left.options.length;
        case "votes_desc":
          return safeArray(right.votes).length - safeArray(left.votes).length;
        case "orders_desc":
          return right.orderMemberCount - left.orderMemberCount;
        case "deadline_soon":
          return relevantDeadline(left, stage).getTime() - relevantDeadline(right, stage).getTime();
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }, [stage, stageProposals, stageSort]);

  const detail = useMemo(() => sortedStageProposals.find((proposal) => proposal.id === proposalId) || null, [proposalId, sortedStageProposals]);

  async function handleCreateOrder() {
    if (!createDraft.title.trim() || !createDraft.groupId) return;
    const resolvedMerchantId = resolveMerchantId(createDraft.merchantId, createMerchantQuery, state.merchants);
    setActionPending(true);
    setMessage("");
    try {
      const proposal = await createProposal({
        title: createDraft.title.trim(),
        description: "",
        maxOptions: Number(createDraft.maxOptions),
        merchantId: resolvedMerchantId || undefined,
        proposalMinutes: Number(createDraft.proposalMinutes),
        voteMinutes: Number(createDraft.voteMinutes),
        orderMinutes: Number(createDraft.orderMinutes),
        groupId: Number(createDraft.groupId),
        useCreateOrderTicket
      });
      setCreateDraft((current) => ({ ...defaultCreateDraft, groupId: current.groupId }));
      setCreateMerchantQuery("");
      setUseCreateOrderTicket(false);
      await refresh();
      setMessage("已建立新的訂單。");
      router.push(`/member/ordering/proposals/${proposal.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立訂單失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAddOption() {
    if (!detail) return;
    const merchantId = resolveMerchantId(optionMerchantId, optionMerchantQuery, state.merchants);
    if (!merchantId) return;
    setActionPending(true);
    setMessage("");
    try {
      await addProposalOption(detail.id, merchantId, useProposalTicket);
      setOptionMerchantId("");
      setOptionMerchantQuery("");
      setUseProposalTicket(false);
      await refresh();
      setMessage("已新增提案店家。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增提案店家失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleDeleteOrder(proposalIdToDelete: number) {
    const confirmed = window.confirm("確定要撤回這筆訂單嗎？若目前還沒有其他成員新增提案，就可以撤回。");
    if (!confirmed) return;
    setActionPending(true);
    setMessage("");
    try {
      await deleteProposal(proposalIdToDelete);
      await refresh();
      setMessage("已撤回這筆訂單。");
      if (proposalId === proposalIdToDelete) {
        router.push("/member/ordering/proposals");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "撤回訂單失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleVoteQuote() {
    if (!detail || (!voteTokens.trim() && !useVoteTicket)) return;
    try {
      if (useVoteTicket) {
        setVoteQuoteMessage("使用投票券時，會以 1 張投票券換 1 票，截止前可改票。");
      } else {
        const quote = await quoteVote(detail.id, Number(voteTokens));
        setVoteQuoteMessage(`投入 ${voteTokens} Token 後，可得到 ${quote.voteWeight} 票重。`);
      }
    } catch (error) {
      setVoteQuoteMessage(error instanceof Error ? error.message : "試算失敗");
    }
  }

  async function handleVote(optionId: number) {
    if (!detail || (!voteTokens.trim() && !useVoteTicket)) return;
    setActionPending(true);
    setMessage("");
    try {
      await voteProposal(detail.id, optionId, Number(voteTokens || "0"), useVoteTicket);
      await refresh();
      setMessage("已更新投票。截止前都可以再次更換。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投票失敗");
    } finally {
      setActionPending(false);
    }
  }

  function setOrderQuantity(menuItemId: string, nextQuantity: number) {
    setOrderItems((current) => {
      if (nextQuantity <= 0) {
        const { [menuItemId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [menuItemId]: nextQuantity };
    });
  }

  async function handleOrder() {
    if (!detail) return;
    const winner = detail.options.find((option) => option.id === detail.winnerOptionId);
    if (!winner) return;
    const merchant = menus[winner.merchantId] || (await fetchMerchant(winner.merchantId));
    if (!menus[winner.merchantId]) {
      setMenus((current) => ({ ...current, [winner.merchantId]: merchant }));
    }
    const payload = Object.fromEntries(Object.entries(orderItems).filter(([, quantity]) => quantity > 0));
    if (!Object.keys(payload).length) return;

    setActionPending(true);
    setMessage("");
    try {
      const result = await signOrder(detail.id, payload);
      const walletClient = await ensureSepoliaWallet();
      const [walletAddress = ""] = await walletClient.getAddresses();
      const requiredBalance = BigInt(result.quote.requiredBalanceWei);
      if (walletAddress) {
        const balance = await getWalletBalanceWei(walletAddress);
        if (balance < requiredBalance) {
          throw new Error(`錢包餘額不足，至少需要 ${formatWeiFriendly(requiredBalance)}。`);
        }
      }

      const canUseChainOrder =
        Boolean(detail.chainProposalId) &&
        Boolean(result.signature?.signature) &&
        isUsableContractAddress(state.contractInfo?.orderContract);

      if (canUseChainOrder && detail.chainProposalId && result.signature) {
        const walletClient = await ensureSepoliaWallet();
        const [account] = await walletClient.getAddresses();
        const valueWei = BigInt(result.quote.subtotalWei);
        const txHash = await walletClient.writeContract({
          address: state.contractInfo!.orderContract as `0x${string}`,
          abi: ORDER_ABI,
          functionName: "placeOrder",
          args: [
            BigInt(detail.chainProposalId),
            result.signature.orderHash as `0x${string}`,
            "",
            BigInt(result.signature.amountWei),
            BigInt(result.signature.expiry),
            result.signature.signature as `0x${string}`
          ],
          account,
          chain: walletClient.chain,
          value: valueWei
        });
        await registerPendingTransaction({
          proposalId: detail.id,
          action: "place_order",
          txHash,
          walletAddress: account,
          relatedOrder: result.signature.orderHash
        });
      }

      await finalizeOrder({
        proposalId: detail.id,
        items: payload,
        signature: result.signature
      });
      setOrderItems({});
      await refresh();
      setMessage("已送出點餐並完成付款。");
      router.push(`/member/ordering/submitted/${detail.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "點餐失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleConfirm(orderId: number) {
    setActionPending(true);
    setMessage("");
    try {
      await confirmMemberOrder(orderId);
      await refresh();
      setMessage("已確認接收訂單。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "確認接收失敗");
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <div className="meal-panel p-8">正在載入建立訂單資料...</div>;

  if (proposalId && !detail) {
    return <div className="meal-panel p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到這筆訂單流程資料。"}</div>;
  }

  return (
    <div className="space-y-6">
      {stage === "create" ? (
        <section className="meal-panel p-8">
          <p className="meal-kicker">Create order</p>
          <h2 className="text-3xl font-extrabold">建立訂單</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="群組 (必填)">
              <select className="meal-field" value={createDraft.groupId} onChange={(event) => setCreateDraft((current) => ({ ...current, groupId: event.target.value }))}>
                <option value="">選擇群組</option>
                {state.groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </Field>
            <Field label="訂單名稱 (必填)">
              <input className="meal-field" value={createDraft.title} onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))} />
            </Field>
            <Field label="候選店家上限 (必填)">
              <input type="number" min={3} max={10} className="meal-field" value={createDraft.maxOptions} onChange={(event) => setCreateDraft((current) => ({ ...current, maxOptions: event.target.value }))} />
            </Field>
            <Field label="提案時間（分鐘） (必填)">
              <select className="meal-field" value={createDraft.proposalMinutes} onChange={(event) => setCreateDraft((current) => ({ ...current, proposalMinutes: event.target.value }))}>
                {stageDurationOptions.map((minutes) => <option key={`proposal-${minutes}`} value={String(minutes)}>{minutes} 分鐘</option>)}
              </select>
            </Field>
            <Field label="投票時間（分鐘） (必填)">
              <select className="meal-field" value={createDraft.voteMinutes} onChange={(event) => setCreateDraft((current) => ({ ...current, voteMinutes: event.target.value }))}>
                {stageDurationOptions.map((minutes) => <option key={`vote-${minutes}`} value={String(minutes)}>{minutes} 分鐘</option>)}
              </select>
            </Field>
            <Field label="點餐時間（分鐘） (必填)">
              <select className="meal-field" value={createDraft.orderMinutes} onChange={(event) => setCreateDraft((current) => ({ ...current, orderMinutes: event.target.value }))}>
                {stageDurationOptions.map((minutes) => <option key={`order-${minutes}`} value={String(minutes)}>{minutes} 分鐘</option>)}
              </select>
            </Field>
            <MerchantPicker
              label="首間候選店家（選填）"
              merchants={state.merchants}
              selectedMerchantId={createDraft.merchantId}
              query={createMerchantQuery}
              onQueryChange={setCreateMerchantQuery}
              onSelect={(merchantId) => setCreateDraft((current) => ({ ...current, merchantId }))}
            />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={handleCreateOrder} disabled={actionPending || !createDraft.groupId || !createDraft.title.trim()}>{actionPending ? "處理中..." : "建立本輪訂單"}</Button>
            <p className="text-sm text-muted-foreground">建立後可到下一個階段繼續提名店家。</p>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={useCreateOrderTicket} onChange={(event) => setUseCreateOrderTicket(event.target.checked)} />
            使用建立訂單券。建立成功後才會扣除 1 張建立訂單券。
          </label>
        </section>
      ) : null}

      {proposalId ? (
        <StageDetail
          stage={stage}
          proposal={detail!}
          memberId={state.member?.id || 0}
          merchants={state.merchants}
          merchantMenu={detail ? menus[detail.options.find((option) => option.id === detail.winnerOptionId)?.merchantId || ""] : undefined}
          now={now}
          optionMerchantId={optionMerchantId}
          optionMerchantQuery={optionMerchantQuery}
          setOptionMerchantId={setOptionMerchantId}
          setOptionMerchantQuery={setOptionMerchantQuery}
          useProposalTicket={useProposalTicket}
          setUseProposalTicket={setUseProposalTicket}
          onAddOption={handleAddOption}
          voteTokens={voteTokens}
          setVoteTokens={setVoteTokens}
          useVoteTicket={useVoteTicket}
          setUseVoteTicket={setUseVoteTicket}
          voteQuoteMessage={voteQuoteMessage}
          onVoteQuote={handleVoteQuote}
          onVote={handleVote}
          orderItems={orderItems}
          setOrderQuantity={setOrderQuantity}
          onOrder={handleOrder}
          actionPending={actionPending}
          onConfirm={handleConfirm}
          onDelete={handleDeleteOrder}
          contractInfo={state.contractInfo}
        />
      ) : (
        <StageList
          stage={stage}
          proposals={sortedStageProposals}
          now={now}
          memberId={state.member?.id || 0}
          sortBy={stageSort}
          setSortBy={setStageSort}
          onDelete={handleDeleteOrder}
        />
      )}

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

function StageList({
  stage,
  proposals,
  now,
  memberId,
  sortBy,
  setSortBy,
  onDelete
}: {
  stage: Stage;
  proposals: Proposal[];
  now: number;
  memberId: number;
  sortBy: StageSortKey;
  setSortBy: (value: StageSortKey) => void;
  onDelete: (proposalId: number) => void;
}) {
  const titleMap: Record<Stage, string> = {
    create: "建立訂單",
    proposal: "店家提案階段",
    voting: "投票階段",
    ordering: "點餐階段",
    submitted: "完成送出訂單階段"
  };

  if (stage === "submitted") {
    const orders = proposals
      .flatMap((proposal) =>
        safeArray(proposal.orders).map((order) => ({
          ...order,
          merchantName: order.merchantName || proposal.options.find((option) => option.id === proposal.winnerOptionId)?.merchantName || order.merchantId
        }))
      )
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    return (
      <section className="space-y-4">
        <div className="meal-section-heading max-w-none">
          <p className="meal-kicker">Submitted orders</p>
          <h2>完成送出訂單</h2>
          <p>顯示已送出的訂單清單。點進詳細資訊可查看目前狀態、狀態時間軸、餐點明細與訂購人資訊。</p>
        </div>
        {orders.length === 0 ? <div className="meal-panel p-8 text-sm text-muted-foreground">目前還沒有已送出的訂單。</div> : null}
        {orders.map((order) => (
          <OrderSummaryCard key={order.id} order={order} detailHref={`/member/orders/${order.id}`} />
        ))}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="meal-section-heading max-w-none">
        <p className="meal-kicker">Stage list</p>
        <h2>{titleMap[stage]}</h2>
      </div>
      <div className="max-w-xs">
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-foreground">排序方式</span>
          <select className="meal-field" value={sortBy} onChange={(event) => setSortBy(event.target.value as StageSortKey)}>
            <option value="newest">依建立時間新到舊</option>
            <option value="oldest">依建立時間舊到新</option>
            <option value="title">依名稱排序</option>
            <option value="options_desc">依提案店家數多到少</option>
            <option value="votes_desc">依投票人數多到少</option>
            <option value="orders_desc">依點餐人數多到少</option>
            <option value="deadline_soon">依截止時間近到遠</option>
          </select>
        </label>
      </div>
      {proposals.length === 0 ? <div className="meal-panel p-8 text-sm text-muted-foreground">目前這個階段沒有訂單資料。</div> : null}
      {proposals.map((proposal) => (
        <div key={proposal.id} className="meal-panel p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xl font-bold">{proposal.title}</p>
              <p className="text-sm text-muted-foreground">
                已提店家數：{proposal.options.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {stage === "voting" ? `目前已參與投票數：${safeArray(proposal.votes).length}` : stage === "ordering" ? `已點餐人數：${proposal.orderMemberCount}` : `群組編號：${proposal.groupId}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {stage === "proposal" || stage === "create"
                  ? `提案截止時間：${formatDateTime(proposal.proposalDeadline)}（設定 ${getProposalStageMinutes(proposal, "proposal")} 分鐘）`
                  : stage === "voting"
                    ? `投票截止時間：${formatDateTime(proposal.voteDeadline)}（設定 ${getProposalStageMinutes(proposal, "vote")} 分鐘）`
                    : stage === "ordering"
                      ? `點餐截止時間：${formatDateTime(proposal.orderDeadline)}（設定 ${getProposalStageMinutes(proposal, "order")} 分鐘）`
                      : `建立時間：${formatDateTime(proposal.createdAt)}`}
              </p>
              <p className="text-sm text-[hsl(25_85%_36%)]">
                {stage === "proposal" || stage === "create"
                  ? `剩餘提案時間：${formatCountdown(proposal.proposalDeadline, now)}`
                  : stage === "voting"
                    ? `剩餘投票時間：${formatCountdown(proposal.voteDeadline, now)}`
                    : stage === "ordering"
                      ? `剩餘點餐時間：${formatCountdown(proposal.orderDeadline, now)}`
                      : `目前狀態：${formatProposalStatus(proposal.status)}`}
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href={detailHref(stage, proposal.id)}>詳細資訊</Link>
            </Button>
          </div>
          {canWithdrawProposal(proposal, memberId) ? (
            <div className="mt-4">
              <Button variant="ghost" onClick={() => onDelete(proposal.id)}>撤回訂單</Button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function StageDetail(props: {
  stage: Stage;
  proposal: Proposal;
  memberId: number;
  merchants: Merchant[];
  merchantMenu?: Merchant;
  now: number;
  optionMerchantId: string;
  optionMerchantQuery: string;
  setOptionMerchantId: (value: string) => void;
  setOptionMerchantQuery: (value: string) => void;
  useProposalTicket: boolean;
  setUseProposalTicket: (value: boolean) => void;
  onAddOption: () => void;
  voteTokens: string;
  setVoteTokens: (value: string) => void;
  useVoteTicket: boolean;
  setUseVoteTicket: (value: boolean) => void;
  voteQuoteMessage: string;
  onVoteQuote: () => void;
  onVote: (optionId: number) => void;
  orderItems: Record<string, number>;
  setOrderQuantity: (menuItemId: string, quantity: number) => void;
  onOrder: () => void;
  actionPending: boolean;
  onConfirm: (orderId: number) => void;
  onDelete: (proposalId: number) => void;
  contractInfo: ContractInfo | null;
}) {
  const { stage, proposal, merchants, merchantMenu, now, actionPending } = props;
  const winner = proposal.options.find((option) => option.id === proposal.winnerOptionId);
  const selectedItems = merchantMenu?.menu.filter((item) => (props.orderItems[item.id] || 0) > 0) || [];
  const selectedPortions = selectedItems.reduce((sum, item) => sum + (props.orderItems[item.id] || 0), 0);
  const selectedSubtotalWei = selectedItems.reduce((total, item) => total + BigInt(item.priceWei) * BigInt(props.orderItems[item.id] || 0), 0n);
  const totalVoteWeight = proposal.options.reduce((sum, option) => sum + option.weightedVotes, 0);
  const currentVoteOption = proposal.options.find((option) => option.id === proposal.currentVoteOptionId);

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="meal-kicker">Detail</p>
            <h2 className="text-3xl font-extrabold">{proposal.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {stage === "proposal" ? `提案截止：${formatDateTime(proposal.proposalDeadline)}（設定 ${getProposalStageMinutes(proposal, "proposal")} 分鐘） / 剩餘 ${formatCountdown(proposal.proposalDeadline, now)}` : null}
              {stage === "voting" ? `投票截止：${formatDateTime(proposal.voteDeadline)}（設定 ${getProposalStageMinutes(proposal, "vote")} 分鐘） / 剩餘 ${formatCountdown(proposal.voteDeadline, now)}` : null}
              {stage === "ordering" ? `點餐截止：${formatDateTime(proposal.orderDeadline)}（設定 ${getProposalStageMinutes(proposal, "order")} 分鐘） / 剩餘 ${formatCountdown(proposal.orderDeadline, now)}` : null}
              {stage === "submitted" ? `獲選店家：${winner?.merchantName || "尚未決定"}` : null}
            </p>
          </div>
          <Button asChild variant="ghost">
            <Link href={listHref(stage)}>回清單</Link>
          </Button>
        </div>
        {canWithdrawProposal(proposal, props.memberId) ? (
          <div className="mt-4">
            <Button variant="ghost" onClick={() => props.onDelete(proposal.id)} disabled={actionPending}>
              撤回這筆訂單
            </Button>
          </div>
        ) : null}
      </section>

      {stage === "proposal" ? (
        <>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Proposed merchants</p>
            <h3 className="text-2xl font-extrabold">本輪已提案店家</h3>
            <div className="mt-6 space-y-3">
              {proposal.options.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有候選店家。</p> : null}
              {proposal.options.map((option) => (
                <div key={option.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <p className="font-semibold">{option.merchantName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{option.merchantId}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Add merchant</p>
            <h3 className="text-2xl font-extrabold">新增提案店家</h3>
            <p className="mt-3 text-sm text-muted-foreground">每位成員最多只能提案兩間店家。你可以選擇用提案券抵用這次提案。</p>
            <div className="mt-6">
              <MerchantPicker
                label="提名店家 (必填)"
                merchants={merchants}
                selectedMerchantId={props.optionMerchantId}
                query={props.optionMerchantQuery}
                onQueryChange={props.setOptionMerchantQuery}
                onSelect={props.setOptionMerchantId}
              />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={props.useProposalTicket} onChange={(event) => props.setUseProposalTicket(event.target.checked)} />
              使用提案券送出這次店家提案
            </label>
            <Button className="mt-4" onClick={props.onAddOption} disabled={actionPending || !resolveMerchantId(props.optionMerchantId, props.optionMerchantQuery, merchants)}>
              新增提案店家
            </Button>
          </section>
        </>
      ) : null}

      {stage === "voting" ? (
        <>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Vote summary</p>
            <h3 className="text-2xl font-extrabold">目前投票概況</h3>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Stat label="提案店家數" value={`${proposal.options.length} 間`} />
              <Stat label="目前總票重" value={`${totalVoteWeight} 票`} />
              <Stat label="已投成員數" value={`${safeArray(proposal.votes).length} 人`} />
              <Stat label="投票截止" value={formatDateTime(proposal.voteDeadline)} />
            </div>
            {proposal.currentVoteWeight > 0 ? (
              <div className="mt-4 rounded-[1rem] border border-[rgba(194,119,60,0.18)] bg-[rgba(194,119,60,0.08)] px-4 py-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">你目前投給：</span>
                {currentVoteOption?.merchantName || "目前選項"}
                <span className="mx-2">|</span>
                <span className="font-semibold text-foreground">個人票重：</span>
                {proposal.currentVoteWeight}
                {proposal.currentVoteTokenAmount > 0 ? (
                  <>
                    <span className="mx-2">|</span>
                    <span className="font-semibold text-foreground">投入 Token：</span>
                    {proposal.currentVoteTokenAmount}
                  </>
                ) : (
                  <>
                    <span className="mx-2">|</span>
                    本次使用投票券折抵
                  </>
                )}
              </div>
            ) : null}
          </section>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Vote</p>
            <h3 className="text-2xl font-extrabold">投票給店家</h3>
            <div className="mt-6 space-y-4">
              <Field label="這輪投票的 token 權重 (必填)">
                <div className="flex gap-3">
                  <input type="number" min={1} className="meal-field" value={props.voteTokens} onChange={(event) => props.setVoteTokens(event.target.value)} disabled={props.useVoteTicket} />
                  <Button variant="secondary" onClick={props.onVoteQuote}>試算</Button>
                </div>
                {props.voteQuoteMessage ? <p className="mt-2 text-xs text-muted-foreground">{props.voteQuoteMessage}</p> : null}
              </Field>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={props.useVoteTicket} onChange={(event) => props.setUseVoteTicket(event.target.checked)} />
                使用投票券。截止前都可抽回更換，最後一次投票為準。
              </label>
              {proposal.options.map((option) => (
                <div key={option.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{option.merchantName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">目前 {option.weightedVotes} 票重</p>
                    </div>
                    <Button onClick={() => props.onVote(option.id)} disabled={actionPending || (!props.useVoteTicket && !props.voteTokens.trim())}>投給這家</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {stage === "ordering" ? (
        <>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Winner</p>
            <h3 className="text-2xl font-extrabold">獲選店家</h3>
            <div className="mt-6 rounded-[1.2rem] border border-border bg-background/70 p-4">
              <p className="font-semibold">{winner?.merchantName || "尚未決定"}</p>
              <p className="mt-1 text-sm text-muted-foreground">總票重：{winner?.weightedVotes || 0}</p>
            </div>
          </section>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Menu</p>
            <h3 className="text-2xl font-extrabold">點餐</h3>
            <div className="mt-6 space-y-3">
              {safeArray(merchantMenu?.menu).map((item) => {
                const quantity = props.orderItems[item.id] || 0;
                return (
                  <div key={item.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatWeiFriendly(item.priceWei)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button variant="secondary" className="h-10 w-10 rounded-full px-0" onClick={() => props.setOrderQuantity(item.id, quantity - 1)} disabled={quantity <= 0 || actionPending}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <p className="min-w-[2rem] text-center font-semibold">{quantity}</p>
                        <Button className="h-10 w-10 rounded-full px-0" onClick={() => props.setOrderQuantity(item.id, quantity + 1)} disabled={actionPending}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-[1.2rem] border border-[rgba(194,119,60,0.28)] bg-[rgba(194,119,60,0.08)] p-4">
              <p className="meal-kicker">Order summary</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <ShoppingBasket className="h-4 w-4" />
                已選 {selectedItems.length} 項、共 {selectedPortions} 份
              </p>
              <p className="mt-2 text-lg font-semibold">{formatWeiFriendly(selectedSubtotalWei)}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="h-4 w-4" />
                {isUsableContractAddress(props.contractInfo?.orderContract) ? "本輪會喚起 MetaMask 進行 Sepolia 合約支付。" : "本輪會先付款到平台中心錢包。"}
              </p>
              <Button className="mt-4" onClick={props.onOrder} disabled={actionPending || !selectedItems.length}>送出點餐並前往錢包支付</Button>
            </div>
          </section>
        </>
      ) : null}

      {stage === "submitted" ? (
        <>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Vote result</p>
            <h3 className="text-2xl font-extrabold">投票結果</h3>
            <div className="mt-6 space-y-3">
              {proposal.options.map((option) => (
                <div key={option.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{option.merchantName}</p>
                    <p className="text-sm text-muted-foreground">{option.weightedVotes} 票重</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Orders</p>
            <h3 className="text-2xl font-extrabold">已點餐成員</h3>
            <div className="mt-6 space-y-3">
              {proposal.orders.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有人完成點餐。</p> : null}
              {proposal.orders.map((order) => (
                <div key={order.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{order.memberName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatOrderStatus(order.status)} · {formatWeiFriendly(order.amountWei)}</p>
                    </div>
                    {order.status === "merchant_completed" ? (
                      <Button onClick={() => props.onConfirm(order.id)} disabled={actionPending}>確認接收</Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MerchantPicker(props: {
  label: string;
  merchants: Merchant[];
  selectedMerchantId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (merchantId: string) => void;
}) {
  const filtered = useMemo(() => {
    const keyword = props.query.trim().toLowerCase();
    if (!keyword) return props.merchants.slice(0, 6);
    return props.merchants
      .filter((merchant) => merchant.id.toLowerCase().includes(keyword) || merchant.name.toLowerCase().includes(keyword))
      .slice(0, 6);
  }, [props.merchants, props.query]);

  return (
    <Field label={props.label}>
      <div className="space-y-3">
        <input className="meal-field" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="搜尋店名或 merchant id" />
        <div className="grid gap-2">
          {filtered.map((merchant) => (
            <button
              key={merchant.id}
              type="button"
              onClick={() => {
                props.onQueryChange(`${merchant.name} (${merchant.id})`);
                props.onSelect(merchant.id);
              }}
              className={`rounded-[1rem] px-3 py-3 text-left transition ${
                props.selectedMerchantId === merchant.id ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-secondary"
              }`}
            >
              <p className="font-semibold">{merchant.name}</p>
              <p className="text-xs opacity-80">{merchant.id}</p>
            </button>
          ))}
        </div>
      </div>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {children}
    </label>
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

function detailHref(stage: Stage, proposalId: number) {
  if (stage === "proposal" || stage === "create") return `/member/ordering/proposals/${proposalId}`;
  if (stage === "voting") return `/member/ordering/voting/${proposalId}`;
  if (stage === "ordering") return `/member/ordering/ordering/${proposalId}`;
  return `/member/ordering/submitted/${proposalId}`;
}

function listHref(stage: Stage) {
  if (stage === "proposal" || stage === "create") return "/member/ordering/proposals";
  if (stage === "voting") return "/member/ordering/voting";
  if (stage === "ordering") return "/member/ordering/ordering";
  return "/member/ordering/submitted";
}

function relevantDeadline(proposal: Proposal, stage: Stage) {
  if (stage === "proposal" || stage === "create") return new Date(proposal.proposalDeadline);
  if (stage === "voting") return new Date(proposal.voteDeadline);
  if (stage === "ordering") return new Date(proposal.orderDeadline);
  return new Date(proposal.createdAt);
}

function canWithdrawProposal(proposal: Proposal, memberId: number) {
  if (!memberId || proposal.createdBy !== memberId) return false;
  if (proposal.status !== "proposing") return false;
  if (safeArray(proposal.votes).length > 0 || safeArray(proposal.orders).length > 0) return false;
  return proposal.options.every((option) => option.proposerMemberId === memberId);
}

function safeArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function normalizeProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    options: safeArray(proposal.options),
    orders: safeArray(proposal.orders),
    votes: safeArray(proposal.votes)
  };
}

function resolveMerchantId(selectedMerchantId: string, query: string, merchants: Merchant[]) {
  if (selectedMerchantId.trim() && merchants.some((merchant) => merchant.id === selectedMerchantId.trim())) return selectedMerchantId.trim();
  const keyword = query.trim().toLowerCase();
  const exactId = merchants.find((merchant) => merchant.id.toLowerCase() === keyword);
  if (exactId) return exactId.id;
  const exactName = merchants.find((merchant) => merchant.name.trim().toLowerCase() === keyword);
  return exactName?.id || "";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return date.toLocaleString("zh-TW");
}

function formatCountdown(value: string, now: number) {
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return "未設定";
  const diff = target - now;
  if (diff <= 0) return "已截止";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days} 天 ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getProposalStageMinutes(proposal: Proposal, stage: "proposal" | "vote" | "order") {
  const createdAt = new Date(proposal.createdAt).getTime();
  const proposalAt = new Date(proposal.proposalDeadline).getTime();
  const voteAt = new Date(proposal.voteDeadline).getTime();
  const orderAt = new Date(proposal.orderDeadline).getTime();
  if (!Number.isFinite(createdAt) || !Number.isFinite(proposalAt) || !Number.isFinite(voteAt) || !Number.isFinite(orderAt)) return 0;
  if (stage === "proposal") return Math.max(0, Math.round((proposalAt - createdAt) / 60000));
  if (stage === "vote") return Math.max(0, Math.round((voteAt - proposalAt) / 60000));
  return Math.max(0, Math.round((orderAt - voteAt) / 60000));
}

function formatProposalStatus(status: string) {
  switch (status) {
    case "proposing":
      return "店家提案中";
    case "voting":
      return "投票中";
    case "ordering":
      return "點餐中";
    case "awaiting_settlement":
      return "待結算";
    case "settled":
      return "已完成";
    default:
      return status;
  }
}

function formatOrderStatus(status: string) {
  switch (status) {
    case "payment_received":
    case "paid_local":
    case "paid_onchain":
      return "付款完成";
    case "merchant_accepted":
      return "店家已接單";
    case "merchant_completed":
      return "店家已做完";
    case "ready_for_payout":
      return "平台撥款中";
    case "platform_paid":
      return "店家已收款";
    default:
      return status;
  }
}

function weiToEthNumber(value: string | number | bigint) {
  const raw = typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw / 1e18;
}

function formatEth(value: string | number | bigint) {
  const eth = weiToEthNumber(value);
  if (eth === 0) return "0 ETH";
  return `${eth.toFixed(4)} ETH`;
}

function formatApproxTWD(value: string | number | bigint) {
  const amount = Math.round(weiToEthNumber(value) * APPROX_TWD_PER_ETH);
  return `約 NT$${amount.toLocaleString("zh-TW")}`;
}

function formatWeiFriendly(value: string | number | bigint) {
  return `${formatEth(value)} / ${formatApproxTWD(value)}`;
}
