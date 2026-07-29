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
  initialize: () => void;
  refresh: () => Promise<void>;
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
  initialize: () => {
    const snapshot = structuredClone(siteContentFallback);
    applyDocumentMetadata(snapshot);
    set({ snapshot, ready: true });
  },
  refresh: async () => {
    if (get().refreshing) return;
    set({ refreshing: true });
    try {
      const headers = new Headers({ accept: "application/json" });
      if (get().snapshot.etag) headers.set("if-none-match", get().snapshot.etag);
      const response = await fetch("/api/site-config", { headers, credentials: "same-origin" });
      if (response.status === 304) return;
      if (!response.ok) throw new Error(`站点配置返回 ${response.status}`);
      const payload: unknown = await response.json();
      if (!isSiteContentSnapshot(payload)) throw new Error("站点配置格式无效");
      get().replaceSnapshot(payload);
    } catch {
      // 刷新失败时继续使用本地快照或构建期 fallback。
    } finally {
      set({ refreshing: false });
    }
  },
  replaceSnapshot: (snapshot) => {
    applyDocumentMetadata(snapshot);
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
    set({ snapshot });
  },
}));

export const siteProfile = () => useSiteContentStore.getState().snapshot.sections.profile;
