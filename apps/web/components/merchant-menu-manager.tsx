"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createMerchantMenuChange,
  fetchMe,
  fetchMerchantDashboard,
  withdrawMerchantMenuChange,
  type Member,
  type Merchant,
  type MerchantDashboard as MerchantDashboardData
} from "@/lib/api";

const WEI_PER_ETH = 10n ** 18n;
const APPROX_TWD_PER_ETH = 120000;

function formatWei(value: string | number) {
  const amount = BigInt(typeof value === "number" ? value : value || "0");
  const integer = amount / WEI_PER_ETH;
  const fraction = amount % WEI_PER_ETH;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${integer.toString()}${fractionText ? `.${fractionText}` : ""} ETH`;
}

function formatWeiForInput(value: string | number) {
  const amount = BigInt(typeof value === "number" ? value : value || "0");
  const integer = amount / WEI_PER_ETH;
  const fraction = amount % WEI_PER_ETH;
  const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "");
  return fractionText ? `${integer.toString()}.${fractionText}` : integer.toString();
}

function parsePriceInputToWei(input: string, unit: "wei" | "eth") {
  const trimmed = input.trim();
  if (!trimmed) return { value: "", error: "請填寫價格。" };
  if (unit === "wei") {
    if (!/^\d+$/.test(trimmed)) return { value: "", error: "Wei 單位只能輸入整數數字。" };
    const wei = BigInt(trimmed);
    if (wei <= 0n) return { value: "", error: "價格必須大於 0。" };
    return { value: wei.toString(), error: "" };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { value: "", error: "ETH 單位請輸入數字，可包含小數點。" };
  const [whole, decimal = ""] = trimmed.split(".");
  const normalizedDecimal = `${decimal}000000000000000000`.slice(0, 18);
  const wei = BigInt(whole || "0") * WEI_PER_ETH + BigInt(normalizedDecimal || "0");
  if (wei <= 0n) return { value: "", error: "價格必須大於 0。" };
  return { value: wei.toString(), error: "" };
}

function formatApproxTWDFromWei(value: string) {
  if (!value) return "";
  const wei = BigInt(value);
  const twd = Number((wei * BigInt(APPROX_TWD_PER_ETH)) / WEI_PER_ETH);
  return `約 NT$${twd.toLocaleString("zh-TW")}`;
}

type DraftAction = "create" | "update" | "delete";

type DraftState = {
  action: DraftAction;
  menuItemId: string;
  itemName: string;
  priceWei: string;
  priceUnit: "wei" | "eth";
  description: string;
};

const emptyDraft: DraftState = {
  action: "create",
  menuItemId: "",
  itemName: "",
  priceWei: "",
  priceUnit: "eth",
  description: ""
};

export function MerchantMenuOverview() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState<MerchantDashboardData | null>(null);

  useEffect(() => {
    fetchMerchantDashboard()
      .then(setDashboard)
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取菜單資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入菜單清單...</div>;
  }

  if (!dashboard?.merchant) {
    return (
      <section className="space-y-6">
        <div className="meal-panel p-8">
          <p className="meal-kicker">Merchant menu</p>
          <h1 className="text-3xl font-extrabold">請先建立店家資訊</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">先到店家資訊頁建立店名、地址與介紹，之後才能管理菜單。</p>
          <Button className="mt-5" asChild>
            <Link href="/merchant/profile">前往店家資訊</Link>
          </Button>
        </div>
        {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="meal-panel p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="meal-kicker">Menu overview</p>
            <h1 className="text-3xl font-extrabold">{dashboard.merchant.name} 菜單品項</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">先看目前上架品項清單，再進入編輯菜單頁送出新增、修改或刪除審核。</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/merchant/menu/edit">編輯菜單</Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-3">
          {dashboard.merchant.menu.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有上架品項。</p> : null}
          {dashboard.merchant.menu.map((item) => (
            <div key={item.id} className="rounded-[1.4rem] border border-border bg-background/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.id}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description || "尚無描述"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatWei(item.priceWei)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </section>
  );
}

export function MerchantMenuManager({ mode = "manage" }: { mode?: "manage" | "create" }) {
  const [member, setMember] = useState<Member | null>(null);
  const [data, setData] = useState<MerchantDashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [historySort, setHistorySort] = useState("newest");
  const [draft, setDraft] = useState<DraftState>(mode === "create" ? emptyDraft : { ...emptyDraft, action: "update" });

  async function refresh() {
    const [me, dashboard] = await Promise.all([fetchMe(), fetchMerchantDashboard()]);
    setMember(me);
    setData(dashboard);
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取菜單資料失敗"))
      .finally(() => setLoading(false));
  }, []);

  const sortedRequests = useMemo(() => {
    return [...(data?.menuChangeRequests || [])].sort((left, right) => {
      switch (historySort) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "id_asc":
          return left.id - right.id;
        case "id_desc":
          return right.id - left.id;
        case "status":
          return left.status.localeCompare(right.status, "zh-TW");
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }, [data?.menuChangeRequests, historySort]);

  const pricePreview = draft.action === "delete" ? { value: "", error: "" } : parsePriceInputToWei(draft.priceWei, draft.priceUnit);

  async function handleSubmitMenuChange() {
    const requiresItemId = draft.action === "update" || draft.action === "delete";
    const requiresDetails = draft.action === "create" || draft.action === "update";
    const parsedPrice = requiresDetails ? parsePriceInputToWei(draft.priceWei, draft.priceUnit) : { value: "", error: "" };
    if (requiresItemId && !draft.menuItemId.trim()) return setMessage("修改或刪除品項時，必須填入品項 ID。");
    if (requiresDetails && !draft.itemName.trim()) return setMessage("請先填寫品項名稱。");
    if (requiresDetails && parsedPrice.error) return setMessage(parsedPrice.error);

    setPending(true);
    try {
      await createMerchantMenuChange({
        action: draft.action,
        menuItemId: draft.menuItemId.trim() || undefined,
        itemName: draft.itemName.trim() || undefined,
        priceWei: requiresDetails ? parsedPrice.value : undefined,
        description: draft.description.trim() || undefined
      });
      setDraft(emptyDraft);
      await refresh();
      setMessage("菜單異動已送平台審核，核准後隔日 00:00 生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "送審失敗");
    } finally {
      setPending(false);
    }
  }

  async function handleWithdrawRequest(requestId: number) {
    setPending(true);
    try {
      await withdrawMerchantMenuChange(requestId);
      await refresh();
      setMessage("已抽回送審，可修改後重新送出。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "抽回送審失敗");
    } finally {
      setPending(false);
    }
  }

  function loadItemToDraft(item: Merchant["menu"][number]) {
    setDraft({
      action: "update",
      menuItemId: item.id,
      itemName: item.name,
      priceWei: formatWeiForInput(item.priceWei),
      priceUnit: "eth",
      description: item.description
    });
  }

  function loadRequestToDraft(request: MerchantDashboardData["menuChangeRequests"][number]) {
    setDraft({
      action: request.action as DraftAction,
      menuItemId: request.menuItemId,
      itemName: request.itemName,
      priceWei: request.priceWei ? formatWeiForInput(request.priceWei) : "",
      priceUnit: "eth",
      description: request.description || ""
    });
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入菜單管理...</div>;
  }

  if (!member) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">請先登入會員並連接店家錢包。</div>;
  }

  if (!data?.merchant) {
    return (
      <section className="space-y-6">
        <div className="meal-panel p-8">
          <p className="meal-kicker">Merchant profile</p>
          <h1 className="text-3xl font-extrabold">請先建立店家資訊</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">先到店家資訊頁建立店名、地址與介紹，之後才能管理菜單與送審異動。</p>
          <Button className="mt-5" asChild>
            <Link href="/merchant/profile">前往店家資訊</Link>
          </Button>
        </div>
        {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="meal-panel p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="meal-kicker">{mode === "create" ? "Create item" : "Menu review"}</p>
            <h1 className="text-3xl font-extrabold">{mode === "create" ? "新增菜單品項" : `${data.merchant.name} 編輯菜單`}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {mode === "create"
                ? "新增品項也需要平台審核，核准後隔日 00:00 生效。"
                : "在這裡送出修改、刪除或抽回送審。新增品項請到右上方獨立頁面操作。"}
            </p>
          </div>
          <div className="flex gap-3">
            {mode !== "create" ? (
              <Button asChild variant="secondary">
                <Link href="/merchant/menu/new">新增品項</Link>
              </Button>
            ) : null}
            {mode !== "create" ? (
              <Button asChild variant="ghost">
                <Link href="/merchant/menu/history">送審紀錄</Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href="/merchant/menu">回品項清單</Link>
            </Button>
          </div>
        </div>

        {mode !== "create" ? (
          <div className="mt-6 grid gap-3">
            {data.merchant.menu.length === 0 ? <p className="text-sm text-muted-foreground">目前還沒有上架品項。</p> : null}
            {data.merchant.menu.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.id}</p>
                  </div>
                  <p className="font-semibold">{formatWei(item.priceWei)}</p>
                </div>
                <div className="mt-3 flex gap-3">
                  <Button variant="secondary" disabled={pending} onClick={() => loadItemToDraft(item)}>
                    載入修改
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      setDraft({
                        action: "delete",
                        menuItemId: item.id,
                        itemName: item.name,
                        priceWei: formatWeiForInput(item.priceWei),
                        priceUnit: "eth",
                        description: item.description
                      })
                    }
                  >
                    刪除送審
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {mode !== "create" ? (
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-foreground">異動類型 (必填)</span>
              <select className="meal-field" value={draft.action} onChange={(event) => setDraft((prev) => ({ ...prev, action: event.target.value as DraftAction }))}>
                <option value="update">修改品項</option>
                <option value="delete">刪除品項</option>
              </select>
            </label>
          ) : null}
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">品項 ID {draft.action === "update" || draft.action === "delete" ? "(必填)" : "(系統可自動產生)"}</span>
            <input className="meal-field" placeholder="品項 ID（修改 / 刪除時必填）" value={draft.menuItemId} onChange={(event) => setDraft((prev) => ({ ...prev, menuItemId: event.target.value }))} />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">品項名稱 {draft.action === "delete" ? "(刪除時可沿用原品項)" : "(必填)"}</span>
            <input className="meal-field" placeholder={draft.action === "delete" ? "品項名稱（刪除時可留空）" : "品項名稱（必填）"} value={draft.itemName} onChange={(event) => setDraft((prev) => ({ ...prev, itemName: event.target.value }))} />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">價格 {draft.action === "delete" ? "(刪除時可留空)" : "(必填)"}</span>
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <select className="meal-field" value={draft.priceUnit} onChange={(event) => setDraft((prev) => ({ ...prev, priceUnit: event.target.value as "wei" | "eth" }))} disabled={draft.action === "delete"}>
                <option value="eth">ETH</option>
                <option value="wei">Wei</option>
              </select>
              <input className="meal-field" inputMode="decimal" placeholder={draft.action === "delete" ? "價格（刪除時可留空）" : draft.priceUnit === "eth" ? "例如：0.01" : "例如：10000000000000000"} value={draft.priceWei} onChange={(event) => setDraft((prev) => ({ ...prev, priceWei: event.target.value }))} />
            </div>
            {draft.action !== "delete" ? (
              <p className="text-xs text-muted-foreground">
                {pricePreview.error ? pricePreview.error : pricePreview.value ? `${formatWei(pricePreview.value)} / ${formatApproxTWDFromWei(pricePreview.value)}` : "請輸入價格數字，系統會自動換算。"}
              </p>
            ) : null}
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">描述 (選填)</span>
            <textarea className="meal-field min-h-28" placeholder="描述（選填）" value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button disabled={pending} onClick={handleSubmitMenuChange}>送出審核</Button>
            <Button variant="ghost" disabled={pending} onClick={() => setDraft(mode === "create" ? emptyDraft : { ...emptyDraft, action: "update" })}>
              清空草稿
            </Button>
          </div>
        </div>
      </section>

      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </div>
  );
}

export function MerchantMenuRequestHistory() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [historySort, setHistorySort] = useState("newest");
  const [data, setData] = useState<MerchantDashboardData | null>(null);

  async function refresh() {
    setData(await fetchMerchantDashboard());
  }

  useEffect(() => {
    refresh()
      .catch((error) => setMessage(error instanceof Error ? error.message : "讀取送審紀錄失敗"))
      .finally(() => setLoading(false));
  }, []);

  const sortedRequests = useMemo(() => {
    return [...(data?.menuChangeRequests || [])].sort((left, right) => {
      switch (historySort) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "id_asc":
          return left.id - right.id;
        case "id_desc":
          return right.id - left.id;
        case "status":
          return left.status.localeCompare(right.status, "zh-TW");
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }, [data?.menuChangeRequests, historySort]);

  async function handleWithdrawRequest(requestId: number) {
    setPending(true);
    try {
      await withdrawMerchantMenuChange(requestId);
      await refresh();
      setMessage("已抽回送審，可返回編輯菜單後重新送出。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "抽回送審失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.5rem] border border-border bg-card p-8">正在載入菜單送審紀錄...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="meal-panel p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="meal-kicker">Request history</p>
            <h1 className="text-3xl font-extrabold">菜單送審紀錄</h1>
          </div>
          <Button asChild variant="ghost">
            <Link href="/merchant/menu/edit">回編輯菜單</Link>
          </Button>
        </div>
        <div className="mt-4 max-w-xs">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">排序方式</span>
            <select className="meal-field" value={historySort} onChange={(event) => setHistorySort(event.target.value)}>
              <option value="newest">依建立時間新到舊</option>
              <option value="oldest">依建立時間舊到新</option>
              <option value="id_desc">依 ID 大到小</option>
              <option value="id_asc">依 ID 小到大</option>
              <option value="status">依狀態排序</option>
            </select>
          </label>
        </div>
        <div className="mt-6 space-y-3">
          {sortedRequests.length === 0 ? <p className="text-sm text-muted-foreground">目前沒有送審紀錄。</p> : null}
          {sortedRequests.map((request) => (
            <div key={request.id} className="rounded-[1.2rem] border border-border bg-background/70 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{request.itemName || request.menuItemId}</p>
                <span className="text-muted-foreground">{request.status}</span>
              </div>
              <p className="mt-2 text-muted-foreground">{request.action} • {request.reviewNote || "待平台審核"}</p>
              <p className="mt-2 text-muted-foreground">建立時間：{new Date(request.createdAt).toLocaleString("zh-TW")}</p>
              {request.effectiveAt ? <p className="mt-2 text-muted-foreground">生效時間：{new Date(request.effectiveAt).toLocaleString("zh-TW")}</p> : null}
              {request.status === "pending" ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button variant="ghost" disabled={pending} onClick={() => handleWithdrawRequest(request.id)}>
                    抽回修改
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {message ? <p className="text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </section>
  );
}
