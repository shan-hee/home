import { ApiError } from "./api";
import { fetchWithTimeout } from "./http";
import type { AppEnvironment } from "./types";

export type RemoteWallpaperSource = "bing" | "wallhaven";
export type WallpaperVariant = "desktop" | "mobile";

export interface RemoteWallpaper {
  source: RemoteWallpaperSource;
  variant: WallpaperVariant;
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
}

interface BingPayload {
  code?: unknown;
  data?: {
    title?: unknown;
    description?: unknown;
    cover?: unknown;
    copyright?: unknown;
  };
}

interface WallhavenPayload {
  data?: Array<{
    id?: unknown;
    url?: unknown;
    path?: unknown;
  }>;
}

const upstreamText = (value: unknown, fallback: string, maxLength = 300) => {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
};

const trustedUrl = (value: unknown, hosts: readonly string[], pathPrefix = "/") => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || !hosts.includes(url.hostname)
      || !url.pathname.startsWith(pathPrefix)
      || url.username
      || url.password
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const remoteWallpaperImageUrl = (value: unknown) => {
  return trustedUrl(value, ["bing.com", "www.bing.com"], "/th")
    || trustedUrl(value, ["w.wallhaven.cc"], "/full/");
};

const readJson = async <Payload>(url: URL) => {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, { headers: { accept: "application/json" } }, 10000);
  } catch {
    throw new ApiError(502, "WALLPAPER_UPSTREAM_FAILED", "壁纸服务暂时不可用");
  }
  if (!response.ok) {
    throw new ApiError(502, "WALLPAPER_UPSTREAM_FAILED", "壁纸服务暂时不可用");
  }
  try {
    return await response.json() as Payload;
  } catch {
    throw new ApiError(502, "WALLPAPER_UPSTREAM_INVALID", "壁纸服务返回无效数据");
  }
};

const fetchBingWallpaper = async (variant: WallpaperVariant): Promise<RemoteWallpaper> => {
  const upstream = new URL("https://api.nxvav.cn/api/bing/");
  upstream.searchParams.set("encode", "json");
  upstream.searchParams.set("type", variant === "desktop" ? "pc" : "mobile");
  const payload = await readJson<BingPayload>(upstream);
  const imageUrl = remoteWallpaperImageUrl(payload.data?.cover);
  if (payload.code !== 200 || !imageUrl) {
    throw new ApiError(502, "WALLPAPER_UPSTREAM_INVALID", "必应壁纸服务返回无效数据");
  }
  const description = [
    upstreamText(payload.data?.description, "", 300),
    upstreamText(payload.data?.copyright, "", 200),
  ].filter(Boolean).join(" · ");
  return {
    source: "bing",
    variant,
    title: upstreamText(payload.data?.title, "Bing 每日壁纸", 120),
    description,
    imageUrl,
    pageUrl: "https://www.bing.com/",
  };
};

const fetchWallhavenWallpaper = async (variant: WallpaperVariant, env: AppEnvironment): Promise<RemoteWallpaper> => {
  const upstream = new URL("https://wallhaven.cc/api/v1/search");
  upstream.searchParams.set("categories", "111");
  upstream.searchParams.set("purity", "100");
  upstream.searchParams.set("sorting", "random");
  upstream.searchParams.set("atleast", variant === "desktop" ? "1920x1080" : "1080x1920");
  upstream.searchParams.set("ratios", variant === "desktop" ? "landscape" : "portrait");
  const apiKey = env.WALLHAVEN_API_KEY?.trim();
  if (apiKey) upstream.searchParams.set("apikey", apiKey);

  const payload = await readJson<WallhavenPayload>(upstream);
  const candidates = (payload.data || []).flatMap((item) => {
    const imageUrl = remoteWallpaperImageUrl(item.path);
    const pageUrl = trustedUrl(item.url, ["wallhaven.cc", "www.wallhaven.cc"], "/w/");
    return imageUrl && pageUrl ? [{ item, imageUrl, pageUrl }] : [];
  });
  const candidate = candidates[Math.floor(Math.random() * candidates.length)];
  if (!candidate) {
    throw new ApiError(502, "WALLPAPER_UPSTREAM_INVALID", "Wallhaven 没有返回可用壁纸");
  }
  const id = upstreamText(candidate.item.id, "", 20);
  return {
    source: "wallhaven",
    variant,
    title: id ? `Wallhaven #${id}` : "Wallhaven 随机壁纸",
    description: variant === "desktop" ? "随机桌面壁纸" : "随机移动壁纸",
    imageUrl: candidate.imageUrl,
    pageUrl: candidate.pageUrl,
  };
};

export const fetchRemoteWallpaper = (
  source: RemoteWallpaperSource,
  variant: WallpaperVariant,
  env: AppEnvironment,
) => source === "bing" ? fetchBingWallpaper(variant) : fetchWallhavenWallpaper(variant, env);
