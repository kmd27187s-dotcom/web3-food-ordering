"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBasket, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  addProposalOption,
  confirmMemberOrder,
  createProposal,
  deleteProposal,
  fetchContractInfo,
  fetchGroup,
  fetchGroups,
  fetchMe,
  fetchMerchants,
  fetchMerchant,
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
  type ProposalOption,
  voteProposal
} from "@/lib/api";
import { ensureSepoliaWallet, getWalletBalanceWei, isUsableContractAddress, ORDER_ABI } from "@/lib/chain";

type GovernanceState = {
  member: Member | null;
  groups: Group[];
  proposals: Proposal[];
  contractInfo: ContractInfo | null;
  governanceParams: GovernanceParams | null;
};

type GovernanceTab = "proposing" | "voting" | "ordering";
type WorkflowStage = "create" | "proposal" | "voting" | "ordering" | "submitted";

const APPROX_TWD_PER_ETH = 120000;
const stageMeta: Record<WorkflowStage, { title: string; body: string }> = {
  create: {
    title: "建立訂單",
    body: "設定這一輪訂單流程。"
  },
  proposal: {
    title: "建立訂單階段",
    body: "建立候選店家清單，完成這一輪訂單前置設定。"
  },
  voting: {
    title: "投票階段",
    body: "輸入要投的票數後送出。"
  },
  ordering: {
    title: "點餐階段",
    body: "選餐、確認總額，再把付款交給 MetaMask。"
  },
  submitted: {
    title: "完成送出訂單階段",
    body: "查看已送出的訂單進度、狀態與確認接收功能。"
  }
};

type CreateDraft = {
  groupId: string;
  title: string;
  maxOptions: string;
  proposalMinutes: string;
  voteMinutes: string;
  orderMinutes: string;
  merchantId: string;
};

const defaultCreateDraft: CreateDraft = {
  groupId: "",
  title: "",
  maxOptions: "5",
  proposalMinutes: "1",
  voteMinutes: "1",
  orderMinutes: "1",
  merchantId: ""
};

export function GovernanceBoard() {
  const [state, setState] = useState<GovernanceState>({ member: null, groups: [], proposals: [], contractInfo: null, governanceParams: null });
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [message, setMessage] = useState("");
  const [activeStage, setActiveStage] = useState<WorkflowStage>("create");
  const [createDraft, setCreateDraft] = useState<CreateDraft>(defaultCreateDraft);
  const [createMerchantQuery, setCreateMerchantQuery] = useState("");
  const [optionMerchantId, setOptionMerchantId] = useState<Record<number, string>>({});
  const [optionMerchantQuery, setOptionMerchantQuery] = useState<Record<number, string>>({});
  const [voteTokens, setVoteTokens] = useState<Record<number, string>>({});
  const [voteQuotes, setVoteQuotes] = useState<Record<number, string>>({});
  const [menus, setMenus] = useState<Record<string, Merchant>>({});
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [orderItems, setOrderItems] = useState<Record<number, Record<string, number>>>({});

  const refresh = useCallback(async () => {
    const [member, groups, proposals, contractInfo, merchantList, governanceParams] = await Promise.all([
      fetchMe(),
      fetchGroups(),
      fetchProposals(),
      fetchContractInfo().catch(() => null),
      fetchMerchants().catch(() => []),
      fetchPublicGovernanceParams().catch(() => null)
    ]);
    const enrichedGroups = await Promise.all(groups.map((group) => fetchGroup(group.id)));
    setState({
      member,
      groups: enrichedGroups,
      proposals: safeArray(proposals).map(normalizeProposal),
      contractInfo,
      governanceParams
    });
    setMerchants(Array.isArray(merchantList) ? merchantList : []);
    setCreateDraft((current) => ({
      ...current,
      groupId: current.groupId || (enrichedGroups[0] ? String(enrichedGroups[0].id) : ""),
      proposalMinutes: current.proposalMinutes || String(governanceParams?.proposalDurationMinutes || 1),
      voteMinutes: current.voteMinutes || String(governanceParams?.voteDurationMinutes || 1),
      orderMinutes: current.orderMinutes || String(governanceParams?.orderingDurationMinutes || 1)
    }));
  }, []);

  useEffect(() => {
    let active = true;

    refresh()
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "目前無法載入治理資料");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (loading) return;

    const refreshSafely = () => {
      void refresh().catch(() => undefined);
    };

    const pollId = window.setInterval(refreshSafely, 15000);
    const nextTransitionAt = nextProposalTransitionAt(state.proposals);
    const timeoutId =
      nextTransitionAt !== null
        ? window.setTimeout(refreshSafely, Math.max(1000, nextTransitionAt - Date.now() + 1000))
        : null;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshSafely();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(pollId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loading, refresh, state.proposals]);

  useEffect(() => {
    const merchantIds = new Set<string>();
    for (const proposal of state.proposals) {
      const winner = safeArray(proposal.options).find((option) => option.id === proposal.winnerOptionId);
      if (winner?.merchantId) merchantIds.add(winner.merchantId);
    }
    merchantIds.forEach((merchantId) => {
      if (menus[merchantId]) return;
      fetchMerchant(merchantId)
        .then((merchant) => {
          setMenus((current) => ({ ...current, [merchantId]: merchant }));
        })
        .catch(() => undefined);
    });
  }, [menus, state.proposals]);

  const proposalDurationOptions = useMemo(() => durationOptions(state.governanceParams?.proposalDurationOptions, state.governanceParams?.proposalDurationMinutes ?? 1), [state.governanceParams?.proposalDurationMinutes, state.governanceParams?.proposalDurationOptions]);
  const voteDurationOptions = useMemo(() => durationOptions(state.governanceParams?.voteDurationOptions, state.governanceParams?.voteDurationMinutes ?? 1), [state.governanceParams?.voteDurationMinutes, state.governanceParams?.voteDurationOptions]);
  const orderingDurationOptions = useMemo(() => durationOptions(state.governanceParams?.orderingDurationOptions, state.governanceParams?.orderingDurationMinutes ?? 1), [state.governanceParams?.orderingDurationMinutes, state.governanceParams?.orderingDurationOptions]);

  const grouped = useMemo(
    () => ({
      proposing: state.proposals.filter((proposal) => proposal.status === "proposing"),
      voting: state.proposals.filter((proposal) => proposal.status === "voting"),
      ordering: state.proposals.filter((proposal) => proposal.status === "ordering"),
      submitted: state.proposals.filter((proposal) => {
        const myOrder = safeArray(proposal.orders).find((order) => order.memberId === state.member?.id);
        return Boolean(myOrder) || ["awaiting_settlement", "settled"].includes(proposal.status);
      })
    }),
    [state.member?.id, state.proposals]
  );

  const activeTab: GovernanceTab =
    activeStage === "voting" ? "voting" : activeStage === "ordering" || activeStage === "submitted" ? "ordering" : "proposing";

  async function handleCreateProposal() {
    if (!createDraft.title.trim() || !createDraft.groupId) return;
    const resolvedMerchantId = resolveMerchantId(createDraft.merchantId, createMerchantQuery, merchants);
    if (createMerchantQuery.trim() && !resolvedMerchantId) {
      setMessage("請從資料庫店家清單中選擇首間候選店家。");
      return;
    }
    setActionPending(true);
    setMessage("");
    try {
      await createProposal({
        title: createDraft.title.trim(),
        description: "",
        maxOptions: Number(createDraft.maxOptions),
        merchantId: resolvedMerchantId || undefined,
        proposalMinutes: Number(createDraft.proposalMinutes),
        voteMinutes: Number(createDraft.voteMinutes),
        orderMinutes: Number(createDraft.orderMinutes),
        groupId: Number(createDraft.groupId)
      });
      setCreateDraft((current) => ({ ...defaultCreateDraft, groupId: current.groupId }));
      setCreateMerchantQuery("");
      await refresh();
      setMessage("已建立新的 proposal round。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立提案失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAddOption(proposalId: number) {
    const merchantId = resolveMerchantId(optionMerchantId[proposalId] || "", optionMerchantQuery[proposalId] || "", merchants);
    if (!merchantId) return;
    setActionPending(true);
    setMessage("");
    try {
      await addProposalOption(proposalId, merchantId);
      setOptionMerchantId((current) => ({ ...current, [proposalId]: "" }));
      setOptionMerchantQuery((current) => ({ ...current, [proposalId]: "" }));
      await refresh();
      setMessage("已提名候選店家。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提名失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleDeleteProposal(proposalId: number) {
    const confirmed = window.confirm("確定要刪除這個提案 round 嗎？如果目前只有你自己提案，已花費的 token 會一併退回。");
    if (!confirmed) return;
    setActionPending(true);
    setMessage("");
    try {
      await deleteProposal(proposalId);
      await refresh();
      setMessage("已刪除單人提案 round。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除提案失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleVote(proposalId: number, optionId: number) {
    const rawTokenAmount = (voteTokens[proposalId] || "").trim();
    const tokenAmount = Number(rawTokenAmount);
    if (!rawTokenAmount || Number.isNaN(tokenAmount) || tokenAmount <= 0) {
      setMessage("請先輸入大於 0 的投票權重。");
      return;
    }
    setActionPending(true);
    setMessage("");
    try {
      await voteProposal(proposalId, optionId, tokenAmount);
      await refresh();
      setMessage(`已送出投票，票數 ${tokenAmount}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投票失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleVoteQuote(proposalId: number) {
    const rawTokenAmount = (voteTokens[proposalId] || "").trim();
    const tokenAmount = Number(rawTokenAmount);
    if (!rawTokenAmount || Number.isNaN(tokenAmount) || tokenAmount <= 0) {
      setVoteQuotes((current) => ({ ...current, [proposalId]: "請先輸入大於 0 的投票權重" }));
      return;
    }
    try {
      const quote = await quoteVote(proposalId, tokenAmount);
      setVoteQuotes((current) => ({ ...current, [proposalId]: `${quote.voteWeight} 票` }));
    } catch (error) {
      setVoteQuotes((current) => ({ ...current, [proposalId]: error instanceof Error ? error.message : "無法估算票數" }));
    }
  }

  async function handleOrder(proposal: Proposal, merchant?: Merchant) {
    const items = orderItems[proposal.id] || {};
    const payload = Object.fromEntries(Object.entries(items).filter(([, quantity]) => quantity > 0));
    if (Object.keys(payload).length === 0) {
      setMessage("請先選擇至少一項餐點。");
      return;
    }
    setActionPending(true);
    setMessage("");
    try {
      const result = await signOrder(proposal.id, payload);
      const canUseChainOrder =
        Boolean(proposal.chainProposalId) &&
        Boolean(result.signature) &&
        isUsableContractAddress(state.contractInfo?.orderContract);
      const canUseFallbackWalletPay =
        Boolean(result.signature) &&
        Boolean(state.contractInfo?.platformTreasury) &&
        isUsableContractAddress(state.contractInfo?.platformTreasury);

      if (!result.signature) {
        setMessage("這一輪訂單尚未生成付款簽章，暫時無法喚起 MetaMask。");
        return;
      }

      const walletClient = await ensureSepoliaWallet();
      const [walletAddress] = await walletClient.getAddresses();
      const walletBalanceWei = await getWalletBalanceWei(walletAddress);
      const requiredBalanceWei = BigInt(result.quote.requiredBalanceWei);
      if (walletBalanceWei < requiredBalanceWei) {
        setMessage(
          `錢包餘額不足，至少需要 ${formatWeiFriendly(result.quote.requiredBalanceWei)}（餐點 ${formatWeiFriendly(result.quote.subtotalWei)} + 預估 gas ${formatWeiFriendly(result.quote.estimatedGasWei)}）。`
        );
        return;
      }

      if (canUseChainOrder && proposal.chainProposalId) {
        const txHash = await walletClient.writeContract({
          address: state.contractInfo!.orderContract as `0x${string}`,
          abi: ORDER_ABI,
          functionName: "placeOrder",
          args: [
            BigInt(proposal.chainProposalId),
            result.signature.orderHash as `0x${string}`,
            JSON.stringify(payload),
            BigInt(result.signature.amountWei),
            BigInt(result.signature.expiry),
            result.signature.signature as `0x${string}`
          ],
          value: BigInt(result.signature.amountWei),
          account: walletAddress
        });
        await registerPendingTransaction({
          proposalId: proposal.id,
          action: "place_order",
          txHash,
          walletAddress,
          relatedOrder: result.signature.orderHash
        });
        await finalizeOrder({
          proposalId: proposal.id,
          items: payload,
          signature: result.signature
        });
        setOrderItems((current) => ({ ...current, [proposal.id]: {} }));
        await refresh();
        setMessage(`已喚起 MetaMask 支付 ${formatWeiFriendly(result.quote.subtotalWei)}，交易送出：${txHash.slice(0, 10)}...`);
        return;
      }

      if (canUseFallbackWalletPay) {
        const txHash = await walletClient.sendTransaction({
          to: state.contractInfo!.platformTreasury as `0x${string}`,
          value: BigInt(result.quote.subtotalWei),
          account: walletAddress
        });
        await registerPendingTransaction({
          proposalId: proposal.id,
          action: "pay_order_fallback",
          txHash,
          walletAddress,
          relatedOrder: result.signature.orderHash
        });
        await finalizeOrder({
          proposalId: proposal.id,
          items: payload,
          signature: result.signature
        });
        setOrderItems((current) => ({ ...current, [proposal.id]: {} }));
        await refresh();
        setMessage(
          `已用 MetaMask 付款到平台中心錢包，交易送出：${txHash.slice(0, 10)}...`
        );
        return;
      }

      setMessage("平台中心錢包尚未配置，請先由管理者綁定收款錢包後再付款。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "點餐失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleConfirmReceived(orderId: number) {
    setActionPending(true);
    setMessage("");
    try {
      await confirmMemberOrder(orderId);
      await refresh();
      setMessage("已確認餐點完成，訂單已送往平台撥款流程。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "確認完成失敗");
    } finally {
      setActionPending(false);
    }
  }

  function setOrderQuantity(proposalId: number, itemId: string, quantity: number) {
    setOrderItems((current) => ({
      ...current,
      [proposalId]: {
        ...(current[proposalId] || {}),
        [itemId]: Math.max(0, quantity)
      }
    }));
  }

  function merchantLabel(merchantId: string) {
    const merchant = merchants.find((item) => item.id === merchantId.trim());
    if (!merchant) return "";
    return `${merchant.name} (${merchant.id})`;
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="meal-panel p-8">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-4 w-96 animate-pulse rounded bg-muted" />
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border/70 bg-background/70" />
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-[1.5rem] border border-border/80 bg-card/90" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="meal-section-heading max-w-none">
            <p className="meal-kicker">Ordering workspace</p>
            <h1>建立訂單工作台</h1>
            <p>建立訂單、投票、點餐到完成送出訂單，都在同一套流程裡。</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="我的提案券" value={`${state.member?.proposalTicketCount || 0} 張`} />
            <Stat label="目前群組" value={`${state.groups.length} 個`} />
            <Stat label="鏈上模式" value={isUsableContractAddress(state.contractInfo?.orderContract) ? "Sepolia 已配置" : "本地 fallback"} />
          </div>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div className="meal-section-heading max-w-none">
            <p className="meal-kicker">Current stage</p>
            <h2>{stageMeta[activeStage].title}</h2>
            <p>{stageMeta[activeStage].body}</p>
          </div>
          <div className="meal-glass-card rounded-[1.6rem] p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <TabButton active={activeStage === "create"} onClick={() => setActiveStage("create")}>
                建立訂單
              </TabButton>
              <TabButton active={activeStage === "proposal"} onClick={() => setActiveStage("proposal")}>
                建立訂單階段
              </TabButton>
              <TabButton active={activeStage === "voting"} onClick={() => setActiveStage("voting")}>
                投票階段
              </TabButton>
              <TabButton active={activeStage === "ordering"} onClick={() => setActiveStage("ordering")}>
                點餐階段
              </TabButton>
              <TabButton active={activeStage === "submitted"} onClick={() => setActiveStage("submitted")}>
                完成送出訂單階段
              </TabButton>
            </div>
          </div>
        </div>
      </section>

      {activeTab === "proposing" ? (
        <>
          <section className="meal-panel p-6 shadow-sm">
            <p className="meal-kicker">Create order flow</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="群組 (必填)">
                <select
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.groupId}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, groupId: event.target.value }))}
                >
                  <option value="">選擇群組</option>
                  {state.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="訂單標題 (必填)">
                <input
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.title}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="例：信義辦公室午餐訂單"
                />
              </Field>
              <Field label="候選名額 (必填)">
                <input
                  type="number"
                  min={3}
                  max={10}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.maxOptions}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, maxOptions: event.target.value }))}
                />
              </Field>
              <Field label="提名時間（分鐘） (必填)">
                <select
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.proposalMinutes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, proposalMinutes: event.target.value }))}
                >
                  {proposalDurationOptions.map((minutes) => (
                    <option key={`proposal-${minutes}`} value={String(minutes)}>
                      {minutes} 分鐘
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="投票時間（分鐘） (必填)">
                <select
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.voteMinutes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, voteMinutes: event.target.value }))}
                >
                  {voteDurationOptions.map((minutes) => (
                    <option key={`vote-${minutes}`} value={String(minutes)}>
                      {minutes} 分鐘
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="點餐時間（分鐘） (必填)">
                <select
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.orderMinutes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, orderMinutes: event.target.value }))}
                >
                  {orderingDurationOptions.map((minutes) => (
                    <option key={`order-${minutes}`} value={String(minutes)}>
                      {minutes} 分鐘
                    </option>
                  ))}
                </select>
              </Field>
              <MerchantPicker
                label="首間候選店家（選填）"
                merchants={merchants}
                selectedMerchantId={createDraft.merchantId}
                query={createMerchantQuery}
                onQueryChange={setCreateMerchantQuery}
                onSelect={(merchantId) => setCreateDraft((current) => ({ ...current, merchantId }))}
                helperText="輸入店名或 merchant id，從資料庫店家中選擇。"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={handleCreateProposal} disabled={actionPending || !createDraft.title.trim() || !createDraft.groupId}>
                {actionPending ? "處理中..." : "建立本輪訂單"}
              </Button>
              <p className="text-sm text-muted-foreground">建立訂單時會依平台設定收取建立費。</p>
            </div>
          </section>

          <Section title="建立訂單階段" description="建立候選店家清單，完成這一輪訂單前置設定。">
            {grouped.proposing.length === 0 ? <Empty text="目前沒有進行中的建立訂單階段。" /> : null}
            <div className="grid gap-5 xl:grid-cols-2">
              {grouped.proposing.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal}>
                  <div className="space-y-4">
                    {proposal.createdBy === state.member?.id &&
                    safeArray(proposal.options).every((option) => option.proposerMemberId === state.member?.id) ? (
                      <div className="flex justify-end">
                        <Button variant="secondary" onClick={() => handleDeleteProposal(proposal.id)} disabled={actionPending}>
                          刪除這輪訂單
                        </Button>
                      </div>
                    ) : null}
                    <OptionList options={proposal.options} showVoteWeight={false} />
                    <div className="space-y-3">
                      <MerchantPicker
                        label="提名店家 (必填)"
                        merchants={merchants}
                        selectedMerchantId={optionMerchantId[proposal.id] || ""}
                        query={optionMerchantQuery[proposal.id] || ""}
                        onQueryChange={(query) => setOptionMerchantQuery((current) => ({ ...current, [proposal.id]: query }))}
                        onSelect={(merchantId) => setOptionMerchantId((current) => ({ ...current, [proposal.id]: merchantId }))}
                        helperText="輸入店名或 merchant id，從資料庫店家中選擇。"
                      />
                      <Button
                        onClick={() => handleAddOption(proposal.id)}
                        disabled={actionPending || !resolveMerchantId(optionMerchantId[proposal.id] || "", optionMerchantQuery[proposal.id] || "", merchants)}
                      >
                        提名
                      </Button>
                    </div>
                  </div>
                </ProposalCard>
              ))}
            </div>
          </Section>
        </>
      ) : null}

      {activeTab === "voting" ? (
        <Section title="投票階段" description="輸入要投的票數後送出。">
          {grouped.voting.length === 0 ? <Empty text="目前沒有進行中的投票期 round。" /> : null}
          <div className="grid gap-5 xl:grid-cols-2">
            {grouped.voting.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal}>
                <div className="space-y-4">
                      <div className="meal-soft-panel px-4 py-4 text-sm text-muted-foreground">
                    目前總票數 {safeArray(proposal.options).reduce((sum, option) => sum + option.weightedVotes, 0)}。
                    {proposal.currentVoteOptionId
                      ? ` 你目前已投出 ${proposal.currentVoteWeight} 票。`
                      : " 你目前還沒有投票。"}
                  </div>
                  <Field label="這輪投幾票 (必填)">
                    <div className="flex gap-3">
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={voteTokens[proposal.id] ?? ""}
                        placeholder="輸入票數"
                        onChange={(event) => setVoteTokens((current) => ({ ...current, [proposal.id]: event.target.value }))}
                      />
                      <Button variant="secondary" onClick={() => handleVoteQuote(proposal.id)}>
                        試算
                      </Button>
                    </div>
                    {voteQuotes[proposal.id] ? <p className="mt-2 text-xs text-muted-foreground">{voteQuotes[proposal.id]}</p> : null}
                  </Field>
                  <div className="grid gap-3">
                    {safeArray(proposal.options).map((option) => (
                      <div key={option.id} className="meal-soft-panel px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{option.merchantName}</p>
                            <p className="text-sm text-muted-foreground">目前 {option.weightedVotes} 票</p>
                          </div>
                          <Button onClick={() => handleVote(proposal.id, option.id)} disabled={actionPending || proposal.currentVoteOptionId > 0}>
                            投給這家
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ProposalCard>
            ))}
          </div>
        </Section>
      ) : null}

      {activeTab === "ordering" ? (
        <Section
          title={activeStage === "ordering" ? "點餐階段" : "完成送出訂單階段"}
          description={activeStage === "ordering" ? "選餐、確認總額，再把付款交給 MetaMask。" : "查看你已送出的訂單進度、狀態與確認接收功能。"}
        >
          {(activeStage === "ordering" ? grouped.ordering : grouped.submitted).length === 0 ? (
            <Empty text={activeStage === "ordering" ? "目前沒有可點餐的 round。" : "目前沒有已送出的訂單資料。"} />
          ) : null}
          <div className="grid gap-5 xl:grid-cols-2">
            {(activeStage === "ordering" ? grouped.ordering : grouped.submitted).map((proposal) => {
              const winner = safeArray(proposal.options).find((option) => option.id === proposal.winnerOptionId);
              const merchant = winner ? menus[winner.merchantId] : undefined;
              const myOrder = safeArray(proposal.orders).find((order) => order.memberId === state.member?.id);
              const selectedItems = merchant?.menu
                ? merchant.menu.filter((item) => (orderItems[proposal.id]?.[item.id] || 0) > 0)
                : [];
              const selectedPortions = selectedItems.reduce(
                (sum, item) => sum + (orderItems[proposal.id]?.[item.id] || 0),
                0
              );
              const selectedSubtotalWei = selectedItems.reduce((total, item) => {
                const quantity = orderItems[proposal.id]?.[item.id] || 0;
                return total + BigInt(item.priceWei) * BigInt(quantity);
              }, BigInt(0));
              const hasPaidOrder = Boolean(myOrder);
              const canSubmitOrder = proposal.status === "ordering" && selectedItems.length > 0 && !hasPaidOrder;
              const canUseChainOrder = isUsableContractAddress(state.contractInfo?.orderContract);
              return (
                <ProposalCard key={proposal.id} proposal={proposal}>
                  <div className="space-y-4">
                    <div className="meal-soft-panel px-4 py-4">
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">勝出店家</p>
                      <p className="mt-2 text-lg font-semibold">{winner?.merchantName || "尚未定案"}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        本輪總額 {formatWeiFriendly(proposal.orderTotalWei)} · {proposal.orderMemberCount} 人點餐
                      </p>
                      {proposal.chainProposalId ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          chainProposalId: {proposal.chainProposalId}
                          {isUsableContractAddress(state.contractInfo?.orderContract) ? " · 會直接走 Sepolia 合約送單" : " · 合約地址未配置，將退回本地點餐"}
                        </p>
                      ) : null}
                    </div>
                    {proposal.status === "ordering" && merchant?.menu?.length ? (
                      <div className="space-y-4">
                        <div className="grid gap-3">
                          {merchant.menu.map((item) => {
                            const quantity = orderItems[proposal.id]?.[item.id] || 0;
                            return (
                              <div
                                key={item.id}
                                className="rounded-[1.35rem] border border-[rgba(220,193,177,0.36)] bg-[rgba(255,255,255,0.68)] px-4 py-4 backdrop-blur"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{formatWeiFriendly(item.priceWei)}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="h-11 w-11 rounded-full px-0"
                                      onClick={() => setOrderQuantity(proposal.id, item.id, quantity - 1)}
                                      disabled={actionPending || quantity <= 0}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <div className="min-w-[3rem] text-center">
                                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                                        數量
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-foreground">{quantity}</p>
                                    </div>
                                    <Button
                                      type="button"
                                      className="h-11 w-11 rounded-full px-0"
                                      onClick={() => setOrderQuantity(proposal.id, item.id, quantity + 1)}
                                      disabled={actionPending}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between border-t border-[rgba(220,193,177,0.32)] pt-4 text-sm">
                                  <span className="text-muted-foreground">項目總額</span>
                                  <span className="font-semibold text-foreground">
                                    {formatMenuItemSubtotal(item.priceWei, quantity)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="rounded-[1.35rem] border border-[rgba(194,119,60,0.28)] bg-[rgba(194,119,60,0.08)] px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="meal-kicker">Order summary</p>
                              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                <ShoppingBasket className="h-4 w-4" />
                                已選 {selectedItems.length} 項、共 {selectedPortions} 份
                              </p>
                              <p className="mt-2 text-lg font-semibold text-foreground">{formatWeiFriendly(selectedSubtotalWei)}</p>
                              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Wallet className="h-4 w-4" />
                                {canUseChainOrder ? "本輪會喚起 MetaMask 進行 Sepolia 合約支付。" : "本輪會先付款到平台中心錢包，待後續結算撥款給店家。"}
                              </p>
                            </div>
                            <Button onClick={() => handleOrder(proposal, merchant)} disabled={actionPending || !canSubmitOrder}>
                              {hasPaidOrder ? "已付款完成" : "送出點餐並前往錢包支付"}
                            </Button>
                          </div>
                          {hasPaidOrder ? (
                            <p className="mt-4 text-sm text-[hsl(142_54%_32%)]">
                              這一輪你已經完成付款，若要查看進度請看下方「我的訂單」。
                            </p>
                          ) : null}
                          {selectedItems.length ? (
                            <div className="mt-4 rounded-[1.2rem] border border-[rgba(194,119,60,0.18)] bg-white/70 px-4 py-4">
                              <div className="space-y-2 text-sm">
                                {selectedItems.map((item) => {
                                  const quantity = orderItems[proposal.id]?.[item.id] || 0;
                                  return (
                                    <div key={`summary-${proposal.id}-${item.id}`} className="flex items-center justify-between gap-4">
                                      <span className="text-foreground">
                                        {item.name} x {quantity}
                                      </span>
                                      <span className="font-semibold text-foreground">
                                        {formatMenuItemSubtotal(item.priceWei, quantity)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : proposal.status === "ordering" ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                        {winner ? "菜單載入中或目前沒有菜單。" : "等待投票結果 finalize 後才能點餐。"}
                      </div>
                    ) : null}
                    {myOrder ? (
                      <div className="meal-soft-panel px-4 py-4">
                        <p className="meal-kicker">我的訂單</p>
                        <p className="mt-2 font-semibold">{formatOrderStatus(myOrder.status)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{formatOrderDetail(myOrder.status)}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {safeArray(myOrder.items).map((item) => `${item.name} x${item.quantity}`).join(" · ")} · {formatWeiFriendly(myOrder.amountWei)}
                        </p>
                        {myOrder.status === "merchant_completed" ? (
                          <Button className="mt-4" disabled={actionPending} onClick={() => handleConfirmReceived(myOrder.id)}>
                            確認已完成取餐
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {safeArray(proposal.orders).length ? (
                      <div className="meal-soft-panel px-4 py-4">
                        <p className="meal-kicker">群組訂單</p>
                        <div className="mt-3 space-y-2 text-sm">
                          {safeArray(proposal.orders).map((order) => (
                            <div key={order.id} className="flex items-center justify-between gap-4">
                              <span>{order.memberName}</span>
                              <span className="text-muted-foreground">
                                {formatOrderStatus(order.status)} · {formatWeiFriendly(order.amountWei)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </ProposalCard>
              );
            })}
          </div>
        </Section>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="text-sm text-primary">{message}</p> : null}
      </div>
    </div>
  );
}

function Section(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="meal-kicker">{props.title}</p>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{props.description}</p>
      </div>
      {props.children}
    </section>
  );
}

function ProposalCard(props: { proposal: Proposal; children: React.ReactNode }) {
  return (
    <article className="meal-panel p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            群組 {props.proposal.groupId}
          </p>
          <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold">{props.proposal.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            提名截止 {formatDateTime(props.proposal.proposalDeadline)} / 投票截止 {formatDateTime(props.proposal.voteDeadline)} / 點餐截止{" "}
            {formatDateTime(props.proposal.orderDeadline)}
          </p>
        </div>
        <span className="rounded-full border border-[rgba(220,193,177,0.42)] bg-[rgba(251,242,237,0.7)] px-4 py-2 text-sm font-semibold text-muted-foreground">
          {props.proposal.status}
        </span>
      </div>
      <div className="mt-5">{props.children}</div>
    </article>
  );
}

function OptionList({ options, showVoteWeight = true }: { options: ProposalOption[]; showVoteWeight?: boolean }) {
  if (!safeArray(options).length) {
    return <Empty text="目前還沒有候選店家。" compact />;
  }
  return (
    <div className="grid gap-3">
      {safeArray(options).map((option) => (
        <div key={option.id} className="meal-soft-panel px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{option.merchantName}</p>
              <p className="text-sm text-muted-foreground">{option.merchantId}</p>
            </div>
            {showVoteWeight ? <span className="text-sm text-muted-foreground">{option.weightedVotes} 票</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{props.label}</span>
      {props.children}
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

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-border/70 bg-background/60 text-sm text-muted-foreground ${compact ? "p-4" : "p-5"}`}>
      {text}
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-bold tracking-[0.08em] transition ${
        props.active
          ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,255,255,0.85)] text-primary shadow-[0_10px_24px_rgba(148,74,0,0.08)]"
          : "border-[rgba(220,193,177,0.46)] bg-[rgba(251,242,237,0.72)] text-muted-foreground hover:border-[rgba(148,74,0,0.24)] hover:text-primary"
      }`}
    >
      {props.children}
    </button>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return date.toLocaleString("zh-TW");
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

function formatMenuItemSubtotal(priceWei: string | number | bigint, quantity: number) {
  return formatWeiFriendly(BigInt(priceWei) * BigInt(quantity));
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

function formatOrderDetail(status: string) {
  switch (status) {
    case "payment_received":
    case "paid_local":
    case "paid_onchain":
      return "款項已進入平台中心錢包，等待店家接單。";
    case "merchant_accepted":
      return "店家已接單，正在準備你的餐點。";
    case "merchant_completed":
      return "店家已標記餐點完成，請確認是否已取餐。";
    case "ready_for_payout":
      return "你已確認完成，平台正在安排把款項撥給店家。";
    case "platform_paid":
      return "平台已完成撥款，這筆訂單已結案。";
    default:
      return "";
  }
}

function safeArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

type MerchantPickerProps = {
  label: string;
  merchants: Merchant[];
  selectedMerchantId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (merchantId: string) => void;
  helperText: string;
};

function MerchantPicker(props: MerchantPickerProps) {
  const { label, merchants, selectedMerchantId, query, onQueryChange, onSelect, helperText } = props;
  const filteredMerchants = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return merchants.slice(0, 6);
    }
    return merchants
      .filter((merchant) => merchant.id.toLowerCase().includes(keyword) || merchant.name.toLowerCase().includes(keyword))
      .slice(0, 6);
  }, [merchants, query]);

  const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId);

  function handleChange(nextQuery: string) {
    onQueryChange(nextQuery);
    const resolved = resolveMerchantId("", nextQuery, merchants);
    onSelect(resolved || "");
  }

  function handlePick(merchant: Merchant) {
    onQueryChange(formatMerchantOption(merchant));
    onSelect(merchant.id);
  }

  return (
      <Field label={label}>
        <div className="space-y-3">
        <div className="grid gap-2 text-sm">
          <span className="font-semibold text-foreground">{label.includes("選填") ? "搜尋關鍵字 (選填)" : "搜尋關鍵字 (必填)"}</span>
          <input
            className="w-full rounded-[1.2rem] border border-[rgba(220,193,177,0.42)] bg-[rgba(255,255,255,0.72)] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={query}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="搜尋店名或 merchant id"
          />
        </div>
        {filteredMerchants.length ? (
          <div className="rounded-[1.2rem] border border-[rgba(220,193,177,0.36)] bg-[rgba(255,255,255,0.68)] p-2 backdrop-blur">
            <div className="grid gap-2">
              {filteredMerchants.map((merchant) => (
                <button
                  key={merchant.id}
                  type="button"
                  onClick={() => handlePick(merchant)}
                  className={`w-full rounded-[1rem] px-3 py-3 text-left transition ${
                    selectedMerchantId === merchant.id
                      ? "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(148,74,0,0.14)]"
                      : "bg-transparent text-foreground hover:bg-secondary"
                  }`}
                >
                  <p className="font-semibold">{merchant.name}</p>
                  <p className={`text-xs ${selectedMerchantId === merchant.id ? "text-background/80" : "text-muted-foreground"}`}>
                    {merchant.id}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {selectedMerchant ? `目前選擇：${formatMerchantOption(selectedMerchant)}` : helperText}
        </p>
      </div>
    </Field>
  );
}

function resolveMerchantId(selectedMerchantId: string, query: string, merchants: Merchant[]) {
  if (selectedMerchantId.trim() && merchants.some((merchant) => merchant.id === selectedMerchantId.trim())) {
    return selectedMerchantId.trim();
  }
  const keyword = query.trim().toLowerCase();
  if (!keyword) return "";
  const exactId = merchants.find((merchant) => merchant.id.toLowerCase() === keyword);
  if (exactId) return exactId.id;
  const exactName = merchants.find((merchant) => merchant.name.trim().toLowerCase() === keyword);
  if (exactName) return exactName.id;
  return "";
}

function formatMerchantOption(merchant: Merchant) {
  return `${merchant.name} (${merchant.id})`;
}

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    items: safeArray(order.items)
  };
}

function normalizeProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    options: safeArray(proposal.options),
    orders: safeArray(proposal.orders).map(normalizeOrder)
  };
}

function nextProposalTransitionAt(proposals: Proposal[]) {
  const now = Date.now();
  let nextAt: number | null = null;

  for (const proposal of proposals) {
    const candidateTimes: Array<string | Date | undefined> = [];
    if (proposal.status === "proposing") {
      candidateTimes.push(proposal.proposalDeadline);
    } else if (proposal.status === "voting") {
      candidateTimes.push(proposal.voteDeadline);
    } else if (proposal.status === "ordering") {
      candidateTimes.push(proposal.orderDeadline);
    }

    for (const candidate of candidateTimes) {
      const value = candidate instanceof Date ? candidate.getTime() : new Date(candidate ?? "").getTime();
      if (!Number.isFinite(value) || value <= now) continue;
      if (nextAt === null || value < nextAt) {
        nextAt = value;
      }
    }
  }

  return nextAt;
}

function durationOptions(options: number[] | undefined, fallback: number) {
  const values = safeArray(options)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.trunc(item));
  const normalized = Array.from(new Set([fallback, ...values])).sort((a, b) => a - b);
  return normalized.length ? normalized : [1];
}
