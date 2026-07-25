import { useCallback, useEffect, useState } from "react";
import { ApiClientError, requestJson } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import type { SiteContentSections, SiteContentSnapshot } from "@/typings/siteContent";
import "@/components/ContentSettings.scss";

type Section = keyof SiteContentSections;
type SaveState = { saving: boolean; message: string; error: boolean };
const keys: Section[] = ["profile", "siteLinks", "socialLinks", "music", "wallpaper", "hitokoto"];
const initialStates = () => Object.fromEntries(keys.map((key) => [key, { saving: false, message: "", error: false }])) as Record<Section, SaveState>;

function SaveRow({ state, onSave }: { state: SaveState; onSave: () => void }) {
  return <div className="save-row"><span className={state.error ? "save-error" : "save-message"}>{state.message}</span><button type="button" className="save-button" disabled={state.saving} onClick={onSave}>{state.saving ? "保存中…" : "保存本节"}</button></div>;
}

export default function ContentSettings() {
  const expire = useAuthStore((state) => state.expireSession);
  const refresh = useSiteContentStore((state) => state.refresh);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [snapshot, setSnapshot] = useState<SiteContentSnapshot | null>(null);
  const [drafts, setDrafts] = useState<SiteContentSections | null>(null);
  const [saveStates, setSaveStates] = useState(initialStates);
  const update = (mutator: (draft: SiteContentSections) => void) => setDrafts((current) => { if (!current) return current; const next = structuredClone(current); mutator(next); return next; });
  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try { const result = await requestJson<SiteContentSnapshot>("/api/admin/content"); setSnapshot(result); setDrafts(structuredClone(result.sections)); setSaveStates(initialStates()); }
    catch (reason) { if (reason instanceof ApiClientError && reason.status === 401) expire(); setLoadError(reason instanceof ApiClientError ? reason.message : "站点内容暂时无法读取"); }
    finally { setLoading(false); }
  }, [expire]);
  useEffect(() => { void load(); }, [load]);
  const save = async (section: Section) => {
    if (!snapshot || !drafts || saveStates[section].saving) return;
    setSaveStates((states) => ({ ...states, [section]: { saving: true, message: "", error: false } }));
    try {
      const result = await requestJson<{ section: Section; content: SiteContentSections[Section]; revision: number }>(`/api/admin/content/${section}`, { method: "PUT", body: JSON.stringify({ baseRevision: snapshot.sectionRevisions[section], content: drafts[section] }) });
      setSnapshot((current) => current ? { ...current, sectionRevisions: { ...current.sectionRevisions, [section]: result.revision }, sections: { ...current.sections, [section]: structuredClone(result.content) } as SiteContentSections } : current);
      setDrafts((current) => current ? { ...current, [section]: structuredClone(result.content) } as SiteContentSections : current);
      setSaveStates((states) => ({ ...states, [section]: { saving: false, message: "已保存", error: false } }));
      void refresh();
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 401) expire();
      const message = reason instanceof ApiClientError ? (reason.status === 409 ? "内容已在其它页面更新，请重新加载后再编辑" : reason.message) : "保存失败，请稍后再试";
      setSaveStates((states) => ({ ...states, [section]: { saving: false, message, error: true } }));
    }
  };
  if (loadError) return <div className="content-settings"><div className="section-heading"><div><strong>站点内容</strong><small>保存后公开页面会在后台刷新，无需重启服务</small></div><button type="button" className="text-button" disabled={loading} onClick={() => void load()}>重新加载</button></div><p className="inline-error">{loadError}</p></div>;
  if (!drafts) return <div className="content-settings"><div className="empty-state">正在读取站点内容…</div></div>;
  const profile = drafts.profile;
  const profileFields: Array<[keyof typeof profile, string, "text" | "url" | "textarea", boolean?]> = [["siteName", "站点名称", "text"], ["author", "作者", "text"], ["mainName", "主页名称", "text"], ["siteUrl", "站点地址", "url"], ["keywords", "关键词", "text", true], ["description", "简介", "textarea", true], ["siteLogo", "站点图标", "text"], ["mainLogo", "主页图标", "text"], ["appleLogo", "Apple 图标", "text"], ["startDate", "建站日期", "text"], ["icp", "ICP备案号", "text"], ["mps", "公安备案号", "text"], ["repositoryUrl", "代码仓库", "url", true]];
  return <div className="content-settings"><div className="section-heading"><div><strong>站点内容</strong><small>保存后公开页面会在后台刷新，无需重启服务</small></div><button type="button" className="text-button" disabled={loading} onClick={() => void load()}>{loading ? "加载中…" : "重新加载"}</button></div><div className="admin-collapse">
    <details open><summary>站点资料</summary><div className="admin-section"><div className="form-grid">{profileFields.map(([field, label, type, wide]) => <label key={field} className={wide ? "wide" : ""}>{label}{type === "textarea" ? <textarea value={profile[field]} rows={2} onChange={(event) => update((draft) => { draft.profile[field] = event.target.value; })} /> : <input value={profile[field]} type={type} placeholder={field === "startDate" ? "YYYY-MM-DD" : undefined} onChange={(event) => update((draft) => { draft.profile[field] = event.target.value; })} />}</label>)}</div><SaveRow state={saveStates.profile} onSave={() => void save("profile")} /></div></details>
    <details><summary>音乐来源</summary><div className="admin-section"><div className="form-grid"><label>平台<select value={drafts.music.server} onChange={(event) => update((draft) => { draft.music.server = event.target.value as SiteContentSections["music"]["server"]; })}><option value="netease">网易云音乐</option><option value="tencent">QQ 音乐</option></select></label><label>类型<select value={drafts.music.type} onChange={(event) => update((draft) => { draft.music.type = event.target.value as SiteContentSections["music"]["type"]; })}><option value="playlist">歌单</option><option value="song">单曲</option></select></label><label className="wide">音乐 ID<input value={drafts.music.id} onChange={(event) => update((draft) => { draft.music.id = event.target.value; })} /></label></div><SaveRow state={saveStates.music} onSave={() => void save("music")} /></div></details>
    <details><summary>壁纸资源</summary><div className="admin-section"><div className="form-grid"><label>配置版本<input type="number" min="1" value={drafts.wallpaper.version} onChange={(event) => update((draft) => { draft.wallpaper.version = Number(event.target.value); })} /></label></div>{(["desktop", "mobile"] as const).map((target) => <div key={target} className="list-editor"><div className="list-editor-head"><strong>{target === "desktop" ? "桌面端" : "移动端"}</strong></div><div className="form-grid compact"><label>数量<input type="number" min="1" max="200" value={drafts.wallpaper[target].count} onChange={(event) => update((draft) => { draft.wallpaper[target].count = Number(event.target.value); })} /></label><label className="wide">路径模板<input value={drafts.wallpaper[target].pattern} onChange={(event) => update((draft) => { draft.wallpaper[target].pattern = event.target.value; })} /></label><label className="wide">回退图片<input value={drafts.wallpaper[target].fallback} onChange={(event) => update((draft) => { draft.wallpaper[target].fallback = event.target.value; })} /></label></div></div>)}<SaveRow state={saveStates.wallpaper} onSave={() => void save("wallpaper")} /></div></details>
    <details><summary>一言</summary><div className="admin-section"><div className="form-grid"><label>模式<select value={drafts.hitokoto.mode} onChange={(event) => update((draft) => { draft.hitokoto.mode = event.target.value as SiteContentSections["hitokoto"]["mode"]; })}><option value="remote">远程一言</option><option value="fixed">固定内容</option></select></label><label className="wide">远程分类（逗号分隔）<input value={drafts.hitokoto.categories.join(", ")} onChange={(event) => update((draft) => { draft.hitokoto.categories = event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean); })} /></label><label className="wide">固定内容<textarea rows={2} value={drafts.hitokoto.fixedText} onChange={(event) => update((draft) => { draft.hitokoto.fixedText = event.target.value; })} /></label><label>固定内容来源<input value={drafts.hitokoto.fixedFrom} onChange={(event) => update((draft) => { draft.hitokoto.fixedFrom = event.target.value; })} /></label><label className="wide">失败时内容<textarea rows={2} value={drafts.hitokoto.fallbackText} onChange={(event) => update((draft) => { draft.hitokoto.fallbackText = event.target.value; })} /></label><label>失败时来源<input value={drafts.hitokoto.fallbackFrom} onChange={(event) => update((draft) => { draft.hitokoto.fallbackFrom = event.target.value; })} /></label></div><SaveRow state={saveStates.hitokoto} onSave={() => void save("hitokoto")} /></div></details>
  </div></div>;
}
