"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  adminImportMerchantCsv,
  adminUpsertMenuItem,
  adminUpsertMerchant,
  claimTickets,
  createGroup,
  fetchMerchants,
  fetchGroup,
  fetchGroups,
  fetchMe,
  joinGroup,
  leaveGroup,
  paySubscription,
  type Group,
  type Merchant,
  type Member
} from "@/lib/api";

type DashboardState = {
  member: Member | null;
  groups: Group[];
  activeGroup: Group | null;
  merchants: Merchant[];
};

export function MemberDashboard({ openSubscribe = false }: { openSubscribe?: boolean }) {
  const [state, setState] = useState<DashboardState>({ member: null, groups: [], activeGroup: null, merchants: [] });
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [message, setMessage] = useState(openSubscribe ? "請先開通月訂閱。" : "");
  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [merchantDraft, setMerchantDraft] = useState({ id: "", name: "", group: "", payoutAddress: "" });
  const [menuDraft, setMenuDraft] = useState({ merchantId: "", id: "", name: "", priceWei: "", description: "" });
  const [csvText, setCsvText] = useState("");

  async function refresh(preferredGroupId?: number) {
    const member = await fetchMe();
    if (!member.subscriptionActive) {
      setState({ member, groups: [], activeGroup: null, merchants: [] });
      return;
    }
    const [groups, merchants] = await Promise.all([fetchGroups(), member.isAdmin ? fetchMerchants() : Promise.resolve([])]);
    const activeGroupMeta = groups.find((group) => group.id === preferredGroupId) || groups[0] || null;
    const activeGroup = activeGroupMeta ? await fetchGroup(activeGroupMeta.id) : null;
    setState({ member, groups, activeGroup, merchants });
    setMenuDraft((current) => ({
      ...current,
      merchantId: current.merchantId || (merchants[0]?.id ?? "")
    }));
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "目前無法讀取會員資料"))
      .finally(() => setLoading(false));
  }, []);

  const canLeaveActiveGroup = useMemo(() => {
    if (!state.member || !state.activeGroup) return false;
    if (state.activeGroup.ownerMemberId !== state.member.id) return true;
    return Number(state.activeGroup.members?.length || 0) <= 1;
  }, [state.activeGroup, state.member]);

  async function handleClaimTickets() {
    setActionPending(true);
    try {
      const result = await claimTickets();
      setState((current) => ({ ...current, member: result.member }));
      setMessage(`已領取提案券 ${result.claimedProposalTickets} 張`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "領取失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleSubscribe() {
    setActionPending(true);
    try {
      await paySubscription();
      await refresh(state.activeGroup?.id);
      setMessage("月訂閱已開通，期限已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "訂閱失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleCreateGroup() {
    if (!createName.trim()) return;
    setActionPending(true);
    try {
      const group = await createGroup(createName.trim());
      setCreateName("");
      await refresh(group.id);
      setMessage(`已建立群組「${group.name}」`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立群組失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleJoinGroup() {
    if (!inviteCode.trim()) return;
    setActionPending(true);
    try {
      const group = await joinGroup(inviteCode.trim());
      setInviteCode("");
      await refresh(group.id);
      setMessage(`已加入群組「${group.name}」`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入群組失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleSwitchGroup(groupId: number) {
    setActionPending(true);
    try {
      await refresh(groupId);
      setMessage("已切換群組");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "切換群組失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleLeaveGroup() {
    if (!state.activeGroup) return;
    setActionPending(true);
    try {
      await leaveGroup(state.activeGroup.id);
      await refresh();
      setMessage("已退出群組");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "退出群組失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAdminMerchantSave() {
    setActionPending(true);
    try {
      const merchant = await adminUpsertMerchant({
        id: merchantDraft.id.trim(),
        name: merchantDraft.name.trim(),
        group: merchantDraft.group.trim(),
        payoutAddress: merchantDraft.payoutAddress.trim()
      });
      setMerchantDraft({ id: "", name: "", group: "", payoutAddress: "" });
      setMenuDraft((current) => ({ ...current, merchantId: merchant.id }));
      await refresh(state.activeGroup?.id);
      setMessage(`已儲存店家「${merchant.name}」`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存店家失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAdminMenuSave() {
    setActionPending(true);
    try {
      const merchant = await adminUpsertMenuItem(menuDraft.merchantId, {
        id: menuDraft.id.trim(),
        name: menuDraft.name.trim(),
        priceWei: Number(menuDraft.priceWei),
        description: menuDraft.description.trim()
      });
      setMenuDraft((current) => ({ ...current, id: "", name: "", priceWei: "", description: "", merchantId: merchant.id }));
      await refresh(state.activeGroup?.id);
      setMessage(`已更新「${merchant.name}」菜單`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存菜單失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAdminCsvImport() {
    setActionPending(true);
    try {
      const result = await adminImportMerchantCsv(csvText);
      setCsvText("");
      await refresh(state.activeGroup?.id);
      setMessage(`匯入完成：${result.merchantCount} 間店家 / ${result.menuItemCount} 個品項`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV 匯入失敗");
    } finally {
      setActionPending(false);
    }
  }

  async function handleCsvFileSelected(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="meal-panel grid gap-6 p-8 md:grid-cols-[1fr_0.9fr]">
          <div className="space-y-5">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-48 animate-pulse rounded bg-muted" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-border/70 bg-background/70" />
              ))}
            </div>
          </div>
          <div className="h-64 animate-pulse rounded-[1.5rem] border border-border/70 bg-background/70" />
        </div>
      </div>
    );
  }

  if (!state.member) {
    return <div className="rounded-[1.5rem] border border-orange-100 bg-white p-8">請重新登入。</div>;
  }

  return (
    <div className="space-y-8">
      {state.member.subscriptionActive ? (
        <>
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-5">
              <section className="relative overflow-hidden rounded-3xl border border-stone-100 bg-white p-8 shadow-xl">
                <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary/5" />
                <div className="relative flex items-start gap-6">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-orange-100 text-4xl font-bold text-primary shadow-inner">
                    {displayInitial(state.member.displayName)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h1 className="text-3xl font-bold text-stone-900">{state.member.displayName}</h1>
                    <div className="flex items-center gap-2 text-stone-500">
                      <span className="rounded bg-stone-50 px-2 py-0.5 font-mono text-sm">
                        {shortAddress(state.member.walletAddress || "")}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-bold text-primary">
                      {state.member.subscriptionActive ? "月訂閱有效" : "待開通"}
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-4">
                  <Stat label="積分" value={`${state.member.points} pts`} />
                  <Stat label="Token" value={`${state.member.tokenBalance}`} />
                  <Stat label="提案券" value={`${state.member.proposalTicketCount} 張`} />
                  <Stat label="待領取" value={`${state.member.claimableProposalTickets} 張`} />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {state.member.claimableProposalTickets > 0 ? (
                    <Button onClick={handleClaimTickets} disabled={actionPending}>
                      領取提案券
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={handleSubscribe} disabled={actionPending}>
                    續訂 99 Token / 30 天
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/records">查看使用紀錄</Link>
                  </Button>
                </div>
              </section>

              <section className="rounded-3xl border border-stone-100 bg-white p-8 shadow-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="meal-kicker">Subscription</p>
                    <h2 className="mt-2 text-2xl font-bold text-stone-900">帳戶狀態</h2>
                  </div>
                  <div className="rounded-xl bg-primary/5 px-3 py-2 text-sm font-bold text-primary">
                    {state.member.subscriptionActive ? "Verified" : "Pending"}
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <DetailRow label="到期時間" value={state.member.subscriptionExpiresAt ? new Date(state.member.subscriptionExpiresAt).toLocaleString("zh-TW") : "尚未開通"} />
                  <DetailRow label="註冊邀請碼" value={state.member.registrationInviteCode || "—"} />
                </div>
              </section>
            </div>

            <div className="space-y-8 lg:col-span-7">
              <section className="overflow-hidden rounded-3xl border border-stone-100 bg-white shadow-xl">
                <div className="border-b border-stone-100 bg-stone-50 p-8">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="meal-kicker">Current group</p>
                      <h2 className="mt-2 text-3xl font-bold text-stone-900">
                        {state.activeGroup?.name || "尚未加入群組"}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const target = document.getElementById("switch-groups");
                          target?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-900 transition hover:bg-stone-100"
                      >
                        切換群組
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = document.getElementById("create-group");
                          target?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-md transition hover:scale-[1.02]"
                      >
                        建立群組
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 p-8">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div id="create-group" className="space-y-3">
                      <p className="meal-kicker">建立群組</p>
                      <input
                        className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={createName}
                        onChange={(event) => setCreateName(event.target.value)}
                        placeholder="例：信義午餐群"
                      />
                      <Button onClick={handleCreateGroup} disabled={actionPending || !createName.trim()}>
                        建立群組
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <p className="meal-kicker">加入群組</p>
                      <input
                        className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={inviteCode}
                        onChange={(event) => setInviteCode(event.target.value)}
                        placeholder="邀請碼"
                      />
                      <Button onClick={handleJoinGroup} disabled={actionPending || !inviteCode.trim()}>
                        加入群組
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-6">
                    <p className="text-sm font-medium text-stone-500">群組邀請碼</p>
                    <p className="mt-2 text-2xl font-mono font-bold tracking-widest text-primary">
                      {state.activeGroup?.inviteCode || "—"}
                    </p>
                  </div>

                  <div id="switch-groups" className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-stone-900">群組成員</h3>
                      <div className="text-sm text-stone-400">
                        {state.activeGroup?.members?.length || 0} 位
                      </div>
                    </div>

                    {state.activeGroup ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(state.activeGroup.members || []).map((member) => (
                          <div
                            key={member.memberId}
                            className="flex items-center gap-4 rounded-2xl border border-transparent p-4 transition hover:border-stone-100 hover:bg-stone-50"
                          >
                            <div className="h-10 w-10 rounded-full bg-stone-200" />
                            <div className="flex-1">
                              <p className="font-bold text-stone-900">{member.displayName}</p>
                              <p className="text-xs text-stone-500">
                                {member.memberId === state.activeGroup?.ownerMemberId ? "Admin" : "Member"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-500">目前尚未加入任何群組。</p>
                    )}

                    <div className="flex flex-wrap gap-3 pt-2">
                      {state.groups
                        .filter((group) => group.id !== state.activeGroup?.id)
                        .map((group) => (
                          <Button key={group.id} variant="secondary" onClick={() => handleSwitchGroup(group.id)} disabled={actionPending}>
                            {group.name}
                          </Button>
                        ))}
                      {canLeaveActiveGroup ? (
                        <Button variant="ghost" onClick={handleLeaveGroup} disabled={actionPending}>
                          退出群組
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>

          {state.member.isAdmin ? (
            <section className="rounded-3xl border border-stone-100 bg-white p-8 shadow-xl">
              <div className="mb-8">
                <p className="meal-kicker">Admin tools</p>
                <h2 className="mt-2 text-2xl font-bold text-stone-900">店家與菜單</h2>
              </div>
              <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-3">
                  <p className="meal-kicker">新增店家</p>
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.id} onChange={(event) => setMerchantDraft((current) => ({ ...current, id: event.target.value }))} placeholder="merchant id" />
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.name} onChange={(event) => setMerchantDraft((current) => ({ ...current, name: event.target.value }))} placeholder="店家名稱" />
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.group} onChange={(event) => setMerchantDraft((current) => ({ ...current, group: event.target.value }))} placeholder="merchant group" />
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.payoutAddress} onChange={(event) => setMerchantDraft((current) => ({ ...current, payoutAddress: event.target.value }))} placeholder="收款錢包地址" />
                  <Button onClick={handleAdminMerchantSave} disabled={actionPending || !merchantDraft.id.trim() || !merchantDraft.name.trim() || !merchantDraft.group.trim() || !merchantDraft.payoutAddress.trim()}>
                    儲存店家
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="meal-kicker">新增菜單品項</p>
                  <input
                    className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={menuDraft.merchantId}
                    onChange={(event) => setMenuDraft((current) => ({ ...current, merchantId: event.target.value }))}
                    placeholder="merchant id"
                  />
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.id} onChange={(event) => setMenuDraft((current) => ({ ...current, id: event.target.value }))} placeholder="item id" />
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.name} onChange={(event) => setMenuDraft((current) => ({ ...current, name: event.target.value }))} placeholder="品項名稱" />
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.priceWei} onChange={(event) => setMenuDraft((current) => ({ ...current, priceWei: event.target.value }))} placeholder="price_wei" />
                  <input className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.description} onChange={(event) => setMenuDraft((current) => ({ ...current, description: event.target.value }))} placeholder="描述" />
                  <Button onClick={handleAdminMenuSave} disabled={actionPending || !menuDraft.merchantId || !menuDraft.id.trim() || !menuDraft.name.trim() || !menuDraft.priceWei.trim()}>
                    儲存品項
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="meal-kicker">CSV 匯入</p>
                  <label className="block text-sm text-muted-foreground">
                    <span className="mb-2 block">上傳 CSV 檔或直接貼上內容</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3"
                      onChange={(event) => void handleCsvFileSelected(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <textarea
                    className="min-h-[15rem] w-full rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={csvText}
                    onChange={(event) => setCsvText(event.target.value)}
                    placeholder={"merchant_id,merchant_name,merchant_group,payout_address,item_id,item_name,price_wei,description"}
                  />
                  <p className="text-xs text-muted-foreground">欄位順序：merchant_id, merchant_name, merchant_group, payout_address, item_id, item_name, price_wei, description</p>
                  <Button onClick={handleAdminCsvImport} disabled={actionPending || !csvText.trim()}>
                    匯入 CSV
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="overflow-hidden rounded-[1.75rem] border border-orange-100 bg-white p-8 shadow-xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="meal-kicker">訂閱</p>
                <h2 className="font-[var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] text-balance">
                  開通後才能使用完整功能。
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-foreground/78">
                  請先開通月訂閱。
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <AccessStat label="訂閱費用" value="99 Token" />
                <AccessStat label="有效期間" value="30 天" />
                <AccessStat label="目前狀態" value="待開通" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSubscribe} disabled={actionPending} className="min-w-[16rem]">
                  {actionPending ? "處理中..." : "立即開通月訂閱"}
                </Button>
                <p className="text-sm text-muted-foreground">付款後解鎖功能。</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-orange-100 bg-[#fffaf7] p-6">
              <p className="meal-kicker">開通後立即可用</p>
              <div className="mt-5 space-y-4">
                {[
                  "群組",
                  "治理",
                  "排行榜與紀錄"
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-2.5 w-2.5 rounded-full bg-foreground/75" />
                    <p className="text-sm leading-7 text-foreground/78">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="text-sm text-primary">{message}</p> : null}
      </div>
    </div>
  );
}

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-orange-100 bg-white p-6 shadow-sm">
      <p className="meal-kicker">{props.title}</p>
      <p className="mt-3 text-sm text-stone-500">{props.description}</p>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-[#fffaf7] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function AccessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/55 bg-white/72 px-4 py-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function shortAddress(address: string) {
  if (!address) return "尚未綁定錢包地址";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function displayInitial(name: string) {
  return (name || "M").slice(0, 1).toUpperCase();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-stone-900">{value}</p>
    </div>
  );
}
