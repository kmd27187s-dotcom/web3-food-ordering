"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchMe, paySubscription, type Member } from "@/lib/api";

export function SubscriptionCheckpoint() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchMe()
      .then((nextMember) => {
        if (nextMember.subscriptionActive) {
          router.replace("/member");
          return;
        }
        setMember(nextMember);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "目前無法讀取訂閱狀態");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubscribe() {
    setPending(true);
    setMessage("");
    try {
      await paySubscription();
      router.replace("/member");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "訂閱失敗");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="rounded-[1.75rem] border border-orange-100 bg-white p-8 text-sm text-stone-500 shadow-sm">正在確認訂閱狀態...</div>;
  }

  return (
    <section className="space-y-16">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
        <div className="space-y-8 lg:col-span-7">
          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-primary">
              Checkpoint
            </span>
            <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-stone-900 md:text-6xl">
              最後一步：
              <br />
              啟用您的
              <span className="text-primary">訂餐帳號</span>
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-stone-500">錢包已連接，付款後進入系統。</p>
          </div>

          <div className="flex items-center gap-6 rounded-3xl border border-stone-100 bg-stone-50 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current stroke-2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">Status Verified</p>
              <p className="text-xl font-bold text-stone-900">
                錢包連接成功 {member?.walletAddress ? `(${shortAddress(member.walletAddress)})` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-3xl border border-stone-100 bg-white p-8 shadow-2xl">
            <div className="absolute -right-16 -top-16 h-32 w-32 bg-primary/5 blur-3xl" />
            <div className="relative z-10 space-y-8">
              <div className="flex items-start justify-between">
                <h3 className="text-2xl font-bold text-stone-900">30 天方案</h3>
                <div className="rounded-xl bg-primary/5 p-2 text-primary">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                    <path d="m12 2 2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 15.77 6.6 18.63l1.03-6.02L3.26 8.35l6.04-.88L12 2Z" />
                  </svg>
                </div>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-stone-900">99</span>
                <span className="text-xl font-medium text-stone-500">Token</span>
                <span className="ml-2 text-sm text-stone-400">/ 30 天</span>
              </div>

              <div className="space-y-4">
                {["提案", "投票", "點餐", "排行榜與紀錄"].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-primary" />
                    <span className="font-medium text-stone-600">{item}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={pending}
                className="w-full rounded-2xl bg-gradient-to-br from-primary to-[hsl(18_62%_62%)] py-5 text-lg font-bold text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95"
              >
                {pending ? "處理中..." : "支付並啟用帳號"}
              </Button>

              <p className="text-center text-sm font-medium text-stone-400">餘額不足時請先補足。</p>
            </div>
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message ? <p className="text-sm text-primary">{message}</p> : null}
      </div>
    </section>
  );
}

function shortAddress(address: string) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
