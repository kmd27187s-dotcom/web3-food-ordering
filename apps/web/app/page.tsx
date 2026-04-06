import { AppNavCompact } from "@/components/app-nav";
import { LoginPanel } from "@/components/login-panel";

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#fff8f5]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 md:px-10">
        <div className="relative z-30 flex items-center justify-between">
          <div>
            <p className="text-3xl font-black tracking-tight text-primary">MealVote</p>
            <p className="mt-1 text-sm text-stone-500">辦公室去中心化訂餐治理系統</p>
          </div>
          <AppNavCompact />
        </div>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6 text-center lg:text-left">
              <div className="space-y-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-stone-300">
                  System Ready
                </div>
                <h1 className="text-5xl font-black tracking-tight text-primary md:text-7xl">
                  MealVote
                </h1>
                <p className="text-lg text-stone-500">連結錢包後進入系統</p>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl">
              <LoginPanel />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
