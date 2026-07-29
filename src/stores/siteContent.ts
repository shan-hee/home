import { create } from "zustand";
import { siteContentFallback } from "@/config/siteContentFallback";
import type { SiteContentSections, SiteContentSnapshot } from "@/typings/siteContent";

const isSiteContentSnapshot = (value: unknown): value is SiteContentSnapshot => {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SiteContentSnapshot>;
  if (
    snapshot.schemaVersion !== 7
    || typeof snapshot.revision !== "string"
    || typeof snapshot.etag !== "string"
    || !snapshot.sections
  ) return false;
  const { sections } = snapshot;
  return typeof sections.profile?.siteName === "string"
    && Array.isArray(sections.siteLinks)
    && sections.siteLinks.every((item) => (
      typeof item.name === "string"
      && typeof item.link === "string"
      && (item.iconMode === "text" || item.iconMode === "icon" || item.iconMode === "asset")
      && typeof item.iconValue === "string"
      && typeof item.iconColor === "string"
    ))
    && Array.isArray(sections.socialLinks)
    && sections.socialLinks.every((item) => (
      typeof item.name === "string"
      && typeof item.icon === "string"
      && typeof item.url === "string"
    ))
    && ["bing", "wallhaven", "custom"].includes(sections.wallpaper?.source || "")
    && (sections.wallpaper?.desktopAssetId === null || typeof sections.wallpaper?.desktopAssetId === "string")
    && (sections.wallpaper?.mobileAssetId === null || typeof sections.wallpaper?.mobileAssetId === "string")
    && typeof sections.preferences?.siteStartShow === "boolean"
    && typeof sections.preferences?.footerBlur === "boolean"
    && typeof sections.preferences?.messageNameShow === "boolean"
    && typeof sections.preferences?.playerAutoplay === "boolean"
    && typeof sections.preferences?.playerKeyboardShortcuts === "boolean"
    && typeof sections.preferences?.playerDefaultVolume === "number"
    && typeof sections.preferences?.wallpaperRotationMinutes === "number";
};

const SNAPSHOT_CACHE_KEY = "home:site-content:v7";
const OBSOLETE_SNAPSHOT_CACHE_KEYS = ["home:site-content:v6"] as const;
const SNAPSHOT_FRESH_MS = 6 * 60 * 60 * 1000;
const SNAPSHOT_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const BOOTSTRAP_TIMEOUT_MS = 5000;

interface CachedSiteContent {
  storedAt: number;
  snapshot: SiteContentSnapshot;
}

const readCachedSnapshot = (): CachedSiteContent | null => {
  try {
    OBSOLETE_SNAPSHOT_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
    const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedSiteContent>;
    if (
      typeof cached.storedAt !== "number"
      || !Number.isFinite(cached.storedAt)
      || Date.now() - cached.storedAt > SNAPSHOT_MAX_STALE_MS
      || !isSiteContentSnapshot(cached.snapshot)
    ) {
      localStorage.removeItem(SNAPSHOT_CACHE_KEY);
      return null;
    }
    return { storedAt: cached.storedAt, snapshot: cached.snapshot };
  } catch {
    return null;
  }
};

const writeCachedSnapshot = (snapshot: SiteContentSnapshot) => {
  try {
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify({ storedAt: Date.now(), snapshot }));
  } catch {
    // 持久缓存不可用时不影响当前页面。
  }
};

const fetchSnapshot = async (
  etag: string,
  signal?: AbortSignal,
  force = false,
): Promise<SiteContentSnapshot | null> => {
  const headers = new Headers({ accept: "application/json" });
  if (etag) headers.set("if-none-match", etag);
  const input = force ? `/api/site-config?refresh=${Date.now()}` : "/api/site-config";
  const response = await fetch(input, { headers, credentials: "same-origin", signal });
  if (response.status === 304) return null;
  if (!response.ok) throw new Error(`站点配置返回 ${response.status}`);
  const payload: unknown = await response.json();
  if (!isSiteContentSnapshot(payload)) throw new Error("站点配置格式无效");
  return payload;
};

const applyDocumentMetadata = (snapshot: SiteContentSnapshot) => {
  const { profile } = snapshot.sections;
  document.title = profile.siteName;
  const setMeta = (name: string, value: string) => {
    const element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (element) element.content = value;
  };
  setMeta("description", profile.description);
  setMeta("keywords", profile.keywords);
  setMeta("author", profile.author);
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = profile.siteLogo;
  const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = profile.appleLogo;
  const bookmark = document.querySelector<HTMLLinkElement>('link[rel="bookmark"]');
  if (bookmark) bookmark.href = profile.appleLogo;
};

interface SiteContentStore {
  snapshot: SiteContentSnapshot;
  ready: boolean;
  refreshing: boolean;
  initialize: () => Promise<void>;
  refresh: (force: boolean) => Promise<void>;
  replaceSnapshot: (snapshot: SiteContentSnapshot) => void;
  replaceSection: <Section extends keyof SiteContentSections>(
    section: Section,
    content: SiteContentSections[Section],
    revision: number,
    updatedAt: string,
  ) => void;
}

export const useSiteContentStore = create<SiteContentStore>((set, get) => ({
  snapshot: structuredClone(siteContentFallback),
  ready: false,
  refreshing: false,
  initialize: async () => {
    if (get().ready || get().refreshing) return;
    const cached = readCachedSnapshot();
    if (cached && Date.now() - cached.storedAt <= SNAPSHOT_FRESH_MS) {
      applyDocumentMetadata(cached.snapshot);
      set({ snapshot: cached.snapshot, ready: true });
      return;
    }

    set({ refreshing: true });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);
    let snapshot = cached?.snapshot || structuredClone(siteContentFallback);
    try {
      const remote = await fetchSnapshot(cached?.snapshot.etag || "", controller.signal);
      if (remote) snapshot = remote;
      writeCachedSnapshot(snapshot);
    } catch {
      // 首次请求失败时使用仍在最长陈旧期内的快照，否则使用构建期 fallback。
    } finally {
      window.clearTimeout(timeoutId);
      applyDocumentMetadata(snapshot);
      set({ snapshot, ready: true, refreshing: false });
    }
  },
  refresh: async (force) => {
    if (get().refreshing) return;
    set({ refreshing: true });
    try {
      const snapshot = await fetchSnapshot(get().snapshot.etag, undefined, force);
      if (snapshot) get().replaceSnapshot(snapshot);
      else writeCachedSnapshot(get().snapshot);
    } catch {
      // 刷新失败时继续使用本地快照或构建期 fallback。
    } finally {
      set({ refreshing: false });
    }
  },
  replaceSnapshot: (snapshot) => {
    applyDocumentMetadata(snapshot);
    writeCachedSnapshot(snapshot);
    set({ snapshot });
  },
  replaceSection: (section, content, revision, updatedAt) => {
    const current = get().snapshot;
    const sectionRevisions = { ...current.sectionRevisions, [section]: revision };
    const snapshot: SiteContentSnapshot = {
      ...current,
      revision: Object.entries(sectionRevisions).map(([key, value]) => `${key}:${value}`).join("|"),
      generatedAt: updatedAt,
      etag: "",
      sectionRevisions,
      sections: { ...current.sections, [section]: structuredClone(content) } as SiteContentSections,
    };
    applyDocumentMetadata(snapshot);
    writeCachedSnapshot(snapshot);
    set({ snapshot });
  },
}));

export const siteProfile = () => useSiteContentStore.getState().snapshot.sections.profile;
