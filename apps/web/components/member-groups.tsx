"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { createGroup, fetchGroups, fetchMe, joinGroup, type Group, type Member } from "@/lib/api";

export function MemberGroups() {
  const [member, setMember] = useState<Member | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  async function refresh() {
    const [me, nextGroups] = await Promise.all([fetchMe(), fetchGroups()]);
    setMember(me);
    setGroups(nextGroups);
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取群組資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  const ownedGroups = useMemo(
    () => groups.filter((group) => group.ownerMemberId === member?.id),
    [groups, member?.id]
  );
  const joinedGroups = useMemo(
    () => groups.filter((group) => !ownedGroups.some((owned) => owned.id === group.id)),
    [groups, ownedGroups]
  );

  async function handleCreateGroup() {
    if (!createName.trim()) return;
    setPending(true);
    try {
      const group = await createGroup(createName.trim());
      setCreateName("");
      await refresh();
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
      await refresh();
      setMessage(`已加入群組「${group.name}」`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入群組失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入群組清單...</div>;

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

  async function handleCopyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(`已複製邀請碼：${code}`);
    } catch {
      setMessage("複製邀請碼失敗");
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-2">
        <section className="meal-panel p-8">
          <p className="meal-kicker">Create group</p>
          <h1 className="text-3xl font-extrabold">建立新群組</h1>
          <label className="mt-6 grid gap-2 text-sm">
            <span className="font-semibold text-foreground">群組名稱 (必填)</span>
            <input className="meal-field" value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="例如：信義午餐群（必填）" />
          </label>
          <Button className="mt-4" onClick={handleCreateGroup} disabled={pending || !createName.trim()}>建立群組</Button>
        </section>

        <section className="meal-panel p-8">
          <p className="meal-kicker">Join group</p>
          <h2 className="text-3xl font-extrabold">加入群組</h2>
          <label className="mt-6 grid gap-2 text-sm">
            <span className="font-semibold text-foreground">邀請碼 (必填)</span>
            <input className="meal-field" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="請輸入邀請碼（必填）" />
          </label>
          <Button className="mt-4" onClick={handleJoinGroup} disabled={pending || !inviteCode.trim()}>加入群組</Button>
        </section>
      </section>

      <section className="meal-panel p-8">
        <p className="meal-kicker">Group list</p>
        <h2 className="text-3xl font-extrabold">參與群組清單</h2>
        <div className="mt-4 max-w-xs">
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
        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-bold">我建立的群組</h3>
            {sortGroups(ownedGroups).length === 0 ? <p className="text-sm text-muted-foreground">目前沒有自己建立的群組。</p> : null}
            {sortGroups(ownedGroups).map((group) => (
              <GroupRow key={group.id} group={group} onCopyInviteCode={handleCopyInviteCode} />
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-bold">我參與的群組</h3>
            {sortGroups(joinedGroups).length === 0 ? <p className="text-sm text-muted-foreground">目前沒有參與其他人的群組。</p> : null}
            {sortGroups(joinedGroups).map((group) => (
              <GroupRow key={group.id} group={group} onCopyInviteCode={handleCopyInviteCode} />
            ))}
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}

function GroupRow({ group, onCopyInviteCode }: { group: Group; onCopyInviteCode: (code: string) => void }) {
  return (
    <div className="rounded-[1.2rem] border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">{group.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">建立時間：{new Date(group.createdAt).toLocaleString("zh-TW")}</p>
          <p className="mt-1 text-sm text-muted-foreground">會員人數：{group.members?.length || 0} 人</p>
          <p className="mt-1 text-sm text-muted-foreground">邀請碼：{group.inviteCode || "尚未建立"}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {group.inviteCode ? (
            <Button variant="ghost" onClick={() => onCopyInviteCode(group.inviteCode || "")}>複製邀請碼</Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={`/member/groups/${group.id}`}>詳細資訊</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
