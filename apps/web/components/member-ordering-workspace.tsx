"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  fetchProposal,
  fetchPublicGovernanceParams,
  fetchProposals,
  finalizeOrder,
  quoteVote,
  registerPendingTransaction,
  signOrder,
  type ContractInfo,
  type GovernanceParams,
  type Group,
  type Member,
  type Merchant,
  type Order,
  type Proposal,
  type VoteRecord,
  voteProposal
} from "@/lib/api";
import {
  ensureSepoliaClients,
  getWalletBalanceWei,
  isUsableContractAddress,
  sendNativePayment,
  toFriendlyWalletError,
} from "@/lib/chain";
import { OrderSummaryCard } from "@/components/member-order-shared";

type Stage = "create" | "proposal" | "voting" | "ordering" | "submitted";

type CreateDraft = {
  groupId: string;
  title: string;
  maxOptions: string;
  proposalMinutes: string;
  voteMinutes: string;
  orderMinutes: string;
  merchantIds: string[];
};

type WorkspaceState = {
  member: Member | null;
  groups: Group[];
  proposals: Proposal[];
  merchants: Merchant[];
  contractInfo: ContractInfo | null;
  governanceParams: GovernanceParams | null;
};

const APPROX_TWD_PER_ETH = 120000;
const defaultCreateDraft: CreateDraft = {
  groupId: "",
  title: "",
  maxOptions: "5",
  proposalMinutes: "",
  voteMinutes: "",
  orderMinutes: "",
  merchantIds: []
};

type StageSortKey = "newest" | "oldest" | "title" | "options_desc" | "votes_desc" | "orders_desc" | "deadline_soon";

type PendingOrderingSync =
  | { action: "create_proposal"; txHash: string; payload: Parameters<typeof createProposal>[0] }
  | { action: "add_option"; txHash: string; payload: { proposalId: number; merchantId: string; useProposalTicket: boolean } }
  | { action: "vote"; txHash: string; payload: { proposalId: number; optionId: number; voteCount: number; useVoteTicket: boolean } }
  | { action: "pay_order"; txHash: string; payload: Parameters<typeof finalizeOrder>[0] };

const ORDERING_SYNC_KEY = "member-ordering-pending-sync";

function readPendingOrderingSync(): PendingOrderingSync | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(ORDERING_SYNC_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingOrderingSync;
  } catch {
    window.sessionStorage.removeItem(ORDERING_SYNC_KEY);
    return null;
  }
}

function writePendingOrderingSync(value: PendingOrderingSync) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ORDERING_SYNC_KEY, JSON.stringify(value));
}

function clearPendingOrderingSync() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ORDERING_SYNC_KEY);
}

export function MemberOrderingWorkspace({ stage, proposalId }: { stage: Stage; proposalId?: number }) {
  const router = useRouter();
  const replayedPendingSync = useRef(false);
  const stageRedirected = useRef(false);
  const [state, setState] = useState<WorkspaceState>({ member: null, groups: [], proposals: [], merchants: [], contractInfo: null, governanceParams: null });
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);
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
  const [useInitialProposalTickets, setUseInitialProposalTickets] = useState(false);
  const [useProposalTicket, setUseProposalTicket] = useState(false);
  const [useVoteTicket, setUseVoteTicket] = useState(false);
  const [voteQuoteMessage, setVoteQuoteMessage] = useState("");
  const [menus, setMenus] = useState<Record<string, Merchant>>({});
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [stageSort, setStageSort] = useState<StageSortKey>("newest");

  const refresh = useCallback(async () => {
    const [me, groups, proposals, contractInfo, merchants, governanceParams, singleProposal] = await Promise.all([
      fetchMe(),
      fetchGroups(),
      fetchProposals(),
      fetchContractInfo().catch(() => null),
      fetchMerchants().catch(() => []),
      fetchPublicGovernanceParams().catch(() => null),
      proposalId ? fetchProposal(proposalId).catch(() => null) : Promise.resolve(null)
    ]);
    const normalizedProposals = dedupeProposals(safeArray(proposals).map(normalizeProposal));
    setState({
      member: me,
      groups,
      proposals: normalizedProposals,
      merchants: Array.isArray(merchants) ? merchants : [],
      contractInfo,
      governanceParams
    });
    setDetailProposal(singleProposal ? normalizeProposal(singleProposal) : null);
    setCreateDraft((current) => ({
      ...current,
      groupId: current.groupId || (groups[0] ? String(groups[0].id) : ""),
      proposalMinutes: current.proposalMinutes || String(governanceParams?.proposalDurationMinutes || 1),
      voteMinutes: current.voteMinutes || String(governanceParams?.voteDurationMinutes || 1),
      orderMinutes: current.orderMinutes || String(governanceParams?.orderingDurationMinutes || 1)
    }));
  }, []);

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取建立訂單資料失敗"))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flash = window.sessionStorage.getItem("member-ordering-flash");
    if (!flash) return;
    setMessage(flash);
    window.sessionStorage.removeItem("member-ordering-flash");
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    stageRedirected.current = false;
  }, [proposalId, stage]);

  useEffect(() => {
    if (stage !== "voting" && stage !== "ordering") return;
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh, stage]);

  useEffect(() => {
    if (loading || replayedPendingSync.current) return;
    const pending = readPendingOrderingSync();
    if (!pending) return;
    replayedPendingSync.current = true;
    setActionPending(true);
    setMessage("偵測到上一筆付款已送出，正在補回同步結果...");
    (async () => {
      try {
        if (pending.action === "create_proposal") {
          await createProposal({ ...pending.payload, txHash: pending.txHash });
          clearPendingOrderingSync();
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("member-ordering-flash", `已成功建立訂單「${pending.payload.title}」。`);
            window.location.assign("/member/ongoing-orders");
            return;
          }
          router.push("/member/ongoing-orders");
          return;
        }
        if (pending.action === "add_option") {
          await addProposalOption(pending.payload.proposalId, pending.payload.merchantId, pending.payload.useProposalTicket, pending.txHash);
          clearPendingOrderingSync();
          await refresh();
          setMessage("上一筆提案付款已成功補回同步。");
          return;
        }
        if (pending.action === "vote") {
          await voteProposal(pending.payload.proposalId, pending.payload.optionId, pending.payload.voteCount, pending.payload.useVoteTicket, pending.txHash);
          clearPendingOrderingSync();
          await refresh();
          setMessage("上一筆投票付款已成功補回同步。");
          return;
        }
        await finalizeOrder({ ...pending.payload, txHash: pending.txHash });
        clearPendingOrderingSync();
        await refresh();
        setMessage("上一筆點餐付款已成功補回同步。");
      } catch {
        setMessage("上一筆付款已送出，但同步仍在處理中。請稍後重新整理確認結果，暫時不要重複付款。");
      } finally {
        setActionPending(false);
      }
    })();
  }, [loading, refresh, router]);

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
    const activeOrdering = (proposal: Proposal) =>
      proposal.status !== "failed" &&
      proposal.status !== "cancelled" &&
      proposal.winnerOptionId > 0 &&
      new Date(proposal.orderDeadline).getTime() > now;
    switch (stage) {
      case "proposal":
        return state.proposals.filter((proposal) => proposal.status === "proposing");
      case "voting":
        return state.proposals.filter((proposal) => proposal.status === "voting");
      case "ordering":
        return state.proposals.filter((proposal) => proposal.status === "ordering" || activeOrdering(proposal));
      case "submitted":
        return state.proposals.filter((proposal) => {
          const hasWinner = proposal.options.some((option) => option.id === proposal.winnerOptionId);
          const orderDeadlinePassed = new Date(proposal.orderDeadline).getTime() <= now;
          return orderDeadlinePassed && (proposal.status === "settled" || proposal.status === "awaiting_settlement" || proposal.status === "ordering") && (hasWinner || proposal.orderMemberCount > 0 || proposal.orders.length > 0);
        });
      case "create":
      default:
        return state.proposals.filter((proposal) => proposal.status === "proposing");
    }
  }, [now, stage, state.proposals]);
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

  const detail = useMemo(() => {
    const staged = sortedStageProposals.find((proposal) => proposal.id === proposalId) || null;
    if (staged) return staged;
    if (detailProposal?.id === proposalId) return detailProposal;
    return null;
  }, [detailProposal, proposalId, sortedStageProposals]);
  const proposalDurationOptions = useMemo(() => durationOptions(state.governanceParams?.proposalDurationOptions, state.governanceParams?.proposalDurationMinutes ?? 1), [state.governanceParams?.proposalDurationMinutes, state.governanceParams?.proposalDurationOptions]);
  const voteDurationOptions = useMemo(() => durationOptions(state.governanceParams?.voteDurationOptions, state.governanceParams?.voteDurationMinutes ?? 1), [state.governanceParams?.voteDurationMinutes, state.governanceParams?.voteDurationOptions]);
  const orderingDurationOptions = useMemo(() => durationOptions(state.governanceParams?.orderingDurationOptions, state.governanceParams?.orderingDurationMinutes ?? 1), [state.governanceParams?.orderingDurationMinutes, state.governanceParams?.orderingDurationOptions]);

  useEffect(() => {
    if (!proposalId || !detail || stageRedirected.current) return;
    const actualStage = stageForProposal(detail, now);
    if (!actualStage || actualStage === stage || actualStage === "create") return;
    stageRedirected.current = true;
    router.replace(detailHref(actualStage, detail.id));
  }, [detail, now, proposalId, router, stage]);

  async function handleCreateOrder() {
    if (!createDraft.title.trim() || !createDraft.groupId) return;
    if (createDraft.merchantIds.length === 0 || createDraft.merchantIds.length > 2) {
      setMessage("建立訂單時請先選擇 1 到 2 間初始提案店家。");
      return;
    }
    setActionPending(true);
    setMessage("");
    let paymentSubmitted = false;
    let syncTxHash = "";
    try {
      const initialProposalTicketFlags =
        useInitialProposalTickets && (state.member?.proposalCouponCount || 0) > 0
          ? createDraft.merchantIds.map((_, index) => index < (state.member?.proposalCouponCount || 0))
          : createDraft.merchantIds.map(() => false);
      if (isUsableContractAddress(state.contractInfo?.platformTreasury) && state.governanceParams) {
        if (!state.governanceParams) {
          throw new Error("目前無法讀取費率參數，暫時不能送出付款。");
        }
        const createFeeWei = BigInt(useCreateOrderTicket ? 0 : state.governanceParams?.createFeeWei || 0);
        const initialProposalFeeWei = createDraft.merchantIds.reduce((total, _merchantId, index) => {
          if (initialProposalTicketFlags[index]) return total;
          return total + BigInt(state.governanceParams?.proposalFeeWei || 0);
        }, 0n);
        const txValueWei = createFeeWei + initialProposalFeeWei;
        const { hash: chainTxHash, account } = await sendNativePayment(
          state.contractInfo!.platformTreasury as `0x${string}`,
          txValueWei
        );
        paymentSubmitted = true;
        syncTxHash = chainTxHash;
        writePendingOrderingSync({
          action: "create_proposal",
          txHash: chainTxHash,
          payload: {
            title: createDraft.title.trim(),
            description: "",
            maxOptions: Number(createDraft.maxOptions),
            merchantIds: createDraft.merchantIds,
            useInitialProposalTickets: initialProposalTicketFlags,
            proposalMinutes: Number(createDraft.proposalMinutes),
            voteMinutes: Number(createDraft.voteMinutes),
            orderMinutes: Number(createDraft.orderMinutes),
            groupId: Number(createDraft.groupId),
            useCreateOrderTicket
          }
        });
        await registerPendingTransaction({
          proposalId: 0,
          action: "create_proposal",
          txHash: chainTxHash,
          walletAddress: account
        }).catch(() => undefined);
      }
      const proposal = await createProposal({
        title: createDraft.title.trim(),
        description: "",
        maxOptions: Number(createDraft.maxOptions),
        merchantIds: createDraft.merchantIds,
        useInitialProposalTickets: initialProposalTicketFlags,
        proposalMinutes: Number(createDraft.proposalMinutes),
        voteMinutes: Number(createDraft.voteMinutes),
        orderMinutes: Number(createDraft.orderMinutes),
        groupId: Number(createDraft.groupId),
        useCreateOrderTicket,
        txHash: syncTxHash || undefined
      });
      clearPendingOrderingSync();
      setCreateDraft((current) => ({ ...defaultCreateDraft, groupId: current.groupId }));
      setCreateMerchantQuery("");
      setUseCreateOrderTicket(false);
      setUseInitialProposalTickets(false);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("member-ordering-flash", `已成功建立訂單「${proposal.title}」。`);
        window.location.assign("/member/ongoing-orders");
        return;
      }
      router.push("/member/ongoing-orders");
    } catch (error) {
      setMessage(
        paymentSubmitted
          ? "付款已送出，但建立訂單同步失敗。請先到成立中訂單確認是否已建立，若仍未出現再重新整理後操作。"
          : toFriendlyWalletError(error, "建立訂單付款未成功，請重新操作。")
      );
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
    let paymentSubmitted = false;
    let syncTxHash = "";
    try {
      if (isUsableContractAddress(state.contractInfo?.platformTreasury)) {
        const value = BigInt(useProposalTicket ? 0 : detail.proposalFeeWei || 0);
        const { hash: txHash, account } = await sendNativePayment(
          state.contractInfo!.platformTreasury as `0x${string}`,
          value
        );
        paymentSubmitted = true;
        syncTxHash = txHash;
        writePendingOrderingSync({
          action: "add_option",
          txHash,
          payload: { proposalId: detail.id, merchantId, useProposalTicket }
        });
        await registerPendingTransaction({
          proposalId: detail.id,
          action: "add_option",
          txHash,
          walletAddress: account
        }).catch(() => undefined);
      }
      await addProposalOption(detail.id, merchantId, useProposalTicket, syncTxHash || undefined);
      clearPendingOrderingSync();
      setOptionMerchantId("");
      setOptionMerchantQuery("");
      setUseProposalTicket(false);
      await refresh();
      setMessage("已新增提案店家。");
    } catch (error) {
      setMessage(
        paymentSubmitted
          ? "付款已送出，但提案同步失敗。請重新整理後確認該店家是否已加入；若未加入，再重新操作。"
          : toFriendlyWalletError(error, "提案付款未成功，請重新操作。")
      );
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
      const quote = await quoteVote(detail.id, Number(voteTokens), useVoteTicket);
      if (useVoteTicket) {
        setVoteQuoteMessage(`投 ${quote.voteCount} 票會使用 1 張投票優惠券折抵 1 票，仍需支付 ${formatWeiFriendly(quote.feeAmountWei ?? 0)}。`);
      } else {
        setVoteQuoteMessage(`投 ${quote.voteCount} 票需支付 ${formatWeiFriendly(quote.feeAmountWei ?? 0)}。`);
      }
    } catch (error) {
      setVoteQuoteMessage(error instanceof Error ? error.message : "試算失敗");
    }
  }

  async function handleVote(optionId: number) {
    if (!detail || (!voteTokens.trim() && !useVoteTicket)) return;
    setActionPending(true);
    setMessage("");
    let paymentSubmitted = false;
    let syncTxHash = "";
    try {
      const option = detail.options.find((item) => item.id === optionId);
      const voteCount = Number(voteTokens || "0");
      if (isUsableContractAddress(state.contractInfo?.platformTreasury)) {
        const actualVoteCount = voteCount;
        const payableVotes = useVoteTicket ? Math.max(actualVoteCount - 1, 0) : actualVoteCount;
        const value = BigInt((detail.voteFeeWei || 0) * payableVotes);
        const { hash: txHash, account } = await sendNativePayment(
          state.contractInfo!.platformTreasury as `0x${string}`,
          value
        );
        paymentSubmitted = true;
        syncTxHash = txHash;
        writePendingOrderingSync({
          action: "vote",
          txHash,
          payload: { proposalId: detail.id, optionId, voteCount: Number(voteTokens || "0"), useVoteTicket }
        });
        await registerPendingTransaction({
          proposalId: detail.id,
          action: "vote",
          txHash,
          walletAddress: account
        }).catch(() => undefined);
      }
      const updatedProposal = await voteProposal(detail.id, optionId, Number(voteTokens || "0"), useVoteTicket, syncTxHash || undefined);
      clearPendingOrderingSync();
      setState((current) => ({
        ...current,
        proposals: dedupeProposals(
          safeArray(current.proposals).map((proposal) =>
            proposal.id === updatedProposal.id ? normalizeProposal(updatedProposal) : proposal
          )
        )
      }));
      setVoteTokens("");
      setUseVoteTicket(false);
      try {
        await refresh();
      } catch {
        setMessage("投票與付款已成功送出，但頁面同步較慢，請重新整理後確認結果。");
        return;
      }
      setMessage("已完成投票，付款確認後不可再次修改。");
    } catch (error) {
      setMessage(
        paymentSubmitted
          ? "付款已送出，但投票同步失敗。請先重新整理確認票數是否已更新；若未更新，再重新操作。"
          : toFriendlyWalletError(error, "投票付款未成功，請重新操作。")
      );
    } finally {
      setActionPending(false);
    }
  }

  function removeInitialMerchantSelection(merchantId: string) {
    setCreateDraft((current) => ({ ...current, merchantIds: current.merchantIds.filter((id) => id !== merchantId) }));
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
    let paymentSubmitted = false;
    let syncTxHash = "";
    try {
      const result = await signOrder(detail.id, payload);
      if (!result.signature) {
        throw new Error("訂單簽章未成功產生，請重新操作。");
      }
      const { account: walletAddress } = await ensureSepoliaClients();
      const requiredBalance = BigInt(result.quote.requiredBalanceWei);
      if (walletAddress) {
        const balance = await getWalletBalanceWei(walletAddress);
        if (balance < requiredBalance) {
          throw new Error(`錢包餘額不足，至少需要 ${formatWeiFriendly(requiredBalance)}。`);
        }
      }

      if (isUsableContractAddress(state.contractInfo?.platformTreasury)) {
        const { hash: txHash, account } = await sendNativePayment(
          state.contractInfo!.platformTreasury as `0x${string}`,
          BigInt(result.quote.subtotalWei)
        );
        paymentSubmitted = true;
        syncTxHash = txHash;
        writePendingOrderingSync({
          action: "pay_order",
          txHash,
          payload: {
            proposalId: detail.id,
            items: payload,
            signature: result.signature
          }
        });
        await registerPendingTransaction({
          proposalId: detail.id,
          action: "pay_order",
          txHash,
          walletAddress: account,
          relatedOrder: result.signature.orderHash
        });
      }

      await finalizeOrder({
        proposalId: detail.id,
        items: payload,
        signature: result.signature,
        txHash: syncTxHash || undefined
      });
      clearPendingOrderingSync();
      setOrderItems({});
      try {
        await refresh();
      } catch {
        setMessage("付款與點餐已送出，但頁面同步較慢，請重新整理後確認你的點餐內容。");
        return;
      }
      setMessage("已完成本次點餐付款。截止前仍可繼續追加點餐，系統會在本頁顯示你目前已點的內容。");
    } catch (error) {
      setMessage(
        paymentSubmitted
          ? "付款已送出，但點餐同步失敗。請先重新整理確認你目前已點的內容是否已更新；若未更新，再重新操作。"
          : toFriendlyWalletError(error, "付款未成功，請重新操作。")
      );
    } finally {
      setActionPending(false);
    }
  }

  async function handleConfirm(orderIds: number[]) {
    setActionPending(true);
    setMessage("");
    try {
      for (const orderId of orderIds) {
        await confirmMemberOrder(orderId);
      }
      await refresh();
      setMessage("已確認接收整筆訂單。");
    } catch (error) {
      setMessage(toFriendlyWalletError(error, "確認收貨未成功，請重新操作。"));
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
              <input type="number" min={1} max={10} className="meal-field" value={createDraft.maxOptions} onChange={(event) => setCreateDraft((current) => ({ ...current, maxOptions: event.target.value }))} />
            </Field>
            <Field label="提案時間（分鐘） (必填)">
              <select className="meal-field" value={createDraft.proposalMinutes} onChange={(event) => setCreateDraft((current) => ({ ...current, proposalMinutes: event.target.value }))}>
                {proposalDurationOptions.map((minutes) => <option key={`proposal-${minutes}`} value={String(minutes)}>{minutes} 分鐘</option>)}
              </select>
            </Field>
            <Field label="投票時間（分鐘） (必填)">
              <select className="meal-field" value={createDraft.voteMinutes} onChange={(event) => setCreateDraft((current) => ({ ...current, voteMinutes: event.target.value }))}>
                {voteDurationOptions.map((minutes) => <option key={`vote-${minutes}`} value={String(minutes)}>{minutes} 分鐘</option>)}
              </select>
            </Field>
            <Field label="點餐時間（分鐘） (必填)">
              <select className="meal-field" value={createDraft.orderMinutes} onChange={(event) => setCreateDraft((current) => ({ ...current, orderMinutes: event.target.value }))}>
                {orderingDurationOptions.map((minutes) => <option key={`order-${minutes}`} value={String(minutes)}>{minutes} 分鐘</option>)}
              </select>
            </Field>
            <div className="xl:col-span-3">
              <Field label="搜尋店家（必填，請選 1 至 2 間）">
                <input
                  className="meal-field"
                  value={createMerchantQuery}
                  onChange={(event) => {
                    setCreateMerchantQuery(event.target.value);
                  }}
                  placeholder="搜尋店名或 merchant id"
                />
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {createDraft.merchantIds.map((merchantId) => {
                  const merchant = state.merchants.find((item) => item.id === merchantId);
                  return (
                    <button
                      key={merchantId}
                      type="button"
                      className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                      onClick={() => removeInitialMerchantSelection(merchantId)}
                    >
                      {merchant?.name || merchantId} ×
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2">
                {state.merchants
                  .filter((merchant) => {
                    const keyword = createMerchantQuery.trim().toLowerCase();
                    if (!keyword) return true;
                    return merchant.id.toLowerCase().includes(keyword) || merchant.name.toLowerCase().includes(keyword);
                  })
                  .slice(0, 6)
                  .map((merchant) => {
                    const isSelected = createDraft.merchantIds.includes(merchant.id);
                    return (
                      <button
                        key={merchant.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            removeInitialMerchantSelection(merchant.id);
                            return;
                          }
                          if (createDraft.merchantIds.length >= 2) {
                            setMessage("建立訂單時最多只能選擇 2 間初始提案店家。");
                            return;
                          }
                          setCreateDraft((current) => ({ ...current, merchantIds: [...current.merchantIds, merchant.id] }));
                        }}
                        className={`rounded-[1rem] border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-[0_8px_24px_rgba(16,185,129,0.12)]"
                            : "border-border bg-background hover:bg-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{merchant.name}</p>
                            <p className="text-xs opacity-80">{merchant.id}</p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              isSelected ? "bg-emerald-500 text-white" : "bg-[rgba(148,74,0,0.08)] text-muted-foreground"
                            }`}
                          >
                            {isSelected ? "已選擇" : "可選擇"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={handleCreateOrder} disabled={actionPending || !createDraft.groupId || !createDraft.title.trim() || createDraft.merchantIds.length === 0}>{actionPending ? "處理中..." : "建立本輪訂單"}</Button>
            <p className="text-sm text-muted-foreground">建立費加上初始提案費會在建立時一起記錄；投票結束成功選出店家後，才會退回建立費。</p>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={useCreateOrderTicket} onChange={(event) => setUseCreateOrderTicket(event.target.checked)} />
            使用建立訂單優惠券。僅抵用建立訂單費，初始提案費仍依提案店家數計算。
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={useInitialProposalTickets} onChange={(event) => setUseInitialProposalTickets(event.target.checked)} />
            初始提案優先使用提案優惠券。若你有多張提案優惠券，會依序套用到最多 2 間初始提案店家。
          </label>
        </section>
      ) : null}

      {proposalId ? (
        <StageDetail
          stage={stage}
          proposal={detail!}
          member={state.member}
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
          member={state.member}
          sortBy={stageSort}
          setSortBy={setStageSort}
          onDelete={handleDeleteOrder}
          onConfirm={handleConfirm}
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
  member,
  sortBy,
  setSortBy,
  onDelete,
  onConfirm
}: {
  stage: Stage;
  proposals: Proposal[];
  now: number;
  member: Member | null;
  sortBy: StageSortKey;
  setSortBy: (value: StageSortKey) => void;
  onDelete: (proposalId: number) => void;
  onConfirm: (orderIds: number[]) => void;
}) {
  const titleMap: Record<Stage, string> = {
    create: "建立訂單",
    proposal: "店家提案階段",
    voting: "投票階段",
    ordering: "點餐階段",
    submitted: "完成送出訂單階段"
  };

  if (stage === "submitted") {
    return (
      <section className="space-y-4">
        <div className="meal-section-heading max-w-none">
          <p className="meal-kicker">Submitted orders</p>
          <h2>完成送出訂單</h2>
          <p>顯示整筆訂單清單。點進詳細資訊可查看整筆訂單目前狀態、狀態時間軸、所有參與成員的餐點明細與訂購人資訊。</p>
        </div>
        {proposals.length === 0 ? <div className="meal-panel p-8 text-sm text-muted-foreground">目前還沒有已送出的訂單。</div> : null}
        {proposals.map((proposal) => {
          const aggregate = aggregateProposalOrder(proposal);
          return (
            <div key={proposal.id} className="meal-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xl font-bold">{proposal.title}</p>
                  <p className="text-sm text-muted-foreground">訂單建立者：{proposalCreatorName(proposal)}</p>
                  <p className="text-sm text-muted-foreground">獲選店家：{proposal.options.find((option) => option.id === proposal.winnerOptionId)?.merchantName || "尚未決定"}</p>
                  <p className="text-sm text-muted-foreground">參與點餐人數：{aggregate.memberCount} 人 / 品項總數：{aggregate.itemCount} 項</p>
                  <p className="text-sm text-muted-foreground">整筆訂單金額：{formatWeiFriendly(aggregate.amountWei)}</p>
                  <p className="text-sm text-muted-foreground">目前狀態：{formatAggregateOrderStatus(aggregate.status)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="secondary">
                    <Link href={`/member/ordering/submitted/${proposal.id}`}>詳細資訊</Link>
                  </Button>
                  {canCreatorConfirmReceipt(proposal, member) ? (
                    <Button onClick={() => onConfirm(confirmableOrderIds(proposal))}>
                      確認整筆接收
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
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
              <p className="text-sm text-muted-foreground">訂單建立者：{proposalCreatorName(proposal)}</p>
              <p className="text-sm text-muted-foreground">
                已提店家數：{proposal.options.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {proposal.options.slice(0, 4).map((option) => (
                  <span key={option.id} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                    {option.merchantName}
                  </span>
                ))}
                {proposal.options.length > 4 ? (
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                    +{proposal.options.length - 4} 間
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {stage === "voting" ? `目前已參與投票人數：${safeArray(proposal.votes).length} / 總票數：${proposal.totalVoteCount || 0}` : stage === "ordering" ? `已點餐人數：${proposal.orderMemberCount}` : `群組編號：${proposal.groupId}`}
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
          {canWithdrawProposal(proposal, member?.id || 0) ? (
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
  member: Member | null;
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
  onConfirm: (orderIds: number[]) => void;
  onDelete: (proposalId: number) => void;
  contractInfo: ContractInfo | null;
}) {
  const { stage, proposal, merchants, merchantMenu, now, actionPending } = props;
  const currentMemberId = Number(props.member?.id || 0);
  const winner = proposal.options.find((option) => option.id === proposal.winnerOptionId);
  const hasCurrentMemberVote =
    stage === "voting" &&
    (proposal.currentVoteOptionId > 0 || safeArray(proposal.votes).some((vote) => vote.memberId === currentMemberId));
  const selectedItems = merchantMenu?.menu.filter((item) => (props.orderItems[item.id] || 0) > 0) || [];
  const selectedPortions = selectedItems.reduce((sum, item) => sum + (props.orderItems[item.id] || 0), 0);
  const selectedSubtotalWei = selectedItems.reduce((total, item) => total + BigInt(item.priceWei) * BigInt(props.orderItems[item.id] || 0), 0n);
  const currentMemberOrder = safeArray(proposal.orders).find((order) => order.memberId === currentMemberId) || null;
  const aggregateOrder = aggregateProposalOrder(proposal);
  const detailHeading = stageDetailHeading(stage);

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="meal-kicker">{detailHeading.kicker}</p>
            <h2 className="text-3xl font-extrabold">{detailHeading.title}</h2>
            <p className="mt-2 text-base font-semibold text-foreground">{proposal.title}</p>
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
        {canWithdrawProposal(proposal, currentMemberId) ? (
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
            <p className="mt-3 text-sm text-muted-foreground">每位成員最多只能提案兩間店家；同一間店不可重複提案。確認提案後即鎖定，並記錄提案費或提案優惠券使用。</p>
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
              使用提案優惠券送出這次店家提案
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
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <Stat label="目前提案店家數" value={`${proposal.options.length} 間`} />
              <Stat label="目前參與投票數" value={`${safeArray(proposal.votes).length} 人`} />
              <Stat label="投票截止" value={formatDateTime(proposal.voteDeadline)} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">每間店的目前票數會在這裡即時更新；下方投票區只負責讓你選擇要投哪一間。</p>
            <div className="mt-6 space-y-3">
              {proposal.options.map((option) => (
                <div key={option.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{option.merchantName}</p>
                    <p className="text-sm font-semibold text-[hsl(25_85%_36%)]">目前 {option.weightedVotes} 票</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Vote</p>
            <h3 className="text-2xl font-extrabold">投票給店家</h3>
            <p className="mt-3 text-sm text-muted-foreground">每位成員在這個階段只能投給一間店家；可以自行決定投幾票，但確認付款後就不能再改。</p>
            <div className="mt-6 space-y-4">
              <Field label="這輪要投幾票 (必填)">
                <div className="flex gap-3">
                  <input type="number" min={1} className="meal-field" value={props.voteTokens} onChange={(event) => props.setVoteTokens(event.target.value)} disabled={props.useVoteTicket} />
                  <Button variant="secondary" onClick={props.onVoteQuote}>試算</Button>
                </div>
                {props.voteQuoteMessage ? <p className="mt-2 text-xs text-muted-foreground">{props.voteQuoteMessage}</p> : null}
              </Field>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={props.useVoteTicket} onChange={(event) => props.setUseVoteTicket(event.target.checked)} disabled={hasCurrentMemberVote || actionPending} />
                使用投票優惠券。投票優惠券固定換 1 票，確認投票後不可更改。
              </label>
              {hasCurrentMemberVote ? <p className="text-sm text-[hsl(25_85%_36%)]">你已完成這輪投票，付款確認後不可再次修改。</p> : null}
              {proposal.options.map((option) => (
                <div key={option.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{option.merchantName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">確認後不可再修改投票對象</p>
                    </div>
                    {hasCurrentMemberVote ? (
                      <span className={`rounded-full px-3 py-2 text-xs font-bold ${
                        proposal.currentVoteOptionId === option.id
                          ? "bg-[hsl(25_85%_36%)] text-white"
                          : "border border-border bg-background text-muted-foreground"
                      }`}>
                        {proposal.currentVoteOptionId === option.id ? "已投票" : "未選擇"}
                      </span>
                    ) : (
                      <Button onClick={() => props.onVote(option.id)} disabled={actionPending || (!props.useVoteTicket && !props.voteTokens.trim())}>確認投票這家</Button>
                    )}
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
              <p className="mt-1 text-sm text-muted-foreground">總票數：{winner?.weightedVotes || 0}</p>
            </div>
          </section>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Menu</p>
            <h3 className="text-2xl font-extrabold">點餐</h3>
            <p className="mt-3 text-sm text-muted-foreground">截止前你可以持續追加自己的點餐內容。這裡只會顯示你目前已點的項目，不會顯示其他成員的內容。</p>
            {currentMemberOrder ? (
              <div className="mt-6 rounded-[1.2rem] border border-[rgba(194,119,60,0.28)] bg-[rgba(194,119,60,0.08)] p-4">
                <p className="meal-kicker">Your current order</p>
                <p className="mt-2 text-sm text-muted-foreground">你目前已點的內容</p>
                <div className="mt-4 space-y-2">
                  {currentMemberOrder.items.map((item) => (
                    <div key={`${currentMemberOrder.id}-${item.menuItemId}`} className="flex items-center justify-between gap-3 text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span className="text-muted-foreground">{formatWeiFriendly(BigInt(item.priceWei) * BigInt(item.quantity))}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm font-semibold">目前已付款總額：{formatWeiFriendly(currentMemberOrder.amountWei)}</p>
              </div>
            ) : null}
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
                本輪會先付款到平台中心錢包，鏈上只保留交易紀錄。
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
                    <p className="text-sm text-muted-foreground">{option.weightedVotes} 票</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="meal-panel p-8">
            <p className="meal-kicker">Orders</p>
            <h3 className="text-2xl font-extrabold">整筆訂單內容</h3>
            <p className="mt-3 text-sm text-muted-foreground">以下會列出這筆整單中每位參與成員點了什麼項目。只有建立訂單的人可以確認整筆訂單已接收。</p>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <Stat label="訂單建立者" value={proposalCreatorName(proposal)} />
              <Stat label="參與點餐人數" value={`${aggregateOrder.memberCount} 人`} />
              <Stat label="總金額" value={formatEth(aggregateOrder.amountWei)} />
              <Stat label="整筆狀態" value={formatAggregateOrderStatus(aggregateOrder.status)} />
              <Stat label="整體確認接收" value={aggregateOrder.status === "platform_paid" ? "已確認" : canCreatorConfirmReceipt(proposal, props.member) ? "待建立者確認" : aggregateOrder.status === "ready_for_payout" ? "已確認" : "未確認"} />
            </div>
            <div className="mt-6 space-y-3">
              {proposal.orders.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有人完成點餐。</p> : null}
              {proposal.orders.map((order) => (
                <div key={order.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{order.memberName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatOrderStatus(order.status)} · {formatWeiFriendly(order.amountWei)}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {order.items.map((item) => (
                      <div key={`${order.id}-${item.menuItemId}`} className="flex items-center justify-between gap-3 text-sm">
                        <span>{item.name} x{item.quantity}</span>
                        <span className="text-muted-foreground">{formatWeiFriendly(BigInt(item.priceWei) * BigInt(item.quantity))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {canCreatorConfirmReceipt(proposal, props.member) ? (
              <div className="mt-6">
                <Button
                  onClick={() => props.onConfirm(confirmableOrderIds(proposal))}
                  disabled={actionPending}
                >
                  確認整筆訂單接收
                </Button>
              </div>
            ) : null}
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

function stageForProposal(proposal: Proposal, now: number): Stage | null {
  const proposalDeadline = new Date(proposal.proposalDeadline).getTime();
  const voteDeadline = new Date(proposal.voteDeadline).getTime();
  const orderDeadline = new Date(proposal.orderDeadline).getTime();
  const hasWinner = proposal.options.some((option) => option.id === proposal.winnerOptionId);
  if (Number.isFinite(proposalDeadline) && now < proposalDeadline) return "proposal";
  if (Number.isFinite(voteDeadline) && now < voteDeadline) return "voting";
  if (hasWinner && Number.isFinite(orderDeadline) && now < orderDeadline) return "ordering";
  if (hasWinner || proposal.orderMemberCount > 0 || safeArray(proposal.orders).length > 0) return "submitted";
  return null;
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
  const votes = safeArray(proposal.votes);
  const createdAt = new Date(proposal.createdAt).getTime();
  let proposalDeadline = new Date(proposal.proposalDeadline).getTime();
  let voteDeadline = new Date(proposal.voteDeadline).getTime();
  let orderDeadline = new Date(proposal.orderDeadline).getTime();
  const proposalMinutes = Math.round((proposalDeadline - createdAt) / 60000);
  if (Number.isFinite(createdAt) && Number.isFinite(proposalDeadline) && proposalMinutes > 90 && proposalMinutes <= 1530) {
    proposalDeadline -= 1440 * 60000;
    voteDeadline -= 1440 * 60000;
    orderDeadline -= 1440 * 60000;
  }
  return {
    ...proposal,
    proposalDeadline: new Date(proposalDeadline).toISOString(),
    voteDeadline: new Date(voteDeadline).toISOString(),
    orderDeadline: new Date(orderDeadline).toISOString(),
    options: safeArray(proposal.options),
    orders: safeArray(proposal.orders),
    votes,
    totalVoteCount: proposal.totalVoteCount ?? votes.reduce((sum, vote) => sum + (vote.voteCount ?? vote.voteWeight ?? 0), 0)
  };
}

function dedupeProposals(proposals: Proposal[]) {
  const byKey = new Map<string, Proposal>();
  for (const proposal of proposals) {
    const key = `proposal:${proposal.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, proposal);
      continue;
    }
    byKey.set(key, scoreProposal(existing) >= scoreProposal(proposal) ? existing : proposal);
  }
  return Array.from(byKey.values());
}

function scoreProposal(proposal: Proposal) {
  let score = 0;
  score += proposal.groupId > 0 ? 1000 : 0;
  score += proposal.options.length * 100;
  score += safeArray(proposal.orders).length * 20;
  score += safeArray(proposal.votes).length * 10;
  score += proposal.title.startsWith("Chain Proposal #") ? 0 : 50;
  return score;
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
  if (stage === "proposal") return normalizeStageMinutes(Math.round((proposalAt - createdAt) / 60000));
  if (stage === "vote") return normalizeStageMinutes(Math.round((voteAt - proposalAt) / 60000));
  return normalizeStageMinutes(Math.round((orderAt - voteAt) / 60000));
}

function normalizeStageMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  let normalized = minutes;
  while (normalized > 1440) {
    normalized -= 1440;
  }
  if (normalized > 90 && normalized-1440 <= 90) {
    normalized -= 1440;
  }
  if (normalized > 90 && normalized >= 1440) {
    normalized = normalized % 1440;
  }
  return Math.max(0, normalized);
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
    case "failed":
      return "成立失敗";
    case "cancelled":
      return "已撤回";
    default:
      return status;
  }
}

function stageDetailHeading(stage: Stage) {
  switch (stage) {
    case "proposal":
      return { kicker: "Proposal stage", title: "店家提案階段" };
    case "voting":
      return { kicker: "Voting stage", title: "投票階段" };
    case "ordering":
      return { kicker: "Ordering stage", title: "點餐階段" };
    case "submitted":
      return { kicker: "Submitted stage", title: "完成送出訂單階段" };
    case "create":
    default:
      return { kicker: "Create stage", title: "建立訂單" };
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

function aggregateProposalOrder(proposal: Proposal) {
  const orders = safeArray(proposal.orders);
  const amountWei = orders.reduce((total, order) => total + BigInt(order.amountWei || "0"), 0n);
  const itemCount = orders.reduce((total, order) => total + safeArray(order.items).reduce((sum, item) => sum + item.quantity, 0), 0);
  const createdAt = orders.length ? new Date(Math.min(...orders.map((order) => new Date(order.createdAt).getTime()))).toISOString() : undefined;
  const acceptedAt = latestTimeline(orders.map((order) => order.acceptedAt));
  const completedAt = latestTimeline(orders.map((order) => order.completedAt));
  const confirmedAt = latestTimeline(orders.map((order) => order.confirmedAt));
  const paidOutAt = latestTimeline(orders.map((order) => order.paidOutAt));
  return {
    memberCount: orders.length,
    itemCount,
    amountWei,
    status: aggregateOrderStatus(orders.map((order) => order.status)),
    createdAt,
    acceptedAt,
    completedAt,
    confirmedAt,
    paidOutAt,
  };
}

function confirmableOrderIds(proposal: Proposal) {
  return safeArray(proposal.orders)
    .filter((order) => order.status === "merchant_completed")
    .map((order) => order.id);
}

function proposalCreatorName(proposal: Proposal) {
  const name = String(proposal.createdByName || proposal.orders[0]?.createdByName || "").trim();
  return name || "未知";
}

function canCreatorConfirmReceipt(proposal: Proposal, member: Member | null) {
  const proposalCreatorId = Number(proposal.createdBy || proposal.orders[0]?.createdBy || 0);
  const currentMemberId = Number(member?.id || 0);
  const proposalCreatorName = String(proposal.createdByName || proposal.orders[0]?.createdByName || "").trim();
  const currentMemberName = String(member?.displayName || "").trim();
  const isCreator = proposalCreatorId > 0 && currentMemberId > 0
    ? proposalCreatorId === currentMemberId
    : proposalCreatorName !== "" && currentMemberName !== "" && proposalCreatorName === currentMemberName;
  if (!isCreator) return false;
  return confirmableOrderIds(proposal).length > 0;
}

function latestTimeline(values: Array<string | undefined>) {
  const filtered = values.filter(Boolean) as string[];
  if (!filtered.length) return undefined;
  return filtered.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function aggregateOrderStatus(statuses: string[]) {
  if (!statuses.length) return "payment_received";
  if (statuses.some((status) => status === "payment_received" || status === "paid_local" || status === "paid_onchain")) return "payment_received";
  if (statuses.some((status) => status === "merchant_accepted")) return "merchant_accepted";
  if (statuses.some((status) => status === "merchant_completed")) return "merchant_completed";
  if (statuses.some((status) => status === "ready_for_payout")) return "ready_for_payout";
  if (statuses.every((status) => status === "platform_paid")) return "platform_paid";
  return statuses[0];
}

function formatAggregateOrderStatus(status: string) {
  switch (status) {
    case "payment_received":
    case "paid_local":
    case "paid_onchain":
      return "點餐階段進行中";
    case "merchant_accepted":
      return "店家已接單";
    case "merchant_completed":
      return "店家已完成製作";
    case "ready_for_payout":
      return "會員已確認，待平台撥款";
    case "platform_paid":
      return "已完成";
    default:
      return formatOrderStatus(status);
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

function durationOptions(options: number[] | undefined, fallback: number) {
  const values = Array.from(new Set([fallback, ...(options || [])].filter((value) => Number.isFinite(value) && value > 0)))
    .map((value) => Math.trunc(value))
    .sort((left, right) => left - right);
  return values.length ? values : [1];
}
