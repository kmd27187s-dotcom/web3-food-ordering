"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cancelMerchantDelist,
  fetchMe,
  fetchMerchantDetail,
  fetchMerchantDashboard,
  unlinkMerchantWallet,
  updateMerchantWallet,
  upsertMerchantProfile,
  type Member,
  type Merchant,
  type MerchantDetail
} from "@/lib/api";
import { connectWallet } from "@/lib/wallet-auth";

export function MerchantProfileManager() {
  const [member, setMember] = useState<Member | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [merchantDetail, setMerchantDetail] = useState<MerchantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    id: "",
    name: "",
    address: "",
    description: ""
  });

  async function refresh() {
    const [me, dashboard] = await Promise.all([fetchMe(), fetchMerchantDashboard()]);
    setMember(me);
    setMerchant(dashboard.merchant);
    if (dashboard.merchant?.id) {
      setMerchantDetail(await fetchMerchantDetail(dashboard.merchant.id).catch(() => null));
    } else {
      setMerchantDetail(null);
    }
    if (dashboard.merchant) {
      setForm({
        id: dashboard.merchant.id,
        name: dashboard.merchant.name,
        address: dashboard.merchant.address || "",
        description: dashboard.merchant.description || ""
      });
    }
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取店家資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setPending(true);
    setMessage("");
    try {
      const updated = await upsertMerchantProfile(form);
      setMerchant(updated);
      setMerchantDetail(await fetchMerchantDetail(updated.id).catch(() => null));
      setForm({
        id: updated.id,
        name: updated.name,
        address: updated.address || "",
        description: updated.description || ""
      });
      setMessage("店家資訊已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleChangeWallet() {
    setPending(true);
    setMessage("");
    try {
      const walletAddress = await connectWallet();
      const updated = await updateMerchantWallet(walletAddress);
      setMerchant(updated);
      setMerchantDetail(await fetchMerchantDetail(updated.id).catch(() => null));
      setMessage("店家收款錢包已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新店家錢包失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleUnlinkWallet() {
    setPending(true);
    setMessage("");
    try {
      await unlinkMerchantWallet();
      setMerchant(null);
      setMerchantDetail(null);
      setForm({
        id: "",
        name: "",
        address: "",
        description: ""
      });
      setMessage("店家錢包綁定已解除。若要重新開店，請重新填寫店家資訊。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "解除店家錢包失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleCancelDelist() {
    setPending(true);
    setMessage("");
    try {
      const updated = await cancelMerchantDelist();
      setMerchant(updated);
      setMerchantDetail(await fetchMerchantDetail(updated.id).catch(() => null));
      setMessage("已抽回下架申請，可再修改後重新送審。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "抽回下架申請失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入店家資訊...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="meal-panel p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="meal-kicker">Merchant profile</p>
            <h1 className="text-3xl font-extrabold">{merchant ? merchant.name : "建立店家資訊"}</h1>
            {merchant ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(251,242,237,0.72)] px-4 py-2 text-sm font-semibold text-foreground">
                  平均星等 {(merchantDetail?.merchant.averageRating || 0).toFixed(1)} / 5
                </div>
                <div className="rounded-full border border-[rgba(220,193,177,0.46)] bg-[rgba(251,242,237,0.72)] px-4 py-2 text-sm font-semibold text-foreground">
                  {merchantDetail?.merchant.reviewCount || 0} 則留言
                </div>
                <Button asChild variant="secondary">
                  <Link href="/merchant/reviews">查看評分與留言</Link>
                </Button>
              </div>
            ) : null}
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              這裡管理店名、地址、店家介紹、收款錢包與下架狀態。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="meal-panel p-8">
          <div className="grid gap-4">
            <Field label="店家名稱 (必填)">
              <input
                className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：巷口便當（必填）"
              />
            </Field>
            <Field label="店家地址 (必填)">
              <input
                className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="例如：台北市大安區忠孝東路...（必填）"
              />
            </Field>
            <Field label="店家介紹 (必填)">
              <textarea
                className="min-h-32 w-full rounded-2xl border border-border bg-background px-4 py-3"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="介紹招牌菜、營業時間或店家特色（必填）"
              />
            </Field>
          </div>
          <Button
            className="mt-5"
            disabled={pending || !form.name.trim() || !form.address.trim() || !form.description.trim()}
            onClick={handleSave}
          >
            {merchant ? "更新店家資訊" : "建立店家"}
          </Button>
        </section>

        <section className="meal-panel p-8">
          <div className="flex items-center gap-2">
            <p className="meal-kicker">Overview</p>
            <div className="group relative">
              <CircleHelp className="h-4 w-4 text-muted-foreground" />
              <div className="pointer-events-none absolute right-0 top-6 z-20 hidden w-80 rounded-[1rem] border border-border bg-[rgba(255,251,247,0.98)] p-4 text-sm leading-7 text-muted-foreground shadow-float group-hover:block">
                <p className="font-semibold text-foreground">操作順序說明</p>
                <p className="mt-2">
                  如果你要把目前這間店交出去、停用，或準備用同一個地址重開一間新店，請先按「解除店家綁定」。
                  系統會先清掉收款錢包，並同時送出下架審核。之後這個地址就可以重新建立新的店家資料。
                  如果只是要換收款地址，不需要解除綁定，直接按「修改收款錢包」即可。
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-4 text-sm">
            <InfoRow label="店家編號" value={merchant?.id || "建立後自動產生"} />
            <InfoRow label="負責人" value={member?.displayName || "尚未登入"} />
            <InfoRow label="會員登入錢包" value={member?.walletAddress || "尚未連結錢包"} breakAll />
            <InfoRow label="店家收款錢包" value={merchant?.payoutAddress || "尚未綁定"} breakAll />
            <InfoRow label="目前菜單數" value={`${merchant?.menu.length || 0} 項`} />
            <InfoRow
              label="店家狀態"
              value={
                merchant?.delistedAt
                  ? "已下架"
                  : merchant?.delistRequestedAt
                    ? "已提出下架申請"
                    : "上架中"
              }
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={handleChangeWallet} disabled={pending || !merchant}>
              修改收款錢包
            </Button>
            <Button variant="secondary" onClick={handleUnlinkWallet} disabled={pending || !merchant}>
              解除店家綁定並送出下架申請
            </Button>
            {merchant?.delistRequestedAt && !merchant.delistedAt ? (
              <Button variant="ghost" onClick={handleCancelDelist} disabled={pending}>
                抽回下架申請
              </Button>
            ) : null}
          </div>
        </section>
      </div>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}

function InfoRow({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="rounded-[1.2rem] border border-border bg-background/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-foreground ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}
