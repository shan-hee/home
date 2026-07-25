export type SiteIcon = "Blog" | "Cloud" | "Compass" | "Book" | "Fire" | "LaptopCode";
export type SocialIcon = "github" | "bilibili" | "qq" | "mail" | "twitter-x" | "telegram";

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
  icon: SiteIcon;
  name: string;
  link: string;
}

export interface SocialLinkConfig {
  name: string;
  icon: SocialIcon;
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
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  etag: string;
  sectionRevisions: Record<keyof SiteContentSections, number>;
  sections: SiteContentSections;
}
