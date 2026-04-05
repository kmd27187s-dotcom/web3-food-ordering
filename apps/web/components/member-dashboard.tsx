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
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">找不到會員 session，請重新登入。</div>;
  }

  return (
    <div className="space-y-6">
      <section className="meal-panel grid gap-6 p-8 md:grid-cols-[1fr_0.9fr]">
        <div className="space-y-5">
          <div className="meal-section-heading max-w-none">
            <p className="meal-kicker">Account</p>
            <h1>{state.member.displayName}</h1>
            <p className="break-all">{state.member.walletAddress || "尚未綁定錢包地址"}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Stat label="積分" value={`${state.member.points} pts`} />
            <Stat label="Token" value={`${state.member.tokenBalance}`} />
            <Stat label="提案券" value={`${state.member.proposalTicketCount} 張`} />
            <Stat label="待領取" value={`${state.member.claimableProposalTickets} 張`} />
          </div>
          <div className="flex flex-wrap gap-3">
            {state.member.claimableProposalTickets > 0 ? (
              <Button onClick={handleClaimTickets} disabled={actionPending}>
                領取提案券
              </Button>
            ) : null}
            <Button
              variant={state.member.subscriptionActive ? "secondary" : "default"}
              onClick={handleSubscribe}
              disabled={actionPending}
              className={!state.member.subscriptionActive ? "min-w-[16rem]" : undefined}
            >
              {state.member.subscriptionActive ? "續訂 99 Token / 30 天" : "支付 99 Token 開通訂閱"}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/records">查看使用紀錄</Link>
            </Button>
          </div>
        </div>

        <div className="meal-glass-card rounded-[1.75rem] p-6">
          <p className="meal-kicker">Subscription status</p>
          <div className="mt-5 space-y-4">
            <Stat label="狀態" value={state.member.subscriptionActive ? "有效" : "未開通"} />
            <Stat
              label="到期時間"
              value={state.member.subscriptionExpiresAt ? new Date(state.member.subscriptionExpiresAt).toLocaleString("zh-TW") : "尚未開通"}
            />
            <Stat label="註冊邀請碼" value={state.member.registrationInviteCode || "—"} />
          </div>
        </div>
      </section>

      {state.member.subscriptionActive ? (
        <>
          <section className="grid gap-6 md:grid-cols-2">
            <Panel title="建立新群組" description={`目前 ${state.member.tokenBalance} token`}>
              <div className="space-y-3">
                <input
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="例：信義午餐群"
                />
                <Button onClick={handleCreateGroup} disabled={actionPending || !createName.trim()}>
                  建立群組
                </Button>
              </div>
            </Panel>

            <Panel title="加入群組" description="輸入邀請碼">
              <div className="space-y-3">
                <input
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="例：group-1"
                />
                <Button onClick={handleJoinGroup} disabled={actionPending || !inviteCode.trim()}>
                  加入群組
                </Button>
              </div>
            </Panel>
          </section>

          <Panel title="目前群組" description="群組、成員、切換">
            {state.activeGroup ? (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="meal-soft-panel p-5">
                    <p className="meal-kicker">Active group</p>
                    <h2 className="mt-3 font-[var(--font-heading)] text-2xl font-bold tracking-[-0.03em]">{state.activeGroup.name}</h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">固定邀請碼：{state.activeGroup.inviteCode || "—"}</p>
                    <div className="mt-5">
                      {canLeaveActiveGroup ? (
                        <Button variant="ghost" onClick={handleLeaveGroup} disabled={actionPending}>
                          退出群組
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">群組建立者尚有其他成員時不能退出</span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5">
                    <div className="meal-soft-panel p-5">
                      <p className="meal-kicker">Switch group</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {state.groups.filter((group) => group.id !== state.activeGroup?.id).length === 0 ? (
                          <p className="text-sm text-muted-foreground">目前沒有其他可切換的群組。</p>
                        ) : (
                          state.groups
                            .filter((group) => group.id !== state.activeGroup?.id)
                            .map((group) => (
                              <Button key={group.id} variant="secondary" onClick={() => handleSwitchGroup(group.id)} disabled={actionPending}>
                                {group.name}
                              </Button>
                            ))
                        )}
                      </div>
                    </div>

                    <div className="meal-soft-panel p-5">
                      <p className="meal-kicker">Members</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {(state.activeGroup.members || []).map((member) => (
                          <div key={member.memberId} className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-medium text-foreground/85">
                            {member.displayName}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">目前尚未加入任何群組。</p>
            )}
          </Panel>

          {state.member.isAdmin ? (
            <Panel title="管理員：店家 / 菜單管理" description="新增、更新、匯入">
              <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-3">
                  <p className="meal-kicker">新增店家</p>
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.id} onChange={(event) => setMerchantDraft((current) => ({ ...current, id: event.target.value }))} placeholder="merchant id" />
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.name} onChange={(event) => setMerchantDraft((current) => ({ ...current, name: event.target.value }))} placeholder="店家名稱" />
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.group} onChange={(event) => setMerchantDraft((current) => ({ ...current, group: event.target.value }))} placeholder="merchant group" />
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={merchantDraft.payoutAddress} onChange={(event) => setMerchantDraft((current) => ({ ...current, payoutAddress: event.target.value }))} placeholder="收款錢包地址" />
                  <Button onClick={handleAdminMerchantSave} disabled={actionPending || !merchantDraft.id.trim() || !merchantDraft.name.trim() || !merchantDraft.group.trim() || !merchantDraft.payoutAddress.trim()}>
                    儲存店家
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="meal-kicker">新增菜單品項</p>
                  <input
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={menuDraft.merchantId}
                    onChange={(event) => setMenuDraft((current) => ({ ...current, merchantId: event.target.value }))}
                    placeholder="merchant id"
                  />
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.id} onChange={(event) => setMenuDraft((current) => ({ ...current, id: event.target.value }))} placeholder="item id" />
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.name} onChange={(event) => setMenuDraft((current) => ({ ...current, name: event.target.value }))} placeholder="品項名稱" />
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.priceWei} onChange={(event) => setMenuDraft((current) => ({ ...current, priceWei: event.target.value }))} placeholder="price_wei" />
                  <input className="w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={menuDraft.description} onChange={(event) => setMenuDraft((current) => ({ ...current, description: event.target.value }))} placeholder="描述" />
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
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                      onChange={(event) => void handleCsvFileSelected(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <textarea
                    className="min-h-[15rem] w-full rounded-2xl border border-border bg-background px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            </Panel>
          ) : null}
        </>
      ) : (
        <section className="overflow-hidden rounded-[1.75rem] border border-[rgba(194,119,60,0.22)] bg-[linear-gradient(135deg,rgba(255,250,244,0.96),rgba(245,235,224,0.92))] p-8 shadow-float">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="meal-kicker">Activation</p>
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

            <div className="rounded-[1.5rem] border border-white/50 bg-white/70 p-6 backdrop-blur">
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
    <section className="meal-panel p-6 shadow-sm">
      <p className="meal-kicker">{props.title}</p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{props.description}</p>
      <div className="mt-6">{props.children}</div>
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

function AccessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/55 bg-white/72 px-4 py-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
