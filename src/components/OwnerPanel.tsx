import { ArrowRight, BackOne, Logout } from "@icon-park/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import { getSyncStatusLabel, useSettingsSyncStore } from "@/stores/settingsSync";
import Set from "@/components/Set";
import ContentSettings from "@/components/ContentSettings";
import SecuritySettings from "@/components/SecuritySettings";
import "@/components/OwnerPanel.scss";

type Tab = "preferences" | "content" | "security";
export default function OwnerPanel({ onClose }: { onClose: () => void }) {
  const status = useAuthStore((state) => state.status);
  const device = useAuthStore((state) => state.device);
  const loginAction = useAuthStore((state) => state.login);
  const logoutAction = useAuthStore((state) => state.logout);
  const syncStatus = useSettingsSyncStore((state) => state.status);
  const pendingMutations = useSettingsSyncStore((state) => state.pendingMutations);
  const authenticated = status === "authenticated";
  const [tab, setTab] = useState<Tab>("preferences");
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
    try { await logoutAction(); setTab("preferences"); }
    catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "退出失败，请稍后再试"); }
    finally { setLoggingOut(false); }
  };
  return <section className={`owner-panel cards${authenticated ? "" : " is-login"}`} aria-live="polite"><header className="panel-header"><button type="button" className="icon-button" aria-label="返回主页内容" onClick={onClose}><BackOne theme="outline" size="22" /></button><span>{authenticated ? "设置" : "所有者登录"}</span>{authenticated ? <button type="button" className="icon-button" aria-label="退出登录" disabled={loggingOut} onClick={() => void logout()}><Logout theme="outline" size="21" /></button> : <span className="header-spacer" aria-hidden="true" />}</header>{status === "checking" ? <div className="panel-state">正在确认登录状态…</div> : !authenticated ? <form className="login-form" onSubmit={(event) => void login(event)}><div className={`password-control${error ? " invalid" : ""}`}><input id="owner-password" ref={input} value={password} type="password" autoComplete="off" placeholder="请输入密码" aria-label="所有者密码" disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? "owner-login-error" : undefined} onChange={(event) => { setPassword(event.target.value); if (event.target.value) setError(""); }} /><button type="submit" aria-label="登录" disabled={submitting || !password}><ArrowRight theme="outline" size="21" /></button></div>{error && <p id="owner-login-error" className="login-error">{error}</p>}</form> : <div className="settings-content"><div className="session-summary"><span>{getSyncStatusLabel({ status: syncStatus, pendingMutations })}</span><small>{device?.name || "当前设备"}</small></div><nav className="settings-tabs" aria-label="设置分类">{([{ key: "preferences", label: "偏好" }, { key: "content", label: "内容" }, { key: "security", label: "设备" }] as const).map((item) => <button key={item.key} type="button" className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>{item.label}</button>)}</nav>{tab === "preferences" ? <Set /> : tab === "content" ? <ContentSettings /> : <SecuritySettings onLoggedOut={() => setTab("preferences")} />}</div>}</section>;
}
