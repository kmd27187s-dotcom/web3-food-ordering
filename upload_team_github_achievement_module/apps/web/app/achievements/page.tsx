"use client";

import { AppNav } from "@/components/app-nav";

export default function AchievementsPage() {
  return (
    <main className="min-h-screen bg-[#f6efe6] text-[#2d2219]">
      <div className="mx-auto max-w-[1440px] px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#8c7258]">MealVote</p>
            <h1 className="mt-2 font-serif text-4xl text-[#4c3d2b]">店家建築總覽與成就勳章</h1>
            <p className="mt-2 text-sm text-[#766453]">
              這頁使用獨立 achievement 模組資料流，不會寫入主體原本的會員、投票與點餐資料。
            </p>
          </div>
          <AppNav />
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#dbcab6] bg-[#fffaf4] shadow-[0_14px_28px_rgba(95,72,44,.08)]">
          <iframe
            src="/achievement-module.html"
            title="Achievement Module"
            className="h-[calc(100vh-10rem)] min-h-[1200px] w-full border-0 bg-transparent"
          />
        </div>
      </div>
    </main>
  );
}
