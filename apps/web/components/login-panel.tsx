"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Store, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearStoredToken, passwordLogin, setStoredToken } from "@/lib/api";
import { authenticateWithWallet, clearWalletConnection, getConnectedWalletAddress } from "@/lib/wallet-auth";

type WalletRoleMode = "login" | "register";

export function LoginPanel() {
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberInviteCode, setMemberInviteCode] = useState("");
  const [merchantDisplayName, setMerchantDisplayName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [memberMode, setMemberMode] = useState<WalletRoleMode>("login");
  const [merchantMode, setMerchantMode] = useState<WalletRoleMode>("login");
  const [memberLoading, setMemberLoading] = useState(false);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [memberMessage, setMemberMessage] = useState("");
  const [merchantMessage, setMerchantMessage] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminForm, setAdminForm] = useState({
    email: "alice@example.com",
    password: "demo1234"
  });

  useEffect(() => {
    let active = true;

    async function loadWalletStatus() {
      try {
        const address = await getConnectedWalletAddress();
        if (active) {
          setWalletAddress(address);
        }
      } catch {
        if (active) {
          setWalletAddress("");
        }
      }
    }

    loadWalletStatus();
    return () => {
      active = false;
    };
  }, []);

  async function handleWalletLogin(target: "member" | "merchant", mode: WalletRoleMode) {
    const setLoading = target === "member" ? setMemberLoading : setMerchantLoading;
    const setMessage = target === "member" ? setMemberMessage : setMerchantMessage;
    const displayName = target === "member" ? memberDisplayName : merchantDisplayName;
    const inviteCode = target === "member" ? memberInviteCode : "";
    setLoading(true);
    setMessage("");
    try {
      clearStoredToken();
      clearWalletConnection();
      const result = await authenticateWithWallet({
        displayName: mode === "register" ? displayName : "",
        inviteCode: mode === "register" ? inviteCode : ""
      });
      setStoredToken(result.token);
      setWalletAddress(result.member.walletAddress || "");
      if (target === "member") {
        window.location.replace(result.member.subscriptionActive ? "/member" : "/subscribe");
        return;
      }
      window.location.replace("/merchant");
    } catch (error) {
      if (error instanceof Error && error.message.includes("displayName is required")) {
        setMessage("這個錢包看起來是第一次使用，請切到「首次註冊」後填入名稱。");
      } else {
        setMessage(error instanceof Error ? error.message : "登入失敗");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    setAdminLoading(true);
    setAdminMessage("");
    try {
      clearStoredToken();
      const result = await passwordLogin(adminForm.email, adminForm.password);
      setStoredToken(result.token);
      window.location.replace("/admin");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "登入失敗");
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <section className="grid gap-4">
      <WalletRoleCard
        icon={Users}
        title="一般會員"
        description="既有會員可直接登入，新用戶先註冊再進入治理與點餐。"
        mode={memberMode}
        displayName={memberDisplayName}
        inviteCode={memberInviteCode}
        walletAddress={walletAddress}
        loading={memberLoading}
        message={memberMessage}
        onModeChange={setMemberMode}
        loginLabel="會員登入"
        registerLabel="會員註冊"
        registerDescription="第一次使用請輸入顯示名稱，選填邀請碼。"
        showInviteCode
        onDisplayNameChange={setMemberDisplayName}
        onInviteCodeChange={setMemberInviteCode}
        onSubmit={() => void handleWalletLogin("member", memberMode)}
      />

      <WalletRoleCard
        icon={Store}
        title="店家入口"
        description="店家可用既有會員錢包登入，首次使用先註冊負責人名稱。"
        mode={merchantMode}
        displayName={merchantDisplayName}
        inviteCode=""
        walletAddress={walletAddress}
        loading={merchantLoading}
        message={merchantMessage}
        onModeChange={setMerchantMode}
        loginLabel="店家登入"
        registerLabel="店家註冊"
        registerDescription="第一次使用店家錢包時，先建立負責人名稱；登入後再建立店家資訊、地址與菜單。"
        showInviteCode={false}
        onDisplayNameChange={setMerchantDisplayName}
        onInviteCodeChange={() => undefined}
        onSubmit={() => void handleWalletLogin("merchant", merchantMode)}
      />

      <AdminRoleCard
        email={adminForm.email}
        password={adminForm.password}
        loading={adminLoading}
        message={adminMessage}
        onEmailChange={(email) => setAdminForm((prev) => ({ ...prev, email }))}
        onPasswordChange={(password) => setAdminForm((prev) => ({ ...prev, password }))}
        onSubmit={() => void handleAdminLogin()}
      />
    </section>
  );
}

function WalletRoleCard({
  icon: Icon,
  title,
  description,
  mode,
  displayName,
  inviteCode,
  walletAddress,
  loading,
  message,
  onModeChange,
  loginLabel,
  registerLabel,
  registerDescription,
  showInviteCode = true,
  onDisplayNameChange,
  onInviteCodeChange,
  onSubmit
}: {
  icon: typeof Users;
  title: string;
  description: string;
  mode: WalletRoleMode;
  displayName: string;
  inviteCode: string;
  walletAddress: string;
  loading: boolean;
  message: string;
  onModeChange: (mode: WalletRoleMode) => void;
  loginLabel: string;
  registerLabel: string;
  registerDescription: string;
  showInviteCode?: boolean;
  onDisplayNameChange: (value: string) => void;
  onInviteCodeChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const canSubmit = mode === "login" || Boolean(displayName.trim());

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.62)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(251,242,237,0.88))] p-7 shadow-[0_24px_70px_rgba(93,54,27,0.14)] backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="meal-hero-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="meal-kicker">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-[rgba(220,193,177,0.42)] bg-[rgba(251,242,237,0.82)] p-1">
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
          onClick={() => onModeChange("login")}
        >
          登入
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "register" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
          onClick={() => onModeChange("register")}
        >
          首次註冊
        </button>
      </div>

      {mode === "register" ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{registerDescription}</p>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold text-foreground">名稱 (必填)</span>
            <input className="meal-field" value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} placeholder="請輸入名稱（必填）" />
          </label>
          {showInviteCode ? (
            <label className="grid gap-2 text-sm">
              <span className="font-semibold text-foreground">邀請碼 (選填)</span>
              <input className="meal-field" value={inviteCode} onChange={(event) => onInviteCodeChange(event.target.value)} placeholder="邀請碼（選填）" />
            </label>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.2rem] border border-[rgba(220,193,177,0.38)] bg-[rgba(255,255,255,0.62)] px-4 py-4 text-sm text-muted-foreground">
          使用已註冊的錢包直接登入；如果這個錢包還沒用過，請切到「首次註冊」。
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onSubmit} disabled={loading || !canSubmit}>
          {loading ? "處理中..." : mode === "login" ? loginLabel : registerLabel}
        </Button>
        <span className="inline-flex items-center rounded-full border border-[rgba(220,193,177,0.42)] bg-[rgba(251,242,237,0.82)] px-4 py-3 text-sm font-semibold text-muted-foreground">
          {walletAddress ? `目前已連接 ${shortAddress(walletAddress)}` : "目前未連接錢包"}
        </span>
      </div>

      {message ? <p className="mt-4 text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </section>
  );
}

function AdminRoleCard({
  email,
  password,
  loading,
  message,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: {
  email: string;
  password: string;
  loading: boolean;
  message: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.62)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,239,229,0.88))] p-7 shadow-[0_24px_70px_rgba(93,54,27,0.14)] backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,hsl(183_61%_35%),hsl(204_62%_23%))] text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="meal-kicker">平台管理者登入</p>
          <p className="text-sm text-muted-foreground">預設帳密已帶入，可直接進後台看統計與審核店家菜單。</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-foreground">Email (必填)</span>
          <input className="meal-field" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="請輸入 Email（必填）" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-foreground">Password (必填)</span>
          <input className="meal-field" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="請輸入 Password（必填）" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onSubmit} disabled={loading} className="bg-[linear-gradient(135deg,hsl(183_61%_35%),hsl(204_62%_23%))] shadow-[0_18px_40px_rgba(16,76,87,0.22)]">
          {loading ? "登入中..." : "管理者登入"}
        </Button>
        <span className="inline-flex items-center rounded-full border border-[rgba(188,214,218,0.5)] bg-[rgba(235,247,248,0.88)] px-4 py-3 text-sm font-semibold text-muted-foreground">
          alice@example.com / demo1234
        </span>
      </div>

      {message ? <p className="mt-4 text-sm text-[hsl(7_65%_42%)]">{message}</p> : null}
    </section>
  );
}

function shortAddress(address: string) {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
