"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  addProposalOption,
  createProposal,
  fetchContractInfo,
  fetchGroup,
  fetchGroups,
  fetchMe,
  fetchMerchants,
  fetchMerchant,
  fetchProposals,
  quoteVote,
  registerPendingTransaction,
  signOrder,
  type ContractInfo,
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
};

type GovernanceTab = "proposing" | "voting" | "ordering";

const stageDurationOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const APPROX_TWD_PER_ETH = 120000;
const tabMeta: Record<GovernanceTab, { title: string; body: string }> = {
  proposing: {
    title: "建立提案",
    body: "設定 round。"
  },
  voting: {
    title: "進行投票",
    body: "估算後送出。"
  },
  ordering: {
    title: "完成點餐",
    body: "確認總額後付款。"
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
  proposalMinutes: "20",
  voteMinutes: "20",
  orderMinutes: "30",
  merchantId: ""
};

export function GovernanceBoard() {
  const [state, setState] = useState<GovernanceState>({ member: null, groups: [], proposals: [], contractInfo: null });
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<GovernanceTab>("proposing");
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
    const [member, groups, proposals, contractInfo, merchantList] = await Promise.all([
      fetchMe(),
      fetchGroups(),
      fetchProposals(),
      fetchContractInfo().catch(() => null),
      fetchMerchants().catch(() => [])
    ]);
    const enrichedGroups = await Promise.all(groups.map((group) => fetchGroup(group.id)));
    setState({
      member,
      groups: enrichedGroups,
      proposals: safeArray(proposals).map(normalizeProposal),
      contractInfo
    });
    setMerchants(Array.isArray(merchantList) ? merchantList : []);
    setCreateDraft((current) => ({
      ...current,
      groupId: current.groupId || (enrichedGroups[0] ? String(enrichedGroups[0].id) : "")
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

  const grouped = useMemo(
    () => ({
      proposing: state.proposals.filter((proposal) => proposal.status === "proposing"),
      voting: state.proposals.filter((proposal) => proposal.status === "voting"),
      ordering: state.proposals.filter((proposal) => ["ordering", "awaiting_settlement", "settled"].includes(proposal.status))
    }),
    [state.proposals]
  );

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

  async function handleVote(proposalId: number, optionId: number) {
    const tokenAmount = Number(voteTokens[proposalId] || "0");
    setActionPending(true);
    setMessage("");
    try {
      await voteProposal(proposalId, optionId, tokenAmount);
      await refresh();
      setMessage(`已送出投票，票重 ${tokenAmount}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "投票失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleVoteQuote(proposalId: number) {
    const tokenAmount = Number(voteTokens[proposalId] || "0");
    try {
      const quote = await quoteVote(proposalId, tokenAmount);
      setVoteQuotes((current) => ({ ...current, [proposalId]: `${quote.voteWeight} 票重` }));
    } catch (error) {
      setVoteQuotes((current) => ({ ...current, [proposalId]: error instanceof Error ? error.message : "無法估算票重" }));
    }
  }

  async function handleOrder(proposal: Proposal) {
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

      if (!canUseChainOrder || !result.signature || !proposal.chainProposalId) {
        setMessage("這一輪尚未配置鏈上支付，暫時無法喚起 MetaMask 扣款。");
        return;
      }

      if (result.signature && proposal.chainProposalId) {
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
        await refresh();
        setMessage(`已喚起 MetaMask 支付 ${formatWeiFriendly(result.quote.subtotalWei)}，交易送出：${txHash.slice(0, 10)}...`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "點餐失敗");
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
            <p className="meal-kicker">Governance</p>
            <h1>治理工作台</h1>
            <p>提案、投票、點餐。</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="我的 Token" value={`${state.member?.tokenBalance || 0}`} />
            <Stat label="我的提案券" value={`${state.member?.proposalTicketCount || 0} 張`} />
            <Stat label="目前群組" value={`${state.groups.length} 個`} />
            <Stat label="鏈上模式" value={isUsableContractAddress(state.contractInfo?.orderContract) ? "Sepolia 已配置" : "本地 fallback"} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
        <div className="meal-section-heading max-w-none">
          <p className="meal-kicker">Current stage</p>
          <h2>{tabMeta[activeTab].title}</h2>
          <p>{tabMeta[activeTab].body}</p>
        </div>
        <div className="meal-glass-card rounded-[1.6rem] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <TabButton active={activeTab === "proposing"} onClick={() => setActiveTab("proposing")}>
              提案
            </TabButton>
            <TabButton active={activeTab === "voting"} onClick={() => setActiveTab("voting")}>
              投票
            </TabButton>
            <TabButton active={activeTab === "ordering"} onClick={() => setActiveTab("ordering")}>
              點餐
            </TabButton>
          </div>
        </div>
      </section>

      {activeTab === "proposing" ? (
        <>
          <section className="meal-panel p-6 shadow-sm">
            <p className="meal-kicker">Create round</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="群組">
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
              <Field label="提案標題">
                <input
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.title}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="例：信義辦公室午餐票選"
                />
              </Field>
              <Field label="候選名額">
                <input
                  type="number"
                  min={3}
                  max={10}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.maxOptions}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, maxOptions: event.target.value }))}
                />
              </Field>
              <Field label="提名時間（分鐘）">
                <select
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.proposalMinutes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, proposalMinutes: event.target.value }))}
                >
                  {stageDurationOptions.map((minutes) => (
                    <option key={`proposal-${minutes}`} value={String(minutes)}>
                      {minutes} 分鐘
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="投票時間（分鐘）">
                <select
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.voteMinutes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, voteMinutes: event.target.value }))}
                >
                  {stageDurationOptions.map((minutes) => (
                    <option key={`vote-${minutes}`} value={String(minutes)}>
                      {minutes} 分鐘
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="點餐時間（分鐘）">
                <select
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createDraft.orderMinutes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, orderMinutes: event.target.value }))}
                >
                  {stageDurationOptions.map((minutes) => (
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
                {actionPending ? "處理中..." : "建立本輪提案"}
              </Button>
              <p className="text-sm text-muted-foreground">建立 round 消耗 1 token。</p>
            </div>
          </section>

          <Section title="提案期" description="建立候選清單。">
            {grouped.proposing.length === 0 ? <Empty text="目前沒有進行中的提案期 round。" /> : null}
            <div className="grid gap-5 xl:grid-cols-2">
              {grouped.proposing.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal}>
                  <div className="space-y-4">
                    <OptionList options={proposal.options} />
                    <div className="space-y-3">
                      <MerchantPicker
                        label="提名店家"
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
        <Section title="投票期" description="輸入 token 權重後送出。">
          {grouped.voting.length === 0 ? <Empty text="目前沒有進行中的投票期 round。" /> : null}
          <div className="grid gap-5 xl:grid-cols-2">
            {grouped.voting.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal}>
                <div className="space-y-4">
                      <div className="meal-soft-panel px-4 py-4 text-sm text-muted-foreground">
                    目前總票重 {safeArray(proposal.options).reduce((sum, option) => sum + option.weightedVotes, 0)}。
                    {proposal.currentVoteOptionId
                      ? ` 你目前已投入 ${proposal.currentVoteTokenAmount} Token，個人票重 ${proposal.currentVoteWeight}。`
                      : " 你目前還沒有投票。"}
                  </div>
                  <Field label="這輪投票的 token 權重">
                    <div className="flex gap-3">
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={voteTokens[proposal.id] || "0"}
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
                            <p className="text-sm text-muted-foreground">目前 {option.weightedVotes} 票重</p>
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
        <Section title="點餐期 / 結算期" description="選餐、確認總額，再把付款交給 MetaMask。">
          {grouped.ordering.length === 0 ? <Empty text="目前沒有可點餐或已結算的 round。" /> : null}
          <div className="grid gap-5 xl:grid-cols-2">
            {grouped.ordering.map((proposal) => {
              const winner = safeArray(proposal.options).find((option) => option.id === proposal.winnerOptionId);
              const merchant = winner ? menus[winner.merchantId] : undefined;
              const myOrder = safeArray(proposal.orders).find((order) => order.memberId === state.member?.id);
              const selectedItems = merchant?.menu
                ? merchant.menu.filter((item) => (orderItems[proposal.id]?.[item.id] || 0) > 0)
                : [];
              const selectedSubtotalWei = selectedItems.reduce((total, item) => {
                const quantity = orderItems[proposal.id]?.[item.id] || 0;
                return total + BigInt(item.priceWei) * BigInt(quantity);
              }, BigInt(0));
              const canSubmitOrder = proposal.status === "ordering" && selectedItems.length > 0;
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
                      <div className="space-y-3">
                        {merchant.menu.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[rgba(220,193,177,0.36)] bg-[rgba(255,255,255,0.68)] px-4 py-4 backdrop-blur">
                            <div>
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-sm text-muted-foreground">{formatWeiFriendly(item.priceWei)}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="min-w-[9rem] text-right">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">項目總額</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">
                                  {formatWeiFriendly(BigInt(item.priceWei) * BigInt(orderItems[proposal.id]?.[item.id] || 0))}
                                </p>
                              </div>
                              <input
                                type="number"
                                min={0}
                                aria-label={`${item.name} 數量`}
                                className="w-24 rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={String(orderItems[proposal.id]?.[item.id] || 0)}
                                onChange={(event) => setOrderQuantity(proposal.id, item.id, Number(event.target.value))}
                              />
                            </div>
                          </div>
                        ))}
                        <div className="rounded-[1.35rem] border border-[rgba(194,119,60,0.28)] bg-[rgba(194,119,60,0.08)] px-4 py-4">
                          <p className="meal-kicker">Order summary</p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">已選 {selectedItems.length} 項餐點，送出前會先檢查餘額。</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">{formatWeiFriendly(selectedSubtotalWei)}</p>
                            </div>
                            <Button onClick={() => handleOrder(proposal)} disabled={actionPending || !canSubmitOrder}>
                              送出點餐並前往錢包支付
                            </Button>
                          </div>
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
                        <p className="mt-2 font-semibold">{myOrder.status}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {safeArray(myOrder.items).map((item) => `${item.name} x${item.quantity}`).join(" · ")} · {formatWeiFriendly(myOrder.amountWei)}
                        </p>
                      </div>
                    ) : null}
                    {safeArray(proposal.orders).length ? (
                      <div className="meal-soft-panel px-4 py-4">
                        <p className="meal-kicker">群組訂單</p>
                        <div className="mt-3 space-y-2 text-sm">
                          {safeArray(proposal.orders).map((order) => (
                            <div key={order.id} className="flex items-center justify-between gap-4">
                              <span>{order.memberName}</span>
                              <span className="text-muted-foreground">{formatWeiFriendly(order.amountWei)}</span>
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
            {props.proposal.mealPeriod} · 群組 {props.proposal.groupId}
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

function OptionList({ options }: { options: ProposalOption[] }) {
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
            <span className="text-sm text-muted-foreground">{option.weightedVotes} 票重</span>
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
        <input
          className="w-full rounded-[1.2rem] border border-[rgba(220,193,177,0.42)] bg-[rgba(255,255,255,0.72)] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="搜尋店名或 merchant id"
        />
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
