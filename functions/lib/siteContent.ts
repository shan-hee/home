import { ApiError } from "./api";
import type { D1Database } from "./types";

export const CONTENT_SECTION_KEYS = [
  "profile",
  "siteLinks",
  "socialLinks",
  "music",
  "wallpaper",
  "preferences",
  "hitokoto",
] as const;

export type ContentSectionKey = typeof CONTENT_SECTION_KEYS[number];

interface ContentRow {
  section_key: ContentSectionKey;
  content_json: string;
  revision: number;
  updated_at: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const knownKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ApiError(400, "UNKNOWN_CONTENT_FIELD", "配置包含不支持的字段");
  }
};

const text = (value: unknown, name: string, maxLength: number, allowEmpty = true) => {
  if (typeof value !== "string") throw new ApiError(400, "INVALID_CONTENT", `${name}格式无效`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) {
    throw new ApiError(400, "INVALID_CONTENT", `${name}长度无效`);
  }
  return normalized;
};

const url = (value: unknown, name: string, protocols = ["https:"]) => {
  const normalized = text(value, name, 500, false);
  try {
    const parsed = new URL(normalized);
    if (!protocols.includes(parsed.protocol)) throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw new ApiError(400, "INVALID_CONTENT_URL", `${name}不是安全地址`);
  }
};

const assetUrl = (value: unknown, name: string) => {
  const normalized = text(value, name, 500, false);
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return normalized;
  return url(normalized, name);
};

const iconCode = (value: unknown, name = "图标代码") => {
  const normalized = text(value, name, 80, false).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new ApiError(400, "INVALID_CONTENT", `${name}格式无效`);
  }
  return normalized;
};

const color = (value: unknown, name: string) => {
  const normalized = text(value, name, 7, false).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new ApiError(400, "INVALID_CONTENT", `${name}格式无效`);
  }
  return normalized;
};

const iconText = (value: unknown) => {
  const normalized = text(value, "网站图标文字", 16, false);
  if ([...normalized].length > 4) {
    throw new ApiError(400, "INVALID_CONTENT", "网站图标文字长度无效");
  }
  return normalized;
};

const siteIconUrl = (value: unknown, siteLink: string) => {
  const normalized = url(value, "网站图标地址");
  const icon = new URL(normalized);
  const site = new URL(siteLink);
  const fromGoogle = icon.host === "www.google.com" && icon.pathname === "/s2/favicons";
  const fromDuckDuckGo = icon.host === "icons.duckduckgo.com" && icon.pathname.startsWith("/ip3/");
  if (icon.host !== site.host && !fromGoogle && !fromDuckDuckGo) {
    throw new ApiError(400, "INVALID_CONTENT_URL", "网站图标地址与目标网站不匹配");
  }
  return normalized;
};

const profile = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_CONTENT", "站点资料格式无效");
  knownKeys(value, [
    "siteName", "author", "keywords", "description", "siteUrl", "mainName",
    "siteLogo", "mainLogo", "appleLogo", "startDate", "icp", "mps", "repositoryUrl",
  ]);
  return {
    siteName: text(value.siteName, "站点名称", 80, false),
    author: text(value.author, "作者", 80, false),
    keywords: text(value.keywords, "关键词", 300),
    description: text(value.description, "站点描述", 300),
    siteUrl: url(value.siteUrl, "站点地址", ["http:", "https:"]),
    mainName: text(value.mainName, "主页名称", 80, false),
    siteLogo: assetUrl(value.siteLogo, "站点图标"),
    mainLogo: assetUrl(value.mainLogo, "主页图标"),
    appleLogo: assetUrl(value.appleLogo, "Apple 图标"),
    startDate: text(value.startDate, "建站日期", 10),
    icp: text(value.icp, "ICP 备案号", 80),
    mps: text(value.mps, "公安备案号", 80),
    repositoryUrl: url(value.repositoryUrl, "仓库地址"),
  };
};

const siteLinks = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 60) {
    throw new ApiError(400, "INVALID_CONTENT", "网站列表格式无效");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new ApiError(400, "INVALID_CONTENT", `网站 ${index + 1} 格式无效`);
    knownKeys(item, ["name", "link", "iconMode", "iconValue", "iconColor"]);
    const iconMode = text(item.iconMode, "网站图标类型", 10, false);
    if (iconMode !== "text" && iconMode !== "icon" && iconMode !== "image") {
      throw new ApiError(400, "INVALID_CONTENT", "网站图标类型无效");
    }
    const link = url(item.link, "网站地址", ["http:", "https:"]);
    return {
      name: text(item.name, "网站名称", 80, false),
      link,
      iconMode,
      iconValue: iconMode === "icon"
        ? iconCode(item.iconValue, "网站图标代码")
        : iconMode === "image"
          ? siteIconUrl(item.iconValue, link)
          : iconText(item.iconValue),
      iconColor: color(item.iconColor, "网站图标颜色"),
    };
  });
};

const socialLinks = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 30) {
    throw new ApiError(400, "INVALID_CONTENT", "社交链接格式无效");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new ApiError(400, "INVALID_CONTENT", `社交链接 ${index + 1} 格式无效`);
    knownKeys(item, ["name", "icon", "url"]);
    return {
      name: text(item.name, "社交名称", 80, false),
      icon: iconCode(item.icon, "社交图标代码"),
      url: url(item.url, "社交地址", ["https:", "mailto:"]),
    };
  });
};

const music = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_CONTENT", "音乐配置格式无效");
  knownKeys(value, ["server", "type", "id"]);
  const server = text(value.server, "音乐平台", 20, false);
  const type = text(value.type, "音乐类型", 20, false);
  if (!(["netease", "tencent"] as string[]).includes(server)) {
    throw new ApiError(400, "INVALID_CONTENT", "不支持的音乐平台");
  }
  if (!(["playlist", "song"] as string[]).includes(type)) {
    throw new ApiError(400, "INVALID_CONTENT", "不支持的音乐类型");
  }
  return {
    server,
    type,
    id: text(value.id, "音乐 ID", 120),
  };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const nullableAssetId = (value: unknown, name: string) => {
  if (value === null) return null;
  const normalized = text(value, name, 36, false);
  if (!UUID_PATTERN.test(normalized)) throw new ApiError(400, "INVALID_CONTENT", `${name}格式无效`);
  return normalized;
};

const wallpaper = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_CONTENT", "壁纸配置格式无效");
  knownKeys(value, ["desktopAssetId", "mobileAssetId"]);
  return {
    desktopAssetId: nullableAssetId(value.desktopAssetId, "桌面端壁纸"),
    mobileAssetId: nullableAssetId(value.mobileAssetId, "移动端壁纸"),
  };
};

const boolean = (value: unknown, name: string) => {
  if (typeof value !== "boolean") throw new ApiError(400, "INVALID_CONTENT", `${name}格式无效`);
  return value;
};

const preferences = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_CONTENT", "全局偏好格式无效");
  knownKeys(value, [
    "siteStartShow", "footerBlur", "messageNameShow", "playerAutoplay",
    "playerKeyboardShortcuts", "playerDefaultVolume", "playerDefaultOrder", "weatherLocation",
  ]);
  const playerDefaultOrder = text(value.playerDefaultOrder, "默认播放顺序", 10, false);
  if (!(["list", "single", "shuffle"] as string[]).includes(playerDefaultOrder)) {
    throw new ApiError(400, "INVALID_CONTENT", "默认播放顺序无效");
  }
  const playerDefaultVolume = Number(value.playerDefaultVolume);
  if (!Number.isFinite(playerDefaultVolume) || playerDefaultVolume < 0 || playerDefaultVolume > 1) {
    throw new ApiError(400, "INVALID_CONTENT", "默认音量范围无效");
  }
  let weatherLocation = null;
  if (value.weatherLocation !== null) {
    if (!isRecord(value.weatherLocation)) throw new ApiError(400, "INVALID_CONTENT", "默认天气城市格式无效");
    knownKeys(value.weatherLocation, ["city", "latitude", "longitude"]);
    const latitude = Number(value.weatherLocation.latitude);
    const longitude = Number(value.weatherLocation.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new ApiError(400, "INVALID_CONTENT", "默认天气坐标无效");
    }
    weatherLocation = {
      city: text(value.weatherLocation.city, "默认天气城市", 80, false),
      latitude,
      longitude,
    };
  }
  return {
    siteStartShow: boolean(value.siteStartShow, "建站日期显示"),
    footerBlur: boolean(value.footerBlur, "底栏背景模糊"),
    messageNameShow: boolean(value.messageNameShow, "主页名称显示"),
    playerAutoplay: boolean(value.playerAutoplay, "自动播放"),
    playerKeyboardShortcuts: boolean(value.playerKeyboardShortcuts, "播放器快捷键"),
    playerDefaultVolume: Math.round(playerDefaultVolume * 100) / 100,
    playerDefaultOrder,
    weatherLocation,
  };
};

const hitokoto = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_CONTENT", "一言配置格式无效");
  knownKeys(value, ["mode", "categories", "fixedText", "fixedFrom", "fallbackText", "fallbackFrom"]);
  const mode = text(value.mode, "一言模式", 20, false);
  if (!(["remote", "fixed"] as string[]).includes(mode)) {
    throw new ApiError(400, "INVALID_CONTENT", "不支持的一言模式");
  }
  if (!Array.isArray(value.categories) || value.categories.length > 12) {
    throw new ApiError(400, "INVALID_CONTENT", "一言分类格式无效");
  }
  return {
    mode,
    categories: value.categories.map((category) => text(category, "一言分类", 20, false)),
    fixedText: text(value.fixedText, "固定一言", 300),
    fixedFrom: text(value.fixedFrom, "固定一言来源", 80),
    fallbackText: text(value.fallbackText, "一言回退文本", 300, false),
    fallbackFrom: text(value.fallbackFrom, "一言回退来源", 80, false),
  };
};

const validators: Record<ContentSectionKey, (value: unknown) => unknown> = {
  profile,
  siteLinks,
  socialLinks,
  music,
  wallpaper,
  preferences,
  hitokoto,
};

export const isContentSectionKey = (value: string): value is ContentSectionKey => {
  return (CONTENT_SECTION_KEYS as readonly string[]).includes(value);
};

export const normalizeContentSection = (section: ContentSectionKey, value: unknown) => {
  return validators[section](value);
};

export const loadSiteContent = async (db: D1Database) => {
  const result = await db.prepare(`
    SELECT section_key, content_json, revision, updated_at
    FROM content_sections
    ORDER BY section_key
  `).all<ContentRow>();
  const rows = result.results || [];
  const rowMap = new Map(rows.map((row) => [row.section_key, row]));
  const sections: Record<string, unknown> = {};
  const sectionRevisions: Record<string, number> = {};
  let generatedAt = "";

  for (const key of CONTENT_SECTION_KEYS) {
    const row = rowMap.get(key);
    if (!row) throw new ApiError(503, "SITE_CONFIG_NOT_INITIALIZED", "站点配置尚未初始化");
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.content_json) as unknown;
      sections[key] = normalizeContentSection(key, parsed);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ApiError(500, "INVALID_STORED_CONTENT", "站点配置暂时不可用");
      }
      throw error;
    }
    sectionRevisions[key] = Number(row.revision);
    if (row.updated_at > generatedAt) generatedAt = row.updated_at;
  }

  const revision = CONTENT_SECTION_KEYS.map((key) => `${key}:${sectionRevisions[key]}`).join("|");
  return {
    schemaVersion: 5,
    revision,
    generatedAt,
    etag: `W/\"site-config-${revision}\"`,
    sectionRevisions,
    sections,
  };
};

export const siteConfigCacheUrl = (request: Request) => {
  return new URL("/__edge-cache/site-config-v5", request.url).toString();
};

export const musicCacheUrl = (request: Request) => {
  return new URL("/__edge-cache/music-v2", request.url).toString();
};

export const hitokotoCacheUrl = (request: Request) => {
  return new URL("/__edge-cache/hitokoto", request.url).toString();
};
