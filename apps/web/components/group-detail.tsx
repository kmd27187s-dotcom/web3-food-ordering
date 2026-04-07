"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createGroupInvite, fetchGroupDetail, updateGroup, type GroupDetail } from "@/lib/api";

export function GroupDetailView({ groupId }: { groupId: number }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(false);

  async function refresh() {
    const data = await fetchGroupDetail(groupId);
    setDetail(data);
    setName(data.group.name);
    setDescription(data.group.description || "");
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取群組詳細資料失敗"))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function handleSaveGroup() {
    setPending(true);
    try {
      await updateGroup(groupId, { name, description });
      await refresh();
      setEditing(false);
      setMessage("群組資料已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新群組失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleCreateInvite() {
    setPending(true);
    try {
      const invite = await createGroupInvite(groupId);
      setMessage(`已更新群組邀請碼：${invite.inviteCode}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立邀請碼失敗");
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

  if (loading) return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入群組詳細資料...</div>;
  if (!detail) return <div className="rounded-[1.5rem] border border-border bg-card p-8 text-sm text-[hsl(7_65%_42%)]">{message || "找不到群組資料"}</div>;

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <p className="meal-kicker">Group detail</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold">{detail.group.name}</h1>
              {detail.canManage ? (
                <Button variant="ghost" className="gap-2" onClick={() => setEditing((current) => !current)} disabled={pending}>
                  <Pencil className="h-4 w-4" />
                  {editing ? "收合編輯" : "編輯"}
                </Button>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{detail.group.description || "尚未填寫群組說明"}</p>
          </div>
          {detail.canManage && !detail.group.inviteCode ? (
            <Button variant="secondary" onClick={handleCreateInvite} disabled={pending}>建立邀請碼</Button>
          ) : null}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="會員人數" value={`${detail.memberCount}`} />
          <Stat label="建立時間" value={new Date(detail.group.createdAt).toLocaleString("zh-TW")} />
          <Stat label="邀請碼使用次數" value={`${detail.inviteUsages?.length || 0} 次`} />
          <div className="meal-stat">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">邀請碼</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-base font-semibold">{detail.group.inviteCode || "尚未建立"}</p>
              {detail.group.inviteCode ? (
                <button type="button" onClick={() => handleCopyInviteCode(detail.group.inviteCode || "")} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  <Copy className="h-4 w-4" />
                  複製
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {detail.canManage && editing ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-foreground">群組名稱 (必填)</span>
                <input className="meal-field" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-foreground">群組說明 (選填)</span>
                <input className="meal-field" value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handleSaveGroup} disabled={pending || !name.trim()}>更新群組</Button>
              <Button variant="ghost" onClick={() => {
                setName(detail.group.name);
                setDescription(detail.group.description || "");
                setEditing(false);
              }} disabled={pending}>取消</Button>
            </div>
          </>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="meal-panel p-8">
          <p className="meal-kicker">Members</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">會員清單</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">先看群組成員總覽，再點進去看每位成員的完整資料與參與紀錄。</p>
            </div>
            <Button asChild variant="secondary">
              <Link href={`/member/groups/${groupId}/members`}>查看會員清單</Link>
            </Button>
          </div>
          <div className="mt-6 space-y-3">
            {detail.members.slice(0, 3).map((member) => (
              <div key={member.memberId} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div>
                  <p className="font-bold">{member.displayName}</p>
                  <p className="mt-2 break-all text-sm text-muted-foreground">錢包：{member.walletAddress || "尚未綁定"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">目前積分：{member.points}</p>
                </div>
              </div>
            ))}
            {detail.members.length > 3 ? <p className="text-sm text-muted-foreground">另有 {detail.members.length - 3} 位成員，請點進詳細頁查看。</p> : null}
          </div>
        </div>

        <div className="meal-panel p-8">
          <p className="meal-kicker">Orders</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">歷史訂單</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">群組歷史訂單會集中到獨立頁面查看，方便你先看清單，再點進詳細資訊。</p>
            </div>
            <Button asChild variant="secondary">
              <Link href={`/member/groups/${groupId}/orders`}>查看歷史訂單</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="meal-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="meal-kicker">Invite usage</p>
            <h2 className="text-2xl font-extrabold">群組邀請碼使用紀錄</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">顯示這組邀請碼已被多少人使用，以及最近加入成員的時間。</p>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/member/groups/${groupId}/invite-usage`}>查看完整紀錄</Link>
          </Button>
        </div>
        <div className="mt-6 space-y-3">
          {detail.inviteUsages?.slice(0, 3).map((usage) => (
            <div key={usage.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
              <p className="font-bold">{usage.usedByName}</p>
              <p className="mt-1 text-sm text-muted-foreground">使用時間：{new Date(usage.usedAt).toLocaleString("zh-TW")}</p>
            </div>
          ))}
          {!detail.inviteUsages?.length ? <p className="text-sm text-muted-foreground">目前尚無群組邀請碼使用紀錄。</p> : null}
        </div>
      </section>

      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
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
