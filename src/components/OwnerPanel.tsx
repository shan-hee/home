import { ArrowRight, BackOne, CloseSmall, Devices, IdCardH, Info, Logout, Music, PictureAlbum, Quote, SettingTwo, Sync } from "@icon-park/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import { getAdminOfflineLabel, useAdminOfflineStore } from "@/stores/adminOffline";
import ContentSettings, { type ContentSettingsView } from "@/components/ContentSettings";
import SecuritySettings from "@/components/SecuritySettings";
import "@/components/OwnerPanel.scss";

type Tab = ContentSettingsView | "security";
const tabs = [
  { key: "general", label: "常规设置", icon: SettingTwo },
  { key: "wallpaper", label: "壁纸管理", icon: PictureAlbum },
  { key: "profile", label: "站点资料", icon: IdCardH },
  { key: "music", label: "音乐设置", icon: Music },
  { key: "hitokoto", label: "一言设置", icon: Quote },
  { key: "security", label: "设备安全", icon: Devices },
  { key: "about", label: "关于", icon: Info },
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
  const [tab, setTab] = useState<Tab>("general");
  const [contentTab, setContentTab] = useState<ContentSettingsView>("general");
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
    try { await logoutAction(); setTab("general"); setContentTab("general"); }
    catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "退出失败，请稍后再试"); }
    finally { setLoggingOut(false); }
  };
  if (!authenticated) {
    return <section className="owner-panel cards is-login" aria-live="polite">
      <header className="panel-header">
        <button type="button" className="icon-button" aria-label="返回主页内容" onClick={onClose}><BackOne theme="outline" size="22" /></button>
        <span>管理员登录</span>
        <span className="header-spacer" aria-hidden="true" />
      </header>
      {status === "checking" ? <div className="panel-state">正在确认登录状态…</div> : <form className="login-form" onSubmit={(event) => void login(event)}>
        <div className={`password-control${error ? " invalid" : ""}`}>
          <input id="owner-password" ref={input} value={password} type="password" autoComplete="off" placeholder="请输入密码" aria-label="管理员密码" disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? "owner-login-error" : undefined} onChange={(event) => { setPassword(event.target.value); if (event.target.value) setError(""); }} />
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
            return <button key={item.key} type="button" disabled={offlineOwner && item.key === "security"} className={tab === item.key ? "active" : ""} aria-current={tab === item.key ? "page" : undefined} onClick={() => { setTab(item.key); if (item.key !== "security") setContentTab(item.key); }}><Icon theme="outline" size="19" /><span>{item.label}</span></button>;
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
          <div hidden={tab === "security"}><ContentSettings view={contentTab} /></div>
          {tab === "security" && <SecuritySettings onLoggedOut={() => { setTab("general"); setContentTab("general"); }} />}
        </div>
      </div>
    </div>
  </section>;
}
