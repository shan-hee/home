import type { SiteContentSnapshot } from "@/typings/siteContent";

export const siteContentFallback: SiteContentSnapshot = {
  schemaVersion: 8,
  revision: "build-fallback",
  generatedAt: "",
  etag: "",
  sectionRevisions: {
    profile: 0,
    siteLinks: 0,
    socialLinks: 0,
    music: 0,
    wallpaper: 0,
    preferences: 0,
    hitokoto: 0,
  },
  sections: {
    profile: {
      siteName: "Home",
      author: "shanhee",
      keywords: "無名,个人主页",
      description: "一个默默无闻的主页",
      siteUrl: "https://ajjj.de/",
      mainName: "Home",
      siteLogo: "/images/icon/favicon.ico",
      mainLogo: "/images/icon/logo.png",
      appleLogo: "/images/icon/apple-touch-icon.png",
      startDate: "2026-07-23",
      icp: "",
      mps: "",
      repositoryUrl: "https://github.com/shan-hee/home",
    },
    siteLinks: [
      { name: "博客", link: "https://blog.ajjj.de/", iconMode: "icon", iconValue: "ri:blogger-fill", iconColor: "#FF4757" }
    ],
    socialLinks: [
      { name: "Github", icon: "ri:github-fill", url: "https://github.com/shan-hee" }
    ],
    music: {
      server: "netease",
      type: "playlist",
      id: "694211863",
      playlistIds: [],
    },
    wallpaper: {
      source: "custom",
      desktopAssetId: null,
      mobileAssetId: null,
    },
    preferences: {
      siteStartShow: true,
      footerBlur: true,
      messageNameShow: false,
      playerAutoplay: false,
      playerKeyboardShortcuts: true,
      playerDefaultVolume: 0.3,
      playerDefaultOrder: "list",
      wallpaperRotationMinutes: 0,
      weatherLocation: null,
    },
    hitokoto: {
      mode: "remote",
      categories: [],
      fixedText: "",
      fixedFrom: "",
      fallbackText: "这里应该显示一句话",
      fallbackFrom: "shanhee",
    },
  },
};
