export type LinkIconMode = "text" | "icon" | "asset";

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
  url: string;
}

export interface MusicContentConfig {
  server: "netease" | "tencent" | "kugou" | "baidu" | "kuwo";
  type: "search" | "song" | "album" | "artist" | "playlist";
  id: string;
}

export interface WallpaperContentConfig {
  source: "bing" | "wallhaven" | "custom";
  desktopAssetId: string | null;
  mobileAssetId: string | null;
}

export interface SitePreferences {
  siteStartShow: boolean;
  footerBlur: boolean;
  messageNameShow: boolean;
  playerAutoplay: boolean;
  playerKeyboardShortcuts: boolean;
  playerDefaultVolume: number;
  playerDefaultOrder: "list" | "single" | "shuffle";
  wallpaperRotationMinutes: number;
  weatherLocation: {
    city: string;
    latitude: number;
    longitude: number;
  } | null;
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
  preferences: SitePreferences;
  hitokoto: HitokotoContentConfig;
}

export interface SiteContentSnapshot {
  schemaVersion: 7;
  revision: string;
  generatedAt: string;
  etag: string;
  sectionRevisions: Record<keyof SiteContentSections, number>;
  sections: SiteContentSections;
}
