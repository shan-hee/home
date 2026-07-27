import { useCallback, useEffect, useState } from "react";
import { ApiClientError, requestJson } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import "@/components/SecuritySettings.scss";

interface DeviceRecord { id: string; name: string; userAgent: string; createdAt: string; lastSeenAt: string; revokedAt: string | null; activeSessions: number; current: boolean }
interface AuditEntry { id: number; action: string; target: string; details: unknown; deviceId: string | null; createdAt: string }
const formatTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date); };
const actionNames: Record<string, string> = { "auth.login": "登录", "auth.logout": "退出登录", "auth.logout_all": "注销全部设备", "device.revoke": "撤销设备", "content.update": "更新站点内容" };

export default function SecuritySettings({ onLoggedOut }: { onLoggedOut: () => void }) {
  const expire = useAuthStore((state) => state.expireSession);
  const logoutAll = useAuthStore((state) => state.logoutAll);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [deviceTab, setDeviceTab] = useState<"available" | "revoked">("available");
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<{ message: string; error: boolean }>({ message: "", error: false });
  const unauthorized = useCallback((reason: unknown) => { if (reason instanceof ApiClientError && reason.status === 401) { expire(); onLoggedOut(); return true; } return false; }, [expire, onLoggedOut]);
  const load = useCallback(async () => {
    if (loading) return; setLoading(true); setError("");
    try { const [deviceResult, auditResult] = await Promise.all([requestJson<{ devices: DeviceRecord[] }>("/api/admin/devices"), requestJson<{ entries: AuditEntry[] }>("/api/admin/audit")]); setDevices(deviceResult.devices); setAudit(auditResult.entries); }
    catch (reason) { if (!unauthorized(reason)) setError(reason instanceof ApiClientError ? reason.message : "设备信息暂时无法读取"); }
    finally { setLoading(false); }
  }, [loading, unauthorized]);
  useEffect(() => { void load(); }, []);
  const revoke = async (device: DeviceRecord) => {
    if (revoking) return; setRevoking(device.id); setAction({ message: "", error: false });
    try { const result = await requestJson<{ currentSessionRevoked: boolean }>(`/api/admin/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" }); if (result.currentSessionRevoked) { expire(); onLoggedOut(); } else { setDevices((items) => items.map((item) => item.id === device.id ? { ...item, revokedAt: new Date().toISOString(), activeSessions: 0 } : item)); } }
    catch (reason) { if (!unauthorized(reason)) setAction({ message: reason instanceof ApiClientError ? reason.message : "撤销设备失败", error: true }); }
    finally { setRevoking(""); }
  };
  const logoutEverywhere = async () => {
    if (loggingOut) return; setLoggingOut(true); setAction({ message: "", error: false });
    try { await logoutAll(); onLoggedOut(); }
    catch (reason) { if (!unauthorized(reason)) setAction({ message: reason instanceof ApiClientError ? reason.message : "注销全部设备失败", error: true }); }
    finally { setLoggingOut(false); }
  };
  const availableDevices = devices.filter((device) => !device.revokedAt);
  const revokedDevices = devices.filter((device) => Boolean(device.revokedAt));
  const visibleDevices = deviceTab === "available" ? availableDevices : revokedDevices;

  return <div className="security-settings">
    <section className="security-section">
      <div className="section-heading"><div><strong>登录设备</strong><small>撤销设备会立即注销该设备上的所有会话</small></div><button type="button" className="text-button" disabled={loading} onClick={() => void load()}>{loading ? "加载中…" : "刷新"}</button></div>
      <div className="device-tabs" role="tablist" aria-label="登录设备状态">
        <button type="button" role="tab" aria-selected={deviceTab === "available"} className={deviceTab === "available" ? "is-active" : ""} onClick={() => setDeviceTab("available")}>可用设备 <span>{availableDevices.length}</span></button>
        <button type="button" role="tab" aria-selected={deviceTab === "revoked"} className={deviceTab === "revoked" ? "is-active" : ""} onClick={() => setDeviceTab("revoked")}>已撤销 <span>{revokedDevices.length}</span></button>
      </div>
      {error
        ? <p className="inline-error">{error}</p>
        : !visibleDevices.length
          ? <div className="empty-state">{loading ? "正在读取设备…" : deviceTab === "available" ? "暂无可用设备" : "暂无已撤销设备"}</div>
          : visibleDevices.map((device) => <article key={device.id} className="device-row"><div><strong>{device.name} {device.current && <span>当前设备</span>}</strong><small>{device.revokedAt ? `撤销于 ${formatTime(device.revokedAt)} · 最近使用 ${formatTime(device.lastSeenAt)}` : `最近使用 ${formatTime(device.lastSeenAt)} · ${device.activeSessions} 个活动会话`}</small></div>{device.revokedAt ? <span className="device-status">已撤销</span> : <button type="button" className="danger-button" disabled={revoking === device.id} onClick={() => void revoke(device)}>{revoking === device.id ? "撤销中…" : "撤销"}</button>}</article>)}
    </section>
    <section className="security-section"><div className="section-heading"><div><strong>会话安全</strong><small>所有者密码只存在于 Cloudflare Secret，不会写入 D1</small></div></div><p className="security-note">如需修改密码，请更新部署环境中的 <code>OWNER_PASSWORD</code>，重新加载服务后注销全部设备，使旧会话立即失效。</p><button type="button" className="logout-all" disabled={loggingOut} onClick={() => void logoutEverywhere()}>{loggingOut ? "正在注销…" : "注销全部设备"}</button>{action.message && <p className={action.error ? "inline-error" : "action-message"}>{action.message}</p>}</section>
    <section className="security-section"><div className="section-heading"><div><strong>最近操作</strong><small>最多显示最近 100 条，完整记录保留 180 天</small></div></div>{audit.length ? <ol className="audit-list">{audit.map((entry) => <li key={entry.id}><div><strong>{actionNames[entry.action] || entry.action}</strong><span>{entry.target}</span></div><time>{formatTime(entry.createdAt)}</time></li>)}</ol> : <div className="empty-state">暂无审计记录</div>}</section>
  </div>;
}
