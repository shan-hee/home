import { defineStore } from "pinia";
import { siteContentFallback } from "@/config/siteContentFallback";
import type { SiteContentSnapshot } from "@/typings/siteContent";
import { STORAGE_KEYS } from "@/utils/storageKeys";

const isSiteContentSnapshot = (value: unknown): value is SiteContentSnapshot => {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SiteContentSnapshot>;
  return (
    snapshot.schemaVersion === 1
    && typeof snapshot.revision === "string"
    && typeof snapshot.etag === "string"
    && Boolean(snapshot.sections)
    && typeof snapshot.sections?.profile?.siteName === "string"
    && Array.isArray(snapshot.sections?.siteLinks)
    && Array.isArray(snapshot.sections?.socialLinks)
  );
};

const applyDocumentMetadata = (snapshot: SiteContentSnapshot) => {
  const { profile } = snapshot.sections;
  document.title = profile.siteName;
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = profile.description;
  const keywords = document.querySelector<HTMLMetaElement>('meta[name="keywords"]');
  if (keywords) keywords.content = profile.keywords;
  const author = document.querySelector<HTMLMetaElement>('meta[name="author"]');
  if (author) author.content = profile.author;
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = profile.siteLogo;
  const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = profile.appleLogo;
  const bookmark = document.querySelector<HTMLLinkElement>('link[rel="bookmark"]');
  if (bookmark) bookmark.href = profile.appleLogo;
};

export const useSiteContentStore = defineStore("site-content", {
  state: () => ({
    snapshot: structuredClone(siteContentFallback),
    ready: false,
    refreshing: false,
  }),
  getters: {
    sections: (state) => state.snapshot.sections,
    profile: (state) => state.snapshot.sections.profile,
  },
  actions: {
    initialize() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.siteContent);
        if (raw) {
          const cached: unknown = JSON.parse(raw);
          if (isSiteContentSnapshot(cached)) this.snapshot = cached;
        }
      } catch {
        this.snapshot = structuredClone(siteContentFallback);
      }
      applyDocumentMetadata(this.snapshot);
      this.ready = true;
    },
    async refresh() {
      if (this.refreshing) return;
      this.refreshing = true;
      try {
        const headers = new Headers({ accept: "application/json" });
        if (this.snapshot.etag) headers.set("if-none-match", this.snapshot.etag);
        const response = await fetch("/api/site-config", { headers, credentials: "same-origin" });
        if (response.status === 304) return;
        if (!response.ok) throw new Error(`站点配置返回 ${response.status}`);
        const payload: unknown = await response.json();
        if (!isSiteContentSnapshot(payload)) throw new Error("站点配置格式无效");
        this.snapshot = payload;
        applyDocumentMetadata(payload);
        try {
          localStorage.setItem(STORAGE_KEYS.siteContent, JSON.stringify(payload));
        } catch {
          // 浏览器禁止本地存储时仍使用本次响应。
        }
      } catch {
        // 公开配置刷新失败时继续使用本地快照或构建期 fallback。
      } finally {
        this.refreshing = false;
      }
    },
  },
});
