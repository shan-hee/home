import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSmall, CloseSmall, Download, Refresh, Search, Upload } from "@icon-park/react";
import type { MusicPlaylistSummary, PlaylistItem } from "@/api";
import { ApiClientError, requestJson } from "@/services/apiClient";
import { useAdminOfflineStore } from "@/stores/adminOffline";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import ThemedSelect from "@/components/ThemedSelect";
import type { MusicContentConfig, SiteContentSections, SiteContentSnapshot } from "@/typings/siteContent";
import { checkForUpdate, type UpdateResult } from "@/utils/updatecheck";
import packageInfo from "@/../package.json";
import "@/components/ContentSettings.scss";

const appVersion = packageInfo.version;
const appVersionNumber = appVersion.match(/^(\d+\.\d+\.\d+)/)?.[1] || "0.0.0";

type Section = keyof SiteContentSections;
type SaveState = { saving: boolean; message: string; error: boolean };
type MusicPreviewState = { status: "idle" | "loading" | "success" | "error"; message: string; tracks: PlaylistItem[]; playlists: MusicPlaylistSummary[] };
type WallpaperSource = SiteContentSections["wallpaper"]["source"];
export type ContentSettingsView = "general" | "wallpaper" | "profile" | "music" | "hitokoto" | "about";
interface AssetRecord {
  id: string;
  variant: "desktop" | "mobile";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}
interface RemoteWallpaperPreview {
  source: "bing" | "wallhaven";
  variant: AssetRecord["variant"];
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
}
interface PreviewImage {
  title: string;
  subtitle: string;
  url: string;
  downloadUrl: string;
  fileName?: string;
}
type RemotePreviewState = { loading: boolean; message: string; items: RemoteWallpaperPreview[] };
type MusicPlaylistPosition = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };
type UpdateCheckState = {
  status: "idle" | "loading" | "up-to-date" | "available" | "error";
  message: string;
  result: UpdateResult | null;
};

const keys: Section[] = ["profile", "siteLinks", "socialLinks", "music", "wallpaper", "preferences", "hitokoto"];
const MAX_ASSET_SIZE = 50 * 1024 * 1024;
const initialStates = () => Object.fromEntries(keys.map((key) => [key, { saving: false, message: "", error: false }])) as Record<Section, SaveState>;
const initialMusicPreview = (): MusicPreviewState => ({ status: "idle", message: "", tracks: [], playlists: [] });
const initialRemotePreview = (): RemotePreviewState => ({ loading: false, message: "", items: [] });
const initialUpdateCheck = (): UpdateCheckState => ({ status: "idle", message: "点击按钮检查代码仓库中的最新 Release 或 Tag", result: null });
const rotationPresets = [0, 5, 15, 30, 60, 180, 360, 720, 1440] as const;

function SaveRow({ state, dirty, saveDisabled = false, onSave, onDiscard }: { state: SaveState; dirty: boolean; saveDisabled?: boolean; onSave: () => void; onDiscard: () => void }) {
  return <div className="save-row"><span className={state.error ? "save-error" : "save-message"}>{state.message}</span><div className="save-actions"><button type="button" disabled={!dirty || state.saving} onClick={onDiscard}>放弃草稿</button><button type="button" className="save-button" disabled={!dirty || state.saving || saveDisabled} onClick={onSave}>{state.saving ? "保存中…" : "保存本节"}</button></div></div>;
}

const formatSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
const selectedWallpaperId = (wallpaper: SiteContentSections["wallpaper"], variant: AssetRecord["variant"]) => variant === "desktop" ? wallpaper.desktopAssetId : wallpaper.mobileAssetId;
const setSelectedWallpaperId = (wallpaper: SiteContentSections["wallpaper"], variant: AssetRecord["variant"], id: string | null) => {
  if (variant === "desktop") wallpaper.desktopAssetId = id;
  else wallpaper.mobileAssetId = id;
};
const assetDownloadUrl = (asset: AssetRecord) => `${asset.url}?download=1`;
const remoteDownloadUrl = (item: RemoteWallpaperPreview) => `/api/wallpaper-download?url=${encodeURIComponent(item.imageUrl)}`;

function WallpaperCard({
  title,
  subtitle,
  imageUrl,
  downloadUrl,
  downloadName,
  selected,
  onPreview,
  onApply,
  onDelete,
  deleteDisabledReason = "",
}: {
  title: string;
  subtitle: string;
  imageUrl?: string;
  downloadUrl?: string;
  downloadName?: string;
  selected: boolean;
  onPreview?: () => void;
  onApply: () => void;
  onDelete?: () => void;
  deleteDisabledReason?: string;
}) {
  return <article className={`wallpaper-card${selected ? " is-selected" : ""}${onDelete ? " has-delete" : ""}`}>
    {imageUrl && onPreview
      ? <button type="button" className="wallpaper-card-preview" title={`预览 ${title}`} aria-label={`预览 ${title}`} onClick={onPreview}><img src={imageUrl} referrerPolicy="no-referrer" alt="" loading="lazy" /></button>
      : <div className="wallpaper-card-empty"><span>纯色背景</span></div>}
    <span className="wallpaper-card-caption"><strong>{subtitle}</strong><small>{title}</small></span>
    {downloadUrl && <a className="wallpaper-card-icon wallpaper-card-download" href={downloadUrl} download={downloadName || true} title="下载壁纸" aria-label={`下载 ${title}`}><Download theme="outline" size="18" /></a>}
    {onDelete && <button type="button" className="wallpaper-card-icon wallpaper-card-delete" disabled={Boolean(deleteDisabledReason)} title={deleteDisabledReason || "删除壁纸"} aria-label={`删除 ${title}`} onClick={onDelete}><CloseSmall theme="outline" size="20" /></button>}
    <button type="button" className="wallpaper-card-apply" aria-pressed={selected} title={selected ? "当前已应用" : `应用 ${title}`} aria-label={selected ? `${title} 已应用` : `应用 ${title}`} onClick={onApply}><CheckSmall theme="outline" size="24" strokeWidth={4} /></button>
  </article>;
}

function WallpaperPreview({ image, onClose }: { image: PreviewImage; onClose: () => void }) {
  return <div className="asset-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="asset-preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="asset-preview-dialog">
      <header><div><strong id="asset-preview-title">{image.title}</strong><small>{image.subtitle}</small></div><div className="asset-preview-actions"><a href={image.downloadUrl} download={image.fileName || true} title="下载壁纸" aria-label={`下载 ${image.title}`}><Download theme="outline" size="19" /></a><button type="button" title="关闭预览" aria-label="关闭壁纸预览" onClick={onClose}><CloseSmall theme="outline" size="21" /></button></div></header>
      <img src={image.url} referrerPolicy="no-referrer" alt={image.title} />
    </div>
  </div>;
}

const viewCopy: Record<ContentSettingsView, { heading: string; description: string }> = {
  general: { heading: "默认行为", description: "控制公开页面的展示、播放和天气默认值" },
  wallpaper: { heading: "壁纸管理", description: "选择在线来源或管理自定义 R2 壁纸" },
  profile: { heading: "公开站点资料", description: "维护页面标题、作者、图标和备案信息" },
  music: { heading: "默认音乐来源", description: "设置公开页面的音乐来源，并管理用户公开歌单" },
  hitokoto: { heading: "一言内容", description: "设置远程分类、固定内容和失败回退文案" },
  about: { heading: "关于此站点", description: "查看版本信息、配置代码仓库并检查更新" },
};

export default function ContentSettings({ view }: { view: ContentSettingsView }) {
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
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetMessage, setAssetMessage] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [remotePreview, setRemotePreview] = useState<RemotePreviewState>(initialRemotePreview);
  const [wallpaperTab, setWallpaperTab] = useState<WallpaperSource | null>(null);
  const [musicPreview, setMusicPreview] = useState<MusicPreviewState>(initialMusicPreview);
  const [musicPlaylistOpen, setMusicPlaylistOpen] = useState(false);
  const [musicPlaylistFilter, setMusicPlaylistFilter] = useState("");
  const [musicPlaylistPosition, setMusicPlaylistPosition] = useState<MusicPlaylistPosition | null>(null);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckState>(initialUpdateCheck);
  const musicPreviewRequest = useRef(0);
  const musicPlaylistSelect = useRef<HTMLDivElement>(null);
  const musicPlaylistDropdown = useRef<HTMLDivElement>(null);
  const wallpaperPreviewRequest = useRef(0);
  const offline = authStatus === "offline-owner";
  const draftWallpaperSource = drafts?.wallpaper.source;
  const activeWallpaperTab = wallpaperTab ?? draftWallpaperSource;

  const positionMusicPlaylist = useCallback(() => {
    const trigger = musicPlaylistSelect.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportGap = 8;
    const dropdownGap = 5;
    const width = Math.min(rect.width, window.innerWidth - viewportGap * 2);
    const left = Math.min(Math.max(viewportGap, rect.left), window.innerWidth - viewportGap - width);
    const roomBelow = window.innerHeight - rect.bottom - viewportGap - dropdownGap;
    const roomAbove = rect.top - viewportGap - dropdownGap;
    const openAbove = roomBelow < 280 && roomAbove > roomBelow;
    const maxHeight = Math.min(400, Math.max(120, openAbove ? roomAbove : roomBelow));
    setMusicPlaylistPosition(openAbove
      ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + dropdownGap }
      : { left, width, maxHeight, top: rect.bottom + dropdownGap });
  }, []);

  const update = (mutator: (draft: SiteContentSections) => void) => setDrafts((current) => {
    if (!current) return current;
    const next = structuredClone(current);
    mutator(next);
    return next;
  });

  const resetMusicPreview = () => {
    musicPreviewRequest.current += 1;
    setMusicPreview(initialMusicPreview());
    setMusicPlaylistOpen(false);
    setMusicPlaylistFilter("");
    setMusicPlaylistPosition(null);
  };

  const restoreDrafts = useCallback(async (base: SiteContentSnapshot) => {
    const next = structuredClone(base.sections);
    const states = initialStates();
    await Promise.all(keys.map(async (section) => {
      const draft = await loadDraft(section);
      if (!draft) return;
      (next as unknown as Record<string, unknown>)[section] = structuredClone(draft.editedContent);
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

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      if (offline) {
        await restoreDrafts(structuredClone(publicSnapshot));
        setAssetMessage("离线时可以编辑配置，但上传和删除壁纸需要联网");
      } else {
        const result = await requestJson<SiteContentSnapshot>("/api/admin/content");
        await restoreDrafts(result);
      }
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 401) expire();
      setLoadError(reason instanceof ApiClientError ? reason.message : "站点设置暂时无法读取");
    } finally {
      setLoading(false);
    }
  }, [expire, offline, publicSnapshot, restoreDrafts]);

  useEffect(() => { void load(); }, [load]);

  const loadAssets = useCallback(async () => {
    if (offline) {
      setAssetMessage("离线时可以选择已缓存资源，但上传和删除壁纸需要联网");
      return;
    }
    try {
      const result = await requestJson<{ assets: AssetRecord[] }>("/api/admin/assets");
      setAssets(result.assets);
      setAssetsLoaded(true);
      setAssetMessage("");
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 401) expire();
      setAssetMessage(reason instanceof ApiClientError ? reason.message : "壁纸资源暂时无法读取");
    }
  }, [expire, offline]);

  useEffect(() => {
    if (view === "wallpaper" && !assetsLoaded) void loadAssets();
  }, [assetsLoaded, loadAssets, view]);

  useEffect(() => {
    if (!previewImage) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewImage(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [previewImage]);

  useEffect(() => {
    if (!musicPlaylistOpen) return;
    positionMusicPlaylist();
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!musicPlaylistSelect.current?.contains(target) && !musicPlaylistDropdown.current?.contains(target)) {
        setMusicPlaylistOpen(false);
        setMusicPlaylistPosition(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMusicPlaylistOpen(false);
        setMusicPlaylistPosition(null);
      }
    };
    const repositionOnScroll = (event: Event) => {
      if (!musicPlaylistDropdown.current?.contains(event.target as Node)) positionMusicPlaylist();
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", positionMusicPlaylist);
    window.addEventListener("scroll", repositionOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionMusicPlaylist);
      window.removeEventListener("scroll", repositionOnScroll, true);
    };
  }, [musicPlaylistOpen, positionMusicPlaylist]);

  useEffect(() => {
    if (view !== "music") {
      setMusicPlaylistOpen(false);
      setMusicPlaylistPosition(null);
    }
  }, [view]);

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
      void refresh(true);
    } catch (reason) {
      const message = reason instanceof ApiClientError ? (reason.status === 409 ? "服务器内容已更新，本机草稿已保留，请重新加载后决定是否覆盖" : reason.message) : "保存失败，请稍后再试";
      setSaveStates((states) => ({ ...states, [section]: { saving: false, message, error: true } }));
    }
  };

  const dirty = (section: Section) => Boolean(snapshot) && JSON.stringify(snapshot!.sections[section]) !== JSON.stringify(drafts?.[section]);
  const discard = async (section: Section) => {
    if (!snapshot) return;
    await discardSection(section);
    if (section === "music") resetMusicPreview();
    setDrafts((current) => current ? { ...current, [section]: structuredClone(snapshot.sections[section]) } as SiteContentSections : current);
    setSaveStates((states) => ({ ...states, [section]: { saving: false, message: "已放弃本机草稿", error: false } }));
  };

  const uploadAsset = async (variant: AssetRecord["variant"], file: File | undefined) => {
    if (!file || offline || assetBusy) return;
    if (file.size < 1 || file.size > MAX_ASSET_SIZE) {
      setAssetMessage("壁纸文件大小应在 1 字节到 50MB 之间");
      return;
    }
    setAssetBusy(true); setAssetMessage("");
    const body = new FormData(); body.set("variant", variant); body.set("file", file);
    try {
      const response = await fetch("/api/admin/assets", { method: "POST", body, credentials: "same-origin" });
      const payload = await response.json() as { asset?: AssetRecord; error?: { message?: string } };
      if (!response.ok || !payload.asset) throw new Error(payload.error?.message || "上传失败");
      setAssets((current) => [payload.asset!, ...current]);
      setAssetMessage("壁纸已上传，点击卡片上的勾选按钮即可应用");
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
      setPreviewImage((current) => current?.url === asset.url ? null : current);
      setAssetMessage("壁纸资源已删除");
    } catch (reason) {
      setAssetMessage(reason instanceof ApiClientError ? reason.message : "壁纸删除失败");
    } finally { setAssetBusy(false); }
  };

  const updateMusicServer = (server: MusicContentConfig["server"]) => {
    resetMusicPreview();
    update((draft) => {
      draft.music.server = server;
      draft.music.id = "";
      draft.music.playlistIds = [];
      if (server !== "netease" && draft.music.type === "user") draft.music.type = "playlist";
    });
  };

  const updateMusicType = (type: MusicContentConfig["type"]) => {
    resetMusicPreview();
    update((draft) => {
      draft.music.type = type;
      draft.music.id = "";
      draft.music.playlistIds = [];
    });
  };

  const updateMusicId = (id: string) => {
    resetMusicPreview();
    update((draft) => {
      if (draft.music.id !== id) draft.music.playlistIds = [];
      draft.music.id = id;
    });
  };

  const setMusicPlaylistIds = (playlistIds: string[]) => {
    update((draft) => { draft.music.playlistIds = playlistIds; });
  };

  const loadRemoteWallpaperPreview = useCallback(async (source: Exclude<WallpaperSource, "custom">) => {
    const requestId = ++wallpaperPreviewRequest.current;
    if (offline) {
      setRemotePreview({ loading: false, message: "离线时无法刷新在线壁纸预览", items: [] });
      return;
    }
    setRemotePreview({ loading: true, message: "", items: [] });
    try {
      const items = await Promise.all((["desktop", "mobile"] as const).map((variant) => {
        const params = new URLSearchParams({ source, variant });
        return requestJson<RemoteWallpaperPreview>(`/api/wallpaper?${params}`, { cache: "no-store" });
      }));
      if (wallpaperPreviewRequest.current !== requestId) return;
      setRemotePreview({ loading: false, message: "", items });
    } catch (reason) {
      if (wallpaperPreviewRequest.current !== requestId) return;
      setRemotePreview({
        loading: false,
        message: reason instanceof ApiClientError ? reason.message : "在线壁纸预览暂时无法读取",
        items: [],
      });
    }
  }, [offline]);

  useEffect(() => {
    if (view !== "wallpaper" || !activeWallpaperTab || activeWallpaperTab === "custom") {
      wallpaperPreviewRequest.current += 1;
      setRemotePreview(initialRemotePreview());
      return;
    }
    void loadRemoteWallpaperPreview(activeWallpaperTab);
  }, [activeWallpaperTab, loadRemoteWallpaperPreview, view]);

  const previewMusic = async () => {
    if (!drafts || musicPreview.status === "loading") return;
    const query = { ...drafts.music, id: drafts.music.id.trim() };
    if (!query.id) {
      setMusicPreview({ status: "error", message: query.type === "user" ? "请输入网易云用户 ID 或用户主页地址" : "请输入资源 ID 或搜索词", tracks: [], playlists: [] });
      return;
    }
    if (offline) {
      setMusicPreview({ status: "error", message: "离线时无法查询音乐内容", tracks: [], playlists: [] });
      return;
    }

    const requestId = ++musicPreviewRequest.current;
    setMusicPreview({ status: "loading", message: query.type === "user" ? "正在查询用户公开歌单…" : "正在查询音乐内容…", tracks: [], playlists: [] });
    try {
      const params = new URLSearchParams({ server: query.server, type: query.type, id: query.id });
      const result = await requestJson<{ tracks: PlaylistItem[]; playlists: MusicPlaylistSummary[]; userId?: string }>(`/api/admin/music-preview?${params}`);
      if (musicPreviewRequest.current !== requestId) return;
      if (query.type === "user" && result.userId) {
        update((draft) => { draft.music.id = result.userId!; });
      }
      setMusicPreview({
        status: "success",
        message: query.type === "user"
          ? result.playlists.length ? `找到 ${result.playlists.length} 个公开歌单，请选择要展示的歌单（最多 50 个）` : "该用户没有公开歌单"
          : result.tracks.length ? `找到 ${result.tracks.length} 首歌曲` : "未找到匹配内容",
        tracks: result.tracks,
        playlists: result.playlists,
      });
    } catch (reason) {
      if (musicPreviewRequest.current !== requestId) return;
      if (reason instanceof ApiClientError && reason.status === 401) expire();
      setMusicPreview({
        status: "error",
        message: reason instanceof ApiClientError ? reason.message : "音乐内容暂时无法查询",
        tracks: [],
        playlists: [],
      });
    }
  };

  const runUpdateCheck = async () => {
    if (offline) {
      setUpdateCheck({ status: "error", message: "离线时无法检查更新", result: null });
      return;
    }
    if (dirty("profile")) {
      setUpdateCheck({ status: "error", message: "请先保存代码仓库，再检查更新", result: null });
      return;
    }
    if (updateCheck.status === "loading") return;
    setUpdateCheck({ status: "loading", message: "正在检查最新版本…", result: null });
    try {
      const result = await checkForUpdate(appVersionNumber);
      setUpdateCheck({
        status: result.status,
        message: result.status === "up-to-date"
          ? `当前版本 ${appVersionNumber} 已是最新版本`
          : `发现新版本 ${result.latestVersion}`,
        result,
      });
    } catch (reason) {
      setUpdateCheck({
        status: "error",
        message: reason instanceof ApiClientError || reason instanceof Error ? reason.message : "检查更新失败，请稍后再试",
        result: null,
      });
    }
  };

  const copy = viewCopy[view];
  const reload = () => {
    if (view === "music") resetMusicPreview();
    void load();
    if (view === "wallpaper") void loadAssets();
  };
  if (loadError) return <div className="content-settings"><div className="section-heading"><div><strong>{copy.heading}</strong><small>在线内容以服务器为准，离线修改会保留在当前设备</small></div><button type="button" className="text-button" disabled={loading} onClick={reload}>重新加载</button></div><p className="inline-error">{loadError}</p></div>;
  if (!drafts) return <div className="content-settings"><div className="empty-state">正在读取{copy.heading}…</div></div>;
  const profile = drafts.profile;
  const preferences = drafts.preferences;
  const rotationValue = rotationPresets.includes(preferences.wallpaperRotationMinutes as typeof rotationPresets[number])
    ? String(preferences.wallpaperRotationMinutes)
    : "custom";
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
  const openAssetPreview = (asset: AssetRecord) => setPreviewImage({
    title: asset.originalName,
    subtitle: `${asset.sizeBytes ? formatSize(asset.sizeBytes) : "离线缓存资源"} · ${asset.variant === "desktop" ? "桌面端" : "移动端"}`,
    url: asset.url,
    downloadUrl: assetDownloadUrl(asset),
    fileName: asset.originalName,
  });
  const openRemotePreview = (item: RemoteWallpaperPreview) => setPreviewImage({
    title: item.title,
    subtitle: `${item.variant === "desktop" ? "桌面端" : "移动端"}${item.description ? ` · ${item.description}` : ""}`,
    url: item.imageUrl,
    downloadUrl: remoteDownloadUrl(item),
  });

  const applyCustomWallpaper = (variant: AssetRecord["variant"], assetId: string | null) => update((draft) => {
    draft.wallpaper.source = "custom";
    setSelectedWallpaperId(draft.wallpaper, variant, assetId);
  });
  const assetIsReferenced = (asset: AssetRecord) => [drafts.wallpaper, snapshot?.sections.wallpaper]
    .some((wallpaper) => wallpaper?.desktopAssetId === asset.id || wallpaper?.mobileAssetId === asset.id);
  const assetDeleteDisabledReason = (asset: AssetRecord) => {
    if (offline) return "离线时无法删除壁纸";
    if (assetBusy) return "正在处理其他壁纸操作";
    if (assetIsReferenced(asset)) return "当前壁纸正在使用，保存其他选择后才能删除";
    return "";
  };

  const renderCustomWallpapers = () => <>
    <div className="wallpaper-upload-row">{(["desktop", "mobile"] as const).map((variant) => <label key={variant} className="upload-button"><Upload theme="outline" size="18" /><span>{variant === "desktop" ? "上传桌面壁纸" : "上传移动端壁纸"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={offline || assetBusy} onChange={(event) => { void uploadAsset(variant, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>)}</div>
    {assetMessage && <p className="asset-message">{assetMessage}</p>}
    {(["desktop", "mobile"] as const).map((variant) => <div key={variant} className="asset-group"><strong>{variant === "desktop" ? "桌面端" : "移动端"}</strong><div className="wallpaper-card-grid"><WallpaperCard title="纯色背景" subtitle={variant === "desktop" ? "桌面端" : "移动端"} selected={drafts.wallpaper.source === "custom" && !selectedWallpaperId(drafts.wallpaper, variant)} onApply={() => applyCustomWallpaper(variant, null)} />{assetOptions(variant).map((asset) => <WallpaperCard key={asset.id} title={asset.originalName} subtitle={variant === "desktop" ? "桌面端" : "移动端"} imageUrl={asset.url} downloadUrl={assetDownloadUrl(asset)} downloadName={asset.originalName} selected={drafts.wallpaper.source === "custom" && selectedWallpaperId(drafts.wallpaper, variant) === asset.id} onPreview={() => openAssetPreview(asset)} onApply={() => applyCustomWallpaper(variant, asset.id)} onDelete={asset.createdAt ? () => void deleteAsset(asset) : undefined} deleteDisabledReason={assetDeleteDisabledReason(asset)} />)}</div></div>)}
  </>;

  const renderRemoteWallpapers = (source: Exclude<WallpaperSource, "custom">) => <section className="remote-wallpapers">
    <div className="remote-wallpaper-toolbar"><strong>{source === "bing" ? "Bing 每日壁纸" : "Wallhaven 随机壁纸"}</strong><button type="button" title="刷新预览" aria-label="刷新在线壁纸预览" disabled={offline || remotePreview.loading} onClick={() => void loadRemoteWallpaperPreview(source)}><Refresh theme="outline" size="18" /></button></div>
    {remotePreview.loading && <p className="asset-message">正在读取在线壁纸…</p>}
    {remotePreview.message && <p className="asset-message is-error">{remotePreview.message}</p>}
    {remotePreview.items.length > 0 && <div className="wallpaper-card-grid">{remotePreview.items.map((item) => <WallpaperCard key={item.variant} title={item.title} subtitle={item.variant === "desktop" ? "桌面端" : "移动端"} imageUrl={item.imageUrl} downloadUrl={remoteDownloadUrl(item)} selected={drafts.wallpaper.source === source} onPreview={() => openRemotePreview(item)} onApply={() => update((draft) => { draft.wallpaper.source = source; })} />)}</div>}
  </section>;
  const profileFields: Array<[keyof typeof profile, string, "text" | "url" | "textarea", boolean?]> = [["siteName", "站点名称", "text"], ["author", "作者", "text"], ["mainName", "主页名称", "text"], ["siteUrl", "站点地址", "url"], ["keywords", "关键词", "text", true], ["description", "简介", "textarea", true], ["siteLogo", "站点图标", "text"], ["mainLogo", "主页图标", "text"], ["appleLogo", "Apple 图标", "text"], ["startDate", "建站日期", "text"], ["icp", "ICP备案号", "text"], ["mps", "公安备案号", "text"], ["repositoryUrl", "GitHub 仓库地址", "url", true]];

  const renderMusicSettings = () => {
    const userMode = drafts.music.type === "user";
    const selectedIds = drafts.music.playlistIds;
    const normalizedPlaylistFilter = musicPlaylistFilter.trim().toLocaleLowerCase();
    const visiblePlaylists = normalizedPlaylistFilter
      ? musicPreview.playlists.filter((playlist) => playlist.name.toLocaleLowerCase().includes(normalizedPlaylistFilter) || playlist.id.includes(normalizedPlaylistFilter))
      : musicPreview.playlists;
    const togglePlaylist = (playlistId: string) => {
      setMusicPlaylistIds(selectedIds.includes(playlistId)
        ? selectedIds.filter((id) => id !== playlistId)
        : selectedIds.length < 50 ? [...selectedIds, playlistId] : selectedIds);
    };
    const selectAllPlaylists = () => setMusicPlaylistIds(musicPreview.playlists.slice(0, 50).map((playlist) => playlist.id));
    const queryMusic = () => {
      if (userMode) {
        positionMusicPlaylist();
        setMusicPlaylistOpen(true);
      }
      void previewMusic();
    };
    const toggleMusicPlaylistDropdown = () => {
      const nextOpen = !musicPlaylistOpen;
      if (nextOpen) positionMusicPlaylist();
      else setMusicPlaylistPosition(null);
      setMusicPlaylistOpen(nextOpen);
      if (nextOpen && musicPreview.status === "idle" && drafts.music.id.trim()) void previewMusic();
    };

    return <div className="admin-section"><div className="form-grid">
      <div className="form-field"><span>平台</span><ThemedSelect ariaLabel="平台" value={drafts.music.server} options={[{ value: "netease", label: "网易云音乐" }, { value: "tencent", label: "QQ 音乐" }, { value: "kugou", label: "酷狗音乐" }, { value: "baidu", label: "百度音乐" }, { value: "kuwo", label: "酷我音乐" }]} onChange={(value) => updateMusicServer(value as MusicContentConfig["server"])} /></div>
      <div className="form-field"><span>类型</span><ThemedSelect ariaLabel="类型" value={drafts.music.type} options={[{ value: "playlist", label: "歌单" }, { value: "song", label: "单曲" }, { value: "album", label: "专辑" }, { value: "artist", label: "歌手" }, { value: "search", label: "搜索" }, ...(drafts.music.server === "netease" ? [{ value: "user", label: "用户" }] : [])]} onChange={(value) => updateMusicType(value as MusicContentConfig["type"])} /></div>
      <label className="wide">{userMode ? "网易云用户 ID" : "资源 ID / 搜索词"}<span className="music-query-control"><input value={drafts.music.id} placeholder={userMode ? "用户 ID 或用户主页地址" : undefined} onChange={(event) => updateMusicId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); queryMusic(); } }} /><button type="button" title={offline ? "离线时无法查询" : userMode ? "查询用户公开歌单" : "查询音乐内容"} aria-label={userMode ? "查询用户公开歌单" : "查询音乐内容"} disabled={offline || musicPreview.status === "loading" || !drafts.music.id.trim()} onClick={queryMusic}><Search theme="outline" size="18" /></button></span></label>
      {userMode && <div ref={musicPlaylistSelect} className={`music-playlist-select${musicPlaylistOpen ? " is-open" : ""}`}>
        <button type="button" className="music-playlist-trigger" aria-expanded={musicPlaylistOpen} aria-controls="music-playlist-dropdown" onClick={toggleMusicPlaylistDropdown}>
          <span>{musicPreview.playlists.length > 0 ? `${musicPreview.playlists.length} 个候选歌单，已选择 ${selectedIds.length} 个` : selectedIds.length > 0 ? `已选择 ${selectedIds.length} 个歌单` : "请选择要展示的歌单"}</span>
          <span className="music-playlist-arrow" aria-hidden="true" />
        </button>
      </div>}
      {userMode && musicPlaylistOpen && musicPlaylistPosition && createPortal(<div ref={musicPlaylistDropdown} id="music-playlist-dropdown" className="music-playlist-dropdown" style={musicPlaylistPosition}>
          <label className="music-playlist-filter"><Search theme="outline" size="16" /><input value={musicPlaylistFilter} placeholder="搜索歌单名称或 ID" aria-label="搜索歌单名称或 ID" onChange={(event) => setMusicPlaylistFilter(event.target.value)} /></label>
          <section className={`music-preview is-playlists${musicPreview.status === "error" ? " is-error" : ""}`} aria-live="polite">
            <header><strong>{musicPreview.message || (offline ? "离线状态下仅显示已保存的歌单 ID" : drafts.music.id.trim() ? "正在读取用户公开歌单…" : "请先输入网易云用户 ID")}</strong>{musicPreview.playlists.length > 0 && <div className="music-preview-actions"><button type="button" onClick={selectAllPlaylists}>全选</button><button type="button" disabled={!selectedIds.length} onClick={() => setMusicPlaylistIds([])}>清空</button></div>}</header>
            {visiblePlaylists.length > 0 && <ul className="music-playlist-options">{visiblePlaylists.map((playlist) => {
              const selected = selectedIds.includes(playlist.id);
              return <li key={playlist.id}><label className={selected ? "is-selected" : ""}><input type="checkbox" checked={selected} onChange={() => togglePlaylist(playlist.id)} />{playlist.cover ? <img src={playlist.cover} referrerPolicy="no-referrer" alt="" loading="lazy" /> : <span className="music-preview-cover" aria-hidden="true" />}<span><strong>{playlist.name}</strong><small>{playlist.trackCount} 首 · ID {playlist.id}</small></span></label></li>;
            })}</ul>}
            {musicPreview.playlists.length > 0 && visiblePlaylists.length === 0 && <p className="music-playlist-empty">没有匹配的歌单</p>}
            {musicPreview.playlists.length === 0 && selectedIds.length > 0 && <ul className="music-playlist-options is-id-only">{selectedIds.filter((id) => !normalizedPlaylistFilter || id.includes(normalizedPlaylistFilter)).map((id) => <li key={id}><label className="is-selected"><input type="checkbox" checked onChange={() => togglePlaylist(id)} /><span className="music-preview-cover" aria-hidden="true" /><span><strong>已保存的歌单</strong><small>ID {id}</small></span></label></li>)}</ul>}
          </section>
        </div>, document.body)}
      {!userMode && musicPreview.status !== "idle" && <section className={`music-preview${musicPreview.status === "error" ? " is-error" : ""}`} aria-live="polite">
        <header><strong>{musicPreview.message}</strong></header>
        {musicPreview.tracks.length > 0 && <ol>{musicPreview.tracks.slice(0, 100).map((track, index) => <li key={`${track.url}-${index}`}>{track.cover ? <img src={track.cover} alt="" loading="lazy" /> : <span className="music-preview-cover" aria-hidden="true" />}<span><strong>{track.name}</strong><small>{track.artist}</small></span></li>)}</ol>}
      </section>}
    </div><SaveRow state={saveStates.music} dirty={dirty("music")} saveDisabled={userMode && selectedIds.length === 0} onSave={() => void save("music")} onDiscard={() => void discard("music")} /></div>;
  };

  const renderPage = () => {
    if (view === "general") return <div className="admin-section"><div className="form-grid">
      <div className="form-field"><span>建站日期显示</span><ThemedSelect ariaLabel="建站日期显示" value={String(preferences.siteStartShow)} options={[{ value: "true", label: "显示" }, { value: "false", label: "隐藏" }]} onChange={(value) => update((draft) => { draft.preferences.siteStartShow = value === "true"; })} /></div>
      <div className="form-field"><span>底栏背景模糊</span><ThemedSelect ariaLabel="底栏背景模糊" value={String(preferences.footerBlur)} options={[{ value: "true", label: "开启" }, { value: "false", label: "关闭" }]} onChange={(value) => update((draft) => { draft.preferences.footerBlur = value === "true"; })} /></div>
      <div className="form-field"><span>主页名称显示</span><ThemedSelect ariaLabel="主页名称显示" value={String(preferences.messageNameShow)} options={[{ value: "false", label: "显示域名" }, { value: "true", label: "显示主页名称" }]} onChange={(value) => update((draft) => { draft.preferences.messageNameShow = value === "true"; })} /></div>
      <div className="form-field"><span>自动播放</span><ThemedSelect ariaLabel="自动播放" value={String(preferences.playerAutoplay)} options={[{ value: "false", label: "关闭" }, { value: "true", label: "开启" }]} onChange={(value) => update((draft) => { draft.preferences.playerAutoplay = value === "true"; })} /></div>
      <div className="form-field"><span>播放器快捷键</span><ThemedSelect ariaLabel="播放器快捷键" value={String(preferences.playerKeyboardShortcuts)} options={[{ value: "true", label: "开启" }, { value: "false", label: "关闭" }]} onChange={(value) => update((draft) => { draft.preferences.playerKeyboardShortcuts = value === "true"; })} /></div>
      <div className="form-field"><span>默认播放顺序</span><ThemedSelect ariaLabel="默认播放顺序" value={preferences.playerDefaultOrder} options={[{ value: "shuffle", label: "随机" }, { value: "list", label: "顺序" }, { value: "single", label: "单曲循环" }]} onChange={(value) => update((draft) => { draft.preferences.playerDefaultOrder = value as typeof preferences.playerDefaultOrder; })} /></div>
      <label>默认音量<input type="number" min="0" max="1" step="0.05" value={preferences.playerDefaultVolume} onChange={(event) => update((draft) => { draft.preferences.playerDefaultVolume = Number(event.target.value); })} /></label>
      <div className="form-field"><span>壁纸自动切换</span><ThemedSelect ariaLabel="壁纸自动切换" value={rotationValue} options={[{ value: "0", label: "不切换" }, { value: "5", label: "每 5 分钟" }, { value: "15", label: "每 15 分钟" }, { value: "30", label: "每 30 分钟" }, { value: "60", label: "每小时" }, { value: "180", label: "每 3 小时" }, { value: "360", label: "每 6 小时" }, { value: "720", label: "每 12 小时" }, { value: "1440", label: "每天" }, { value: "custom", label: "自定义" }]} onChange={(value) => update((draft) => { draft.preferences.wallpaperRotationMinutes = value === "custom" ? 10 : Number(value); })} /></div>
      {rotationValue === "custom" && <label>自定义切换时间（分钟）<input type="number" min="1" max="10080" step="1" value={preferences.wallpaperRotationMinutes} onChange={(event) => update((draft) => { draft.preferences.wallpaperRotationMinutes = Number(event.target.value); })} /></label>}
      <label>天气城市<input value={preferences.weatherLocation?.city || ""} placeholder="留空使用访问者 IP 粗定位" onChange={(event) => update((draft) => { const city = event.target.value; draft.preferences.weatherLocation = city ? { city, latitude: draft.preferences.weatherLocation?.latitude || 0, longitude: draft.preferences.weatherLocation?.longitude || 0 } : null; })} /></label>
      <label>纬度<input type="number" min="-90" max="90" step="0.01" disabled={!preferences.weatherLocation} value={preferences.weatherLocation?.latitude ?? ""} onChange={(event) => update((draft) => { if (draft.preferences.weatherLocation) draft.preferences.weatherLocation.latitude = Number(event.target.value); })} /></label>
      <label>经度<input type="number" min="-180" max="180" step="0.01" disabled={!preferences.weatherLocation} value={preferences.weatherLocation?.longitude ?? ""} onChange={(event) => update((draft) => { if (draft.preferences.weatherLocation) draft.preferences.weatherLocation.longitude = Number(event.target.value); })} /></label>
    </div><SaveRow state={saveStates.preferences} dirty={dirty("preferences")} onSave={() => void save("preferences")} onDiscard={() => void discard("preferences")} /></div>;

    if (view === "wallpaper") return <div className="admin-section">
      <div className="wallpaper-source-tabs" role="tablist" aria-label="壁纸来源">{(["bing", "wallhaven", "custom"] as const).map((source) => <button key={source} type="button" role="tab" aria-selected={activeWallpaperTab === source} className={activeWallpaperTab === source ? "is-active" : ""} onClick={() => setWallpaperTab(source)}>{source === "bing" ? "Bing" : source === "wallhaven" ? "Wallhaven" : "自定义"}</button>)}</div>
      <div className="wallpaper-source-panel" role="tabpanel">{activeWallpaperTab === "custom" ? renderCustomWallpapers() : renderRemoteWallpapers(activeWallpaperTab || "bing")}</div>
      <SaveRow state={saveStates.wallpaper} dirty={dirty("wallpaper")} onSave={() => void save("wallpaper")} onDiscard={() => void discard("wallpaper")} />
    </div>;

    if (view === "profile") return <div className="admin-section"><div className="form-grid">{profileFields.map(([field, label, type, wide]) => <label key={field} className={wide ? "wide" : ""}>{label}{type === "textarea" ? <textarea value={profile[field]} rows={2} onChange={(event) => update((draft) => { draft.profile[field] = event.target.value; })} /> : <input value={profile[field]} type={type} placeholder={field === "startDate" ? "YYYY-MM-DD" : undefined} onChange={(event) => { update((draft) => { draft.profile[field] = event.target.value; }); if (field === "repositoryUrl") setUpdateCheck(initialUpdateCheck()); }} />}</label>)}</div><SaveRow state={saveStates.profile} dirty={dirty("profile")} onSave={() => void save("profile")} onDiscard={() => void discard("profile")} /></div>;

    if (view === "music") return renderMusicSettings();

    if (view === "about") return <div className="admin-section about-page">
      <section className="about-overview">
        <img src={profile.mainLogo} alt="" />
        <div className="about-title"><strong>{profile.siteName}</strong><small>{profile.description}</small></div>
        <dl>
          <div><dt>版本</dt><dd>{appVersion}</dd></div>
          <div><dt>代码仓库</dt><dd><a href={profile.repositoryUrl} target="_blank" rel="noopener noreferrer">{profile.repositoryUrl.replace(/^https:\/\//, "")}</a></dd></div>
          <div><dt>技术栈</dt><dd>React + Vite + Cloudflare</dd></div>
        </dl>
      </section>
      <section className={`about-card update-card is-${updateCheck.status}`} aria-live="polite">
        <header><div><strong>版本更新</strong><small>{updateCheck.message}</small></div><button type="button" disabled={offline || dirty("profile") || updateCheck.status === "loading"} onClick={() => void runUpdateCheck()}><Refresh theme="outline" size="17" /><span>{updateCheck.status === "loading" ? "检查中…" : "检查更新"}</span></button></header>
        {updateCheck.result?.status === "available" && <a className="release-link" href={updateCheck.result.releaseUrl} target="_blank" rel="noopener noreferrer">前往 GitHub 查看 {updateCheck.result.latestVersion}{updateCheck.result.prerelease ? " 预发行版" : ""}</a>}
      </section>
    </div>;

    return <div className="admin-section"><div className="form-grid"><div className="form-field"><span>模式</span><ThemedSelect ariaLabel="一言模式" value={drafts.hitokoto.mode} options={[{ value: "remote", label: "远程一言" }, { value: "fixed", label: "固定内容" }]} onChange={(value) => update((draft) => { draft.hitokoto.mode = value as SiteContentSections["hitokoto"]["mode"]; })} /></div><label className="wide">远程分类（逗号分隔）<input value={drafts.hitokoto.categories.join(", ")} onChange={(event) => update((draft) => { draft.hitokoto.categories = event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean); })} /></label><label className="wide">固定内容<textarea rows={2} value={drafts.hitokoto.fixedText} onChange={(event) => update((draft) => { draft.hitokoto.fixedText = event.target.value; })} /></label><label>固定内容来源<input value={drafts.hitokoto.fixedFrom} onChange={(event) => update((draft) => { draft.hitokoto.fixedFrom = event.target.value; })} /></label><label className="wide">失败时内容<textarea rows={2} value={drafts.hitokoto.fallbackText} onChange={(event) => update((draft) => { draft.hitokoto.fallbackText = event.target.value; })} /></label><label>失败时来源<input value={drafts.hitokoto.fallbackFrom} onChange={(event) => update((draft) => { draft.hitokoto.fallbackFrom = event.target.value; })} /></label></div><SaveRow state={saveStates.hitokoto} dirty={dirty("hitokoto")} onSave={() => void save("hitokoto")} onDiscard={() => void discard("hitokoto")} /></div>;
  };

  return <div className="content-settings"><div className="section-heading"><div><strong>{copy.heading}</strong><small>{offline ? "当前离线，保存操作会留在本机等待提交" : copy.description}</small></div><button type="button" className="text-button" disabled={loading} onClick={reload}>{loading ? "加载中…" : "重新加载"}</button></div><div className="settings-page-body">{renderPage()}</div>{previewImage && <WallpaperPreview image={previewImage} onClose={() => setPreviewImage(null)} />}</div>;
}
