import { useCallback, useEffect, useState } from "react";
import { Delete, Upload } from "@icon-park/react";
import { ApiClientError, requestJson } from "@/services/apiClient";
import { useAdminOfflineStore } from "@/stores/adminOffline";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import type { SiteContentSections, SiteContentSnapshot } from "@/typings/siteContent";
import "@/components/ContentSettings.scss";

type Section = keyof SiteContentSections;
type SaveState = { saving: boolean; message: string; error: boolean };
interface AssetRecord {
  id: string;
  variant: "desktop" | "mobile";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

const keys: Section[] = ["profile", "siteLinks", "socialLinks", "music", "wallpaper", "preferences", "hitokoto"];
const initialStates = () => Object.fromEntries(keys.map((key) => [key, { saving: false, message: "", error: false }])) as Record<Section, SaveState>;

function SaveRow({ state, dirty, onSave, onDiscard }: { state: SaveState; dirty: boolean; onSave: () => void; onDiscard: () => void }) {
  return <div className="save-row"><span className={state.error ? "save-error" : "save-message"}>{state.message}</span><div className="save-actions"><button type="button" disabled={!dirty || state.saving} onClick={onDiscard}>放弃草稿</button><button type="button" className="save-button" disabled={!dirty || state.saving} onClick={onSave}>{state.saving ? "保存中…" : "保存本节"}</button></div></div>;
}

const formatSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
const selectedWallpaperId = (wallpaper: SiteContentSections["wallpaper"], variant: AssetRecord["variant"]) => variant === "desktop" ? wallpaper.desktopAssetId : wallpaper.mobileAssetId;
const setSelectedWallpaperId = (wallpaper: SiteContentSections["wallpaper"], variant: AssetRecord["variant"], id: string | null) => {
  if (variant === "desktop") wallpaper.desktopAssetId = id;
  else wallpaper.mobileAssetId = id;
};

export default function ContentSettings() {
  const authStatus = useAuthStore((state) => state.status);
  const expire = useAuthStore((state) => state.expireSession);
  const publicSnapshot = useSiteContentStore((state) => state.snapshot);
  const refresh = useSiteContentStore((state) => state.refresh);
  const saveSection = useAdminOfflineStore((state) => state.saveSection);
  const saveDraft = useAdminOfflineStore((state) => state.saveDraft);
  const loadDraft = useAdminOfflineStore((state) => state.loadDraft);
  const discardSection = useAdminOfflineStore((state) => state.discardSection);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [snapshot, setSnapshot] = useState<SiteContentSnapshot | null>(null);
  const [drafts, setDrafts] = useState<SiteContentSections | null>(null);
  const [saveStates, setSaveStates] = useState(initialStates);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetMessage, setAssetMessage] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const offline = authStatus === "offline-owner";

  const update = (mutator: (draft: SiteContentSections) => void) => setDrafts((current) => {
    if (!current) return current;
    const next = structuredClone(current);
    mutator(next);
    return next;
  });

  const restoreDrafts = useCallback(async (base: SiteContentSnapshot) => {
    const next = structuredClone(base.sections);
    const states = initialStates();
    await Promise.all(keys.map(async (section) => {
      const draft = await loadDraft(section);
      if (!draft) return;
      (next as Record<string, unknown>)[section] = structuredClone(draft.editedContent);
      states[section] = {
        saving: false,
        message: draft.baseRevision === base.sectionRevisions[section] ? "已恢复本机草稿" : "草稿基于旧版本，保存时可能发生冲突",
        error: draft.baseRevision !== base.sectionRevisions[section],
      };
    }));
    setSnapshot(base);
    setDrafts(next);
    setSaveStates(states);
  }, [loadDraft]);

  const loadAssets = useCallback(async () => {
    if (offline) return;
    const result = await requestJson<{ assets: AssetRecord[] }>("/api/admin/assets");
    setAssets(result.assets);
  }, [offline]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      if (offline) {
        await restoreDrafts(structuredClone(publicSnapshot));
        setAssetMessage("离线时可以编辑配置，但上传和删除壁纸需要联网");
      } else {
        const result = await requestJson<SiteContentSnapshot>("/api/admin/content");
        await restoreDrafts(result);
        await loadAssets();
      }
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 401) expire();
      setLoadError(reason instanceof ApiClientError ? reason.message : "站点设置暂时无法读取");
    } finally {
      setLoading(false);
    }
  }, [expire, loadAssets, offline, publicSnapshot, restoreDrafts]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!snapshot || !drafts) return;
    const timer = window.setTimeout(() => {
      keys.forEach((section) => {
        if (JSON.stringify(snapshot.sections[section]) === JSON.stringify(drafts[section])) return;
        void saveDraft(section, snapshot.sectionRevisions[section], snapshot.sections[section] as never, drafts[section] as never);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [drafts, saveDraft, snapshot]);

  const save = async (section: Section) => {
    if (!snapshot || !drafts || saveStates[section].saving) return;
    setSaveStates((states) => ({ ...states, [section]: { saving: true, message: "", error: false } }));
    try {
      const outcome = await saveSection(section, snapshot.sectionRevisions[section], snapshot.sections[section] as never, drafts[section] as never);
      if (outcome.status === "queued") {
        setSaveStates((states) => ({ ...states, [section]: { saving: false, message: "已保存到本机，联网后自动提交", error: false } }));
        return;
      }
      const result = outcome.result;
      setSnapshot((current) => current ? { ...current, sectionRevisions: { ...current.sectionRevisions, [section]: result.revision }, sections: { ...current.sections, [section]: structuredClone(result.content) } as SiteContentSections } : current);
      setDrafts((current) => current ? { ...current, [section]: structuredClone(result.content) } as SiteContentSections : current);
      setSaveStates((states) => ({ ...states, [section]: { saving: false, message: "已保存", error: false } }));
      void refresh();
    } catch (reason) {
      const message = reason instanceof ApiClientError ? (reason.status === 409 ? "服务器内容已更新，本机草稿已保留，请重新加载后决定是否覆盖" : reason.message) : "保存失败，请稍后再试";
      setSaveStates((states) => ({ ...states, [section]: { saving: false, message, error: true } }));
    }
  };

  const dirty = (section: Section) => Boolean(snapshot) && JSON.stringify(snapshot!.sections[section]) !== JSON.stringify(drafts?.[section]);
  const discard = async (section: Section) => {
    if (!snapshot) return;
    await discardSection(section);
    setDrafts((current) => current ? { ...current, [section]: structuredClone(snapshot.sections[section]) } as SiteContentSections : current);
    setSaveStates((states) => ({ ...states, [section]: { saving: false, message: "已放弃本机草稿", error: false } }));
  };

  const uploadAsset = async (variant: AssetRecord["variant"], file: File | undefined) => {
    if (!file || offline || assetBusy) return;
    setAssetBusy(true); setAssetMessage("");
    const body = new FormData(); body.set("variant", variant); body.set("file", file);
    try {
      const response = await fetch("/api/admin/assets", { method: "POST", body, credentials: "same-origin" });
      const payload = await response.json() as { asset?: AssetRecord; error?: { message?: string } };
      if (!response.ok || !payload.asset) throw new Error(payload.error?.message || "上传失败");
      setAssets((current) => [payload.asset!, ...current]);
      update((draft) => { setSelectedWallpaperId(draft.wallpaper, variant, payload.asset!.id); });
      setAssetMessage("壁纸已上传并选中，保存本节后对外生效");
    } catch (reason) {
      setAssetMessage(reason instanceof Error ? reason.message : "壁纸上传失败");
    } finally { setAssetBusy(false); }
  };

  const deleteAsset = async (asset: AssetRecord) => {
    if (offline || assetBusy) return;
    setAssetBusy(true); setAssetMessage("");
    try {
      await requestJson(`/api/admin/assets/${asset.id}`, { method: "DELETE" });
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setAssetMessage("壁纸资源已删除");
    } catch (reason) {
      setAssetMessage(reason instanceof ApiClientError ? reason.message : "壁纸删除失败");
    } finally { setAssetBusy(false); }
  };

  if (loadError) return <div className="content-settings"><div className="section-heading"><div><strong>站点设置</strong><small>在线内容以服务器为准，离线修改会保留在当前设备</small></div><button type="button" className="text-button" disabled={loading} onClick={() => void load()}>重新加载</button></div><p className="inline-error">{loadError}</p></div>;
  if (!drafts) return <div className="content-settings"><div className="empty-state">正在读取站点设置…</div></div>;
  const profile = drafts.profile;
  const preferences = drafts.preferences;
  const assetOptions = (variant: AssetRecord["variant"]) => {
    const current = assets.filter((asset) => asset.variant === variant);
    const selectedId = selectedWallpaperId(drafts.wallpaper, variant);
    if (!selectedId || current.some((asset) => asset.id === selectedId)) return current;
    return [{
      id: selectedId,
      variant,
      originalName: "当前已选壁纸",
      mimeType: "image/*",
      sizeBytes: 0,
      createdAt: "",
      url: `/api/assets/${selectedId}`,
    }, ...current];
  };
  const profileFields: Array<[keyof typeof profile, string, "text" | "url" | "textarea", boolean?]> = [["siteName", "站点名称", "text"], ["author", "作者", "text"], ["mainName", "主页名称", "text"], ["siteUrl", "站点地址", "url"], ["keywords", "关键词", "text", true], ["description", "简介", "textarea", true], ["siteLogo", "站点图标", "text"], ["mainLogo", "主页图标", "text"], ["appleLogo", "Apple 图标", "text"], ["startDate", "建站日期", "text"], ["icp", "ICP备案号", "text"], ["mps", "公安备案号", "text"], ["repositoryUrl", "代码仓库", "url", true]];

  return <div className="content-settings"><div className="section-heading"><div><strong>站点设置</strong><small>{offline ? "当前离线，保存操作会留在本机等待提交" : "保存后公开页面自动刷新，无需重新部署"}</small></div><button type="button" className="text-button" disabled={loading} onClick={() => void load()}>{loading ? "加载中…" : "重新加载"}</button></div><div className="admin-collapse">
    <details open><summary>全局行为</summary><div className="admin-section"><div className="form-grid">
      <label>建站日期显示<select value={String(preferences.siteStartShow)} onChange={(event) => update((draft) => { draft.preferences.siteStartShow = event.target.value === "true"; })}><option value="true">显示</option><option value="false">隐藏</option></select></label>
      <label>底栏背景模糊<select value={String(preferences.footerBlur)} onChange={(event) => update((draft) => { draft.preferences.footerBlur = event.target.value === "true"; })}><option value="true">开启</option><option value="false">关闭</option></select></label>
      <label>主页名称显示<select value={String(preferences.messageNameShow)} onChange={(event) => update((draft) => { draft.preferences.messageNameShow = event.target.value === "true"; })}><option value="false">显示域名</option><option value="true">显示主页名称</option></select></label>
      <label>自动播放<select value={String(preferences.playerAutoplay)} onChange={(event) => update((draft) => { draft.preferences.playerAutoplay = event.target.value === "true"; })}><option value="false">关闭</option><option value="true">开启</option></select></label>
      <label>播放器快捷键<select value={String(preferences.playerKeyboardShortcuts)} onChange={(event) => update((draft) => { draft.preferences.playerKeyboardShortcuts = event.target.value === "true"; })}><option value="true">开启</option><option value="false">关闭</option></select></label>
      <label>默认播放顺序<select value={preferences.playerDefaultOrder} onChange={(event) => update((draft) => { draft.preferences.playerDefaultOrder = event.target.value as typeof preferences.playerDefaultOrder; })}><option value="shuffle">随机</option><option value="list">顺序</option><option value="single">单曲循环</option></select></label>
      <label>默认音量<input type="number" min="0" max="1" step="0.05" value={preferences.playerDefaultVolume} onChange={(event) => update((draft) => { draft.preferences.playerDefaultVolume = Number(event.target.value); })} /></label>
      <label>天气城市<input value={preferences.weatherLocation?.city || ""} placeholder="留空使用访问者 IP 粗定位" onChange={(event) => update((draft) => { const city = event.target.value; draft.preferences.weatherLocation = city ? { city, latitude: draft.preferences.weatherLocation?.latitude || 0, longitude: draft.preferences.weatherLocation?.longitude || 0 } : null; })} /></label>
      <label>纬度<input type="number" min="-90" max="90" step="0.01" disabled={!preferences.weatherLocation} value={preferences.weatherLocation?.latitude ?? ""} onChange={(event) => update((draft) => { if (draft.preferences.weatherLocation) draft.preferences.weatherLocation.latitude = Number(event.target.value); })} /></label>
      <label>经度<input type="number" min="-180" max="180" step="0.01" disabled={!preferences.weatherLocation} value={preferences.weatherLocation?.longitude ?? ""} onChange={(event) => update((draft) => { if (draft.preferences.weatherLocation) draft.preferences.weatherLocation.longitude = Number(event.target.value); })} /></label>
    </div><SaveRow state={saveStates.preferences} dirty={dirty("preferences")} onSave={() => void save("preferences")} onDiscard={() => void discard("preferences")} /></div></details>
    <details><summary>壁纸资源</summary><div className="admin-section"><div className="wallpaper-upload-row">{(["desktop", "mobile"] as const).map((variant) => <label key={variant} className="upload-button"><Upload theme="outline" size="18" /><span>{variant === "desktop" ? "上传桌面壁纸" : "上传移动端壁纸"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={offline || assetBusy} onChange={(event) => { void uploadAsset(variant, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>)}</div>{assetMessage && <p className="asset-message">{assetMessage}</p>}{(["desktop", "mobile"] as const).map((variant) => <div key={variant} className="asset-group"><strong>{variant === "desktop" ? "桌面端" : "移动端"}</strong><div className="asset-list"><div className={`asset-option asset-option-empty${!selectedWallpaperId(drafts.wallpaper, variant) ? " selected" : ""}`}><label><input type="radio" name={`${variant}-wallpaper`} checked={!selectedWallpaperId(drafts.wallpaper, variant)} onChange={() => update((draft) => { setSelectedWallpaperId(draft.wallpaper, variant, null); })} /><span className="asset-empty">纯色</span><span><strong>纯色背景</strong><small>不加载壁纸资源</small></span></label></div>{assetOptions(variant).map((asset) => <div key={asset.id} className={`asset-option${selectedWallpaperId(drafts.wallpaper, variant) === asset.id ? " selected" : ""}`}><label><input type="radio" name={`${variant}-wallpaper`} checked={selectedWallpaperId(drafts.wallpaper, variant) === asset.id} onChange={() => update((draft) => { setSelectedWallpaperId(draft.wallpaper, variant, asset.id); })} /><img src={asset.url} alt="" /><span><strong>{asset.originalName}</strong><small>{asset.sizeBytes ? formatSize(asset.sizeBytes) : "离线缓存资源"}</small></span></label><button type="button" title="删除壁纸" aria-label={`删除 ${asset.originalName}`} disabled={assetBusy || !asset.createdAt || drafts.wallpaper.desktopAssetId === asset.id || drafts.wallpaper.mobileAssetId === asset.id} onClick={() => void deleteAsset(asset)}><Delete theme="outline" size="17" /></button></div>)}</div></div>)}<SaveRow state={saveStates.wallpaper} dirty={dirty("wallpaper")} onSave={() => void save("wallpaper")} onDiscard={() => void discard("wallpaper")} /></div></details>
    <details><summary>站点资料</summary><div className="admin-section"><div className="form-grid">{profileFields.map(([field, label, type, wide]) => <label key={field} className={wide ? "wide" : ""}>{label}{type === "textarea" ? <textarea value={profile[field]} rows={2} onChange={(event) => update((draft) => { draft.profile[field] = event.target.value; })} /> : <input value={profile[field]} type={type} placeholder={field === "startDate" ? "YYYY-MM-DD" : undefined} onChange={(event) => update((draft) => { draft.profile[field] = event.target.value; })} />}</label>)}</div><SaveRow state={saveStates.profile} dirty={dirty("profile")} onSave={() => void save("profile")} onDiscard={() => void discard("profile")} /></div></details>
    <details><summary>音乐来源</summary><div className="admin-section"><div className="form-grid"><label>平台<select value={drafts.music.server} onChange={(event) => update((draft) => { draft.music.server = event.target.value as SiteContentSections["music"]["server"]; })}><option value="netease">网易云音乐</option><option value="tencent">QQ 音乐</option></select></label><label>类型<select value={drafts.music.type} onChange={(event) => update((draft) => { draft.music.type = event.target.value as SiteContentSections["music"]["type"]; })}><option value="playlist">歌单</option><option value="song">单曲</option></select></label><label className="wide">音乐 ID<input value={drafts.music.id} onChange={(event) => update((draft) => { draft.music.id = event.target.value; })} /></label></div><SaveRow state={saveStates.music} dirty={dirty("music")} onSave={() => void save("music")} onDiscard={() => void discard("music")} /></div></details>
    <details><summary>一言</summary><div className="admin-section"><div className="form-grid"><label>模式<select value={drafts.hitokoto.mode} onChange={(event) => update((draft) => { draft.hitokoto.mode = event.target.value as SiteContentSections["hitokoto"]["mode"]; })}><option value="remote">远程一言</option><option value="fixed">固定内容</option></select></label><label className="wide">远程分类（逗号分隔）<input value={drafts.hitokoto.categories.join(", ")} onChange={(event) => update((draft) => { draft.hitokoto.categories = event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean); })} /></label><label className="wide">固定内容<textarea rows={2} value={drafts.hitokoto.fixedText} onChange={(event) => update((draft) => { draft.hitokoto.fixedText = event.target.value; })} /></label><label>固定内容来源<input value={drafts.hitokoto.fixedFrom} onChange={(event) => update((draft) => { draft.hitokoto.fixedFrom = event.target.value; })} /></label><label className="wide">失败时内容<textarea rows={2} value={drafts.hitokoto.fallbackText} onChange={(event) => update((draft) => { draft.hitokoto.fallbackText = event.target.value; })} /></label><label>失败时来源<input value={drafts.hitokoto.fallbackFrom} onChange={(event) => update((draft) => { draft.hitokoto.fallbackFrom = event.target.value; })} /></label></div><SaveRow state={saveStates.hitokoto} dirty={dirty("hitokoto")} onSave={() => void save("hitokoto")} onDiscard={() => void discard("hitokoto")} /></div></details>
  </div></div>;
}
