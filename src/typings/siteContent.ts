export type LinkIconMode = "text" | "icon" | "image";

export interface SiteProfile {
  siteName: string;
  author: string;
  keywords: string;
  description: string;
  siteUrl: string;
  mainName: string;
  siteLogo: string;
  mainLogo: string;
  appleLogo: string;
  startDate: string;
  icp: string;
  mps: string;
  repositoryUrl: string;
}

export interface SiteLinkConfig {
  name: string;
  link: string;
  iconMode: LinkIconMode;
  iconValue: string;
  iconColor: string;
}

export interface SocialLinkConfig {
  name: string;
  icon: string;
  tip: string;
  url: string;
}

export interface MusicContentConfig {
  server: "netease" | "tencent";
  type: "playlist" | "song";
  id: string;
}

export interface WallpaperCollectionConfig {
  count: number;
  pattern: string;
  fallback: string;
}

export interface WallpaperContentConfig {
  version: number;
  desktop: WallpaperCollectionConfig;
  mobile: WallpaperCollectionConfig;
}

export interface HitokotoContentConfig {
  mode: "remote" | "fixed";
  categories: string[];
  fixedText: string;
  fixedFrom: string;
  fallbackText: string;
  fallbackFrom: string;
}

export interface SiteContentSections {
  profile: SiteProfile;
  siteLinks: SiteLinkConfig[];
  socialLinks: SocialLinkConfig[];
  music: MusicContentConfig;
  wallpaper: WallpaperContentConfig;
  hitokoto: HitokotoContentConfig;
}

export interface SiteContentSnapshot {
  schemaVersion: 3;
  revision: string;
  generatedAt: string;
  etag: string;
  sectionRevisions: Record<keyof SiteContentSections, number>;
  sections: SiteContentSections;
}
