import { ArrowRight, BackOne, CloseSmall, Devices, FileSettingsOne, Logout, Sync } from "@icon-park/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import { getAdminOfflineLabel, useAdminOfflineStore } from "@/stores/adminOffline";
import ContentSettings from "@/components/ContentSettings";
import SecuritySettings from "@/components/SecuritySettings";
import "@/components/OwnerPanel.scss";

type Tab = "content" | "security";
const tabs = [
  { key: "content", label: "站点设置", icon: FileSettingsOne },
  { key: "security", label: "设备安全", icon: Devices },
] as const;

export default function OwnerPanel({ onClose }: { onClose: () => void }) {
  const status = useAuthStore((state) => state.status);
  const device = useAuthStore((state) => state.device);
  const loginAction = useAuthStore((state) => state.login);
  const logoutAction = useAuthStore((state) => state.logout);
  const flushing = useAdminOfflineStore((state) => state.flushing);
  const pendingCount = useAdminOfflineStore((state) => state.pendingCount);
  const conflictCount = useAdminOfflineStore((state) => state.conflictCount);
  const authenticated = status === "authenticated" || status === "offline-owner";
  const offlineOwner = status === "offline-owner";
  const [tab, setTab] = useState<Tab>("content");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!authenticated && status !== "checking") window.setTimeout(() => input.current?.focus()); }, [authenticated, status]);
  const login = async (event: FormEvent) => {
    event.preventDefault(); if (!password || submitting) return; setSubmitting(true); setError("");
    try { await loginAction(password); setPassword(""); }
    catch (reason) { setPassword(""); setError(reason instanceof ApiClientError ? reason.message : "登录服务暂时不可用"); window.setTimeout(() => input.current?.focus()); }
    finally { setSubmitting(false); }
  };
  const logout = async () => {
    if (loggingOut) return; setLoggingOut(true);
    try { await logoutAction(); setTab("content"); }
    catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "退出失败，请稍后再试"); }
    finally { setLoggingOut(false); }
  };
  if (!authenticated) {
    return <section className="owner-panel cards is-login" aria-live="polite">
      <header className="panel-header">
        <button type="button" className="icon-button" aria-label="返回主页内容" onClick={onClose}><BackOne theme="outline" size="22" /></button>
        <span>所有者登录</span>
        <span className="header-spacer" aria-hidden="true" />
      </header>
      {status === "checking" ? <div className="panel-state">正在确认登录状态…</div> : <form className="login-form" onSubmit={(event) => void login(event)}>
        <div className={`password-control${error ? " invalid" : ""}`}>
          <input id="owner-password" ref={input} value={password} type="password" autoComplete="off" placeholder="请输入密码" aria-label="所有者密码" disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? "owner-login-error" : undefined} onChange={(event) => { setPassword(event.target.value); if (event.target.value) setError(""); }} />
          <button type="submit" aria-label="登录" disabled={submitting || !password}><ArrowRight theme="outline" size="21" /></button>
        </div>
        {error && <p id="owner-login-error" className="login-error">{error}</p>}
      </form>}
    </section>;
  }

  const activeTab = tabs.find((item) => item.key === tab)!;
  return <section className="owner-panel cards" aria-live="polite">
    <div className="owner-shell">
      <aside className="settings-sidebar">
        <div className="sidebar-heading">
          <strong>设置</strong>
          <div className="session-summary">
            <Sync theme="outline" size="18" />
            <span><strong>{offlineOwner ? "离线编辑模式" : getAdminOfflineLabel({ flushing, pendingCount, conflictCount })}</strong><small>{device?.name || "当前设备"}</small></span>
          </div>
        </div>
        <nav className="settings-tabs" aria-label="设置分类">
          {tabs.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} type="button" disabled={offlineOwner && item.key === "security"} className={tab === item.key ? "active" : ""} aria-current={tab === item.key ? "page" : undefined} onClick={() => setTab(item.key)}><Icon theme="outline" size="19" /><span>{item.label}</span></button>;
          })}
        </nav>
        <button type="button" className="sidebar-logout" aria-label="退出登录" title="退出登录" disabled={loggingOut || offlineOwner} onClick={() => void logout()}><Logout theme="outline" size="19" /><span>{offlineOwner ? "离线状态" : loggingOut ? "退出中…" : "退出登录"}</span></button>
      </aside>
      <div className="settings-main">
        <header className="settings-main-header">
          <h2>{activeTab.label}</h2>
          <button type="button" className="icon-button" aria-label="关闭设置" title="关闭设置" onClick={onClose}><CloseSmall theme="outline" size="23" /></button>
        </header>
        <div className="settings-content">
          {tab === "content" ? <ContentSettings /> : <SecuritySettings onLoggedOut={() => setTab("content")} />}
        </div>
      </div>
    </div>
  </section>;
}
