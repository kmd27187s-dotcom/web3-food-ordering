"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Copy, DoorOpen, RefreshCw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createGroup,
  fetchGroupDetail,
  fetchGroups,
  fetchMe,
  joinGroup,
  leaveGroup,
  type Group,
  type GroupDetail,
  type Member
} from "@/lib/api";

const ACTIVE_GROUP_STORAGE_KEY = "mealvote.member.active-group";

export function MemberGroups() {
  const [member, setMember] = useState<Member | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    void refreshOverview().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    fetchGroupDetail(selectedGroupId)
      .then((detail) => {
        if (active) {
          setSelectedDetail(detail);
        }
      })
      .catch((error) => {
        if (active) {
          setSelectedDetail(null);
          setMessage(error instanceof Error ? error.message : "讀取群組詳細資料失敗");
        }
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedGroupId]);

  async function refreshOverview(preferredGroupId?: number | null) {
    try {
      const [me, nextGroups] = await Promise.all([fetchMe(), fetchGroups()]);
      setMember(me);
      setGroups(nextGroups);

      const storedGroupId = readStoredGroupId();
      const nextSelectedGroup =
        nextGroups.find((group) => group.id === preferredGroupId) ||
        nextGroups.find((group) => group.id === storedGroupId) ||
        nextGroups[0] ||
        null;

      updateSelectedGroup(nextSelectedGroup?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "讀取群組資料失敗");
    }
  }

  async function handleCreateGroup() {
    if (!createName.trim()) return;
    setPending(true);
    try {
      const group = await createGroup(createName.trim());
      setCreateName("");
      await refreshOverview(group.id);
      setMessage(`已建立群組「${group.name}」`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立群組失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleJoinGroup() {
    if (!inviteCode.trim()) return;
    setPending(true);
    try {
      const group = await joinGroup(inviteCode.trim());
      setInviteCode("");
      await refreshOverview(group.id);
      setMessage(`已加入群組「${group.name}」`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入群組失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleLeaveGroup() {
    if (!selectedDetail) return;
    const confirmText = `確定要退出群組「${selectedDetail.group.name}」嗎？`;
    if (!window.confirm(confirmText)) {
      return;
    }

    setPending(true);
    try {
      await leaveGroup(selectedDetail.group.id);
      const leavingGroupName = selectedDetail.group.name;
      await refreshOverview(selectedDetail.group.id);
      setMessage(`已退出群組「${leavingGroupName}」`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "退出群組失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleCopyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(`已複製邀請碼：${code}`);
    } catch {
      setMessage("複製邀請碼失敗");
    }
  }

  function updateSelectedGroup(groupId: number | null) {
    setSelectedGroupId(groupId);
    if (typeof window === "undefined") return;
    if (groupId) {
      window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, String(groupId));
      return;
    }
    window.localStorage.removeItem(ACTIVE_GROUP_STORAGE_KEY);
  }

  function sortGroups(items: Group[]) {
    return [...items].sort((left, right) => {
      switch (sortBy) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "name":
          return left.name.localeCompare(right.name, "zh-TW");
        case "members_desc":
          return (right.members?.length || 0) - (left.members?.length || 0);
        case "invite":
          return (left.inviteCode || "").localeCompare(right.inviteCode || "", "zh-TW");
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入群組清單...</div>;
  }

  const ownedGroups = groups.filter((group) => group.ownerMemberId === member?.id);
  const joinedGroups = groups.filter((group) => !ownedGroups.some((owned) => owned.id === group.id));
  const canLeaveSelectedGroup = Boolean(
    selectedDetail && (selectedDetail.group.ownerMemberId !== member?.id || selectedDetail.memberCount <= 1)
  );
  const ownerLeaveHint =
    selectedDetail && selectedDetail.group.ownerMemberId === member?.id && selectedDetail.memberCount > 1
      ? "群組擁有者若群內還有其他成員，需先移除或移交後才能退出。若你是唯一成員，退出時會同步刪除群組。"
      : "";

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="meal-kicker">Group hub</p>
            <h1 className="text-3xl font-extrabold">群組中心</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              這裡集中管理你的群組。你可以建立或加入群組、查看成員與邀請碼、切換目前正在看的群組，必要時也能直接退出。
            </p>
          </div>
          <div className="grid min-w-[240px] gap-3 sm:grid-cols-2">
            <StatCard label="參與群組" value={`${groups.length} 個`} />
            <StatCard label="建立中的群組" value={`${ownedGroups.length} 個`} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="grid gap-6">
          <section className="meal-panel p-8">
            <p className="meal-kicker">Create group</p>
            <h2 className="text-3xl font-extrabold">新增群組</h2>
            <label className="mt-6 grid gap-2 text-sm">
              <span className="font-semibold text-foreground">群組名稱</span>
              <input
                className="meal-field"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="例如：信義午餐群"
              />
            </label>
            <Button className="mt-4" onClick={handleCreateGroup} disabled={pending || !createName.trim()}>
              建立群組
            </Button>
          </section>

          <section className="meal-panel p-8">
            <p className="meal-kicker">Join group</p>
            <h2 className="text-3xl font-extrabold">加入群組</h2>
            <label className="mt-6 grid gap-2 text-sm">
              <span className="font-semibold text-foreground">群組邀請碼</span>
              <input
                className="meal-field"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="請輸入邀請碼"
              />
            </label>
            <Button className="mt-4" onClick={handleJoinGroup} disabled={pending || !inviteCode.trim()}>
              使用邀請碼加入
            </Button>
          </section>
        </section>

        <section className="meal-panel p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="meal-kicker">Switch group</p>
              <h2 className="text-3xl font-extrabold">切換群組</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                選擇目前要查看與操作的群組。切換後，下方會同步更新該群組的成員、邀請碼和管理操作。
              </p>
            </div>
            <Button variant="secondary" className="gap-2" onClick={() => void refreshOverview(selectedGroupId)} disabled={pending}>
              <RefreshCw className="h-4 w-4" />
              重新整理
            </Button>
          </div>

          {groups.length ? (
            <>
              <label className="mt-6 grid gap-2 text-sm">
                <span className="font-semibold text-foreground">目前查看的群組</span>
                <select
                  className="meal-field"
                  value={selectedGroupId ?? ""}
                  onChange={(event) => updateSelectedGroup(event.target.value ? Number(event.target.value) : null)}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                {groups.map((group) => {
                  const active = group.id === selectedGroupId;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => updateSelectedGroup(group.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,255,255,0.82)] text-primary shadow-[0_10px_24px_rgba(148,74,0,0.08)]"
                          : "border-[rgba(220,193,177,0.46)] bg-[rgba(251,242,237,0.72)] text-muted-foreground hover:border-[rgba(148,74,0,0.24)] hover:text-primary"
                      }`}
                    >
                      {group.name}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[1.2rem] border border-dashed border-border bg-background/60 p-5 text-sm text-muted-foreground">
              目前尚未加入任何群組，請先建立群組或使用邀請碼加入。
            </div>
          )}
        </section>
      </section>

      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="meal-kicker">Group list</p>
            <h2 className="text-3xl font-extrabold">參與群組清單</h2>
          </div>
          <div className="min-w-[220px]">
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-foreground">排序方式</span>
              <select className="meal-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">依建立時間新到舊</option>
                <option value="oldest">依建立時間舊到新</option>
                <option value="name">依群組名稱排序</option>
                <option value="members_desc">依會員數多到少</option>
                <option value="invite">依邀請碼排序</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-bold">我建立的群組</h3>
            {sortGroups(ownedGroups).length === 0 ? <p className="text-sm text-muted-foreground">目前沒有自己建立的群組。</p> : null}
            {sortGroups(ownedGroups).map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                active={group.id === selectedGroupId}
                onCopyInviteCode={handleCopyInviteCode}
                onSelect={() => updateSelectedGroup(group.id)}
              />
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-bold">我參與的群組</h3>
            {sortGroups(joinedGroups).length === 0 ? <p className="text-sm text-muted-foreground">目前沒有參與其他人的群組。</p> : null}
            {sortGroups(joinedGroups).map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                active={group.id === selectedGroupId}
                onCopyInviteCode={handleCopyInviteCode}
                onSelect={() => updateSelectedGroup(group.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="meal-panel p-8">
        {detailLoading ? (
          <div className="rounded-[1.2rem] border border-border bg-background/70 p-6 text-sm text-muted-foreground">正在讀取目前群組詳細資料...</div>
        ) : !selectedDetail ? (
          <div className="rounded-[1.2rem] border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
            尚未選擇群組，或目前沒有可查看的群組。
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="meal-kicker">Current group</p>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-extrabold">{selectedDetail.group.name}</h2>
                  <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {selectedDetail.canManage ? "你是群組建立者" : "你是群組成員"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {selectedDetail.group.description || "尚未填寫群組說明"}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" className="gap-2" onClick={() => updateSelectedGroup(selectedDetail.group.id)}>
                  <ArrowRightLeft className="h-4 w-4" />
                  目前群組
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={handleLeaveGroup}
                  disabled={pending || !canLeaveSelectedGroup}
                  title={canLeaveSelectedGroup ? "退出群組" : ownerLeaveHint}
                >
                  <DoorOpen className="h-4 w-4" />
                  退出群組
                </Button>
              </div>
            </div>

            {!canLeaveSelectedGroup && ownerLeaveHint ? <p className="text-sm text-muted-foreground">{ownerLeaveHint}</p> : null}

            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="群組成員" value={`${selectedDetail.memberCount} 人`} />
              <StatCard label="建立時間" value={new Date(selectedDetail.group.createdAt).toLocaleString("zh-TW")} />
              <StatCard label="邀請碼" value={selectedDetail.group.inviteCode || "尚未建立"} />
              <StatCard label="邀請碼使用" value={`${selectedDetail.inviteUsages?.length || 0} 次`} />
            </div>

            <div className="flex flex-wrap gap-3">
              {selectedDetail.group.inviteCode ? (
                <Button variant="secondary" className="gap-2" onClick={() => void handleCopyInviteCode(selectedDetail.group.inviteCode || "")}>
                  <Copy className="h-4 w-4" />
                  複製邀請碼
                </Button>
              ) : null}
              <Button asChild variant="secondary">
                <Link href={`/member/groups/${selectedDetail.group.id}`}>群組詳細資訊</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/member/groups/${selectedDetail.group.id}/members`}>查看群組成員</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/member/groups/${selectedDetail.group.id}/invite-usage`}>查看邀請碼紀錄</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/member/groups/${selectedDetail.group.id}/orders`}>查看歷史訂單</Link>
              </Button>
            </div>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold">群組成員</h3>
                </div>
                {selectedDetail.members.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-border bg-background/60 p-5 text-sm text-muted-foreground">
                    這個群組目前沒有成員資料。
                  </div>
                ) : (
                  selectedDetail.members.map((groupMember) => (
                    <div key={groupMember.memberId} className="rounded-[1.2rem] border border-border bg-background/70 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{groupMember.displayName}</p>
                          <p className="mt-2 break-all text-sm text-muted-foreground">
                            錢包地址：{groupMember.walletAddress || "尚未綁定"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            加入時間：{new Date(groupMember.joinedAt).toLocaleString("zh-TW")}
                          </p>
                        </div>
                        <div className="grid min-w-[180px] gap-3 sm:grid-cols-2">
                          <MiniStat label="積分" value={`${groupMember.points}`} />
                          <MiniStat label="Token" value={`${groupMember.tokenBalance}`} />
                          <MiniStat label="提案" value={`${groupMember.proposalsCreated} 次`} />
                          <MiniStat label="投票" value={`${groupMember.votesCast} 次`} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">最近邀請碼使用紀錄</h3>
                {selectedDetail.inviteUsages?.length ? (
                  selectedDetail.inviteUsages.slice(0, 5).map((usage) => (
                    <div key={usage.id} className="rounded-[1.2rem] border border-border bg-background/70 p-5">
                      <p className="font-semibold">{usage.usedByName}</p>
                      <p className="mt-2 text-sm text-muted-foreground">使用邀請碼：{usage.inviteCode}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        使用時間：{new Date(usage.usedAt).toLocaleString("zh-TW")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.2rem] border border-dashed border-border bg-background/60 p-5 text-sm text-muted-foreground">
                    目前尚無邀請碼使用紀錄。
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

function GroupRow({
  group,
  active,
  onCopyInviteCode,
  onSelect
}: {
  group: Group;
  active: boolean;
  onCopyInviteCode: (code: string) => void;
  onSelect: () => void;
}) {
  return (
    <div className={`rounded-[1.2rem] border p-4 ${active ? "border-[rgba(148,74,0,0.3)] bg-[rgba(255,251,247,0.92)]" : "border-border bg-background/70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">{group.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">建立時間：{new Date(group.createdAt).toLocaleString("zh-TW")}</p>
          <p className="mt-1 text-sm text-muted-foreground">會員人數：{group.members?.length || 0} 人</p>
          <p className="mt-1 text-sm text-muted-foreground">邀請碼：{group.inviteCode || "尚未建立"}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={onSelect}>
            {active ? "目前查看中" : "切換到此群組"}
          </Button>
          {group.inviteCode ? (
            <Button variant="ghost" onClick={() => onCopyInviteCode(group.inviteCode || "")}>
              複製邀請碼
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={`/member/groups/${group.id}`}>詳細資訊</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="meal-stat">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-border bg-background/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function readStoredGroupId() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
