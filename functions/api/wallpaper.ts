import { apiResponse, ApiError, errorResponse, getRequestId } from "../lib/api";
import { cachedResponse } from "../lib/cache";
import { fetchRemoteWallpaper } from "../lib/wallpaper";
import type { RemoteWallpaperSource, WallpaperVariant } from "../lib/wallpaper";
import type { PagesContext } from "../lib/types";

interface AssetRow {
  id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const params = new URL(context.request.url).searchParams;
    const source = params.get("source");
    const variant = params.get("variant");
    if (source !== "bing" && source !== "wallhaven" && source !== "custom") {
      throw new ApiError(400, "WALLPAPER_SOURCE_INVALID", "壁纸来源无效");
    }
    if (variant !== "desktop" && variant !== "mobile") {
      throw new ApiError(400, "WALLPAPER_VARIANT_INVALID", "壁纸尺寸类型无效");
    }

    if (source === "custom") {
      const current = params.get("current") || "";
      const cursor = Number(params.get("cursor"));
      if (!UUID_PATTERN.test(current) || !Number.isInteger(cursor) || cursor < 1 || cursor > 1000000) {
        throw new ApiError(400, "WALLPAPER_ROTATION_INVALID", "自定义壁纸轮换参数无效");
      }
      const result = await context.env.DB.prepare(`
        SELECT id
        FROM assets
        WHERE kind = 'wallpaper' AND variant = ?
        ORDER BY created_at DESC, id
      `).bind(variant).all<AssetRow>();
      const assets = result.results || [];
      const candidates = assets.filter((asset) => asset.id !== current);
      const asset = candidates[(cursor - 1) % candidates.length] || assets.find((item) => item.id === current);
      if (!asset) throw new ApiError(404, "WALLPAPER_NOT_FOUND", "没有可轮换的自定义壁纸");
      const imageUrl = `/api/assets/${encodeURIComponent(asset.id)}`;
      return apiResponse({
        source: "custom",
        variant,
        title: variant === "desktop" ? "自定义桌面壁纸" : "自定义移动壁纸",
        description: variant === "desktop" ? "自定义桌面壁纸" : "自定义移动壁纸",
        imageUrl,
        pageUrl: imageUrl,
      }, requestId, {}, "public, max-age=60");
    }

    const requestedRotation = Number(params.get("rotationMinutes"));
    const rotationMinutes = Number.isInteger(requestedRotation) && requestedRotation >= 1 && requestedRotation <= 10080
      ? requestedRotation
      : 1440;
    const ttl = source === "bing" ? 24 * 60 * 60 : rotationMinutes * 60;
    const slot = source === "bing"
      ? new Date().toISOString().slice(0, 10)
      : String(Math.floor(Date.now() / (ttl * 1000)));
    const cacheUrl = new URL(
      `/__edge-cache/wallpaper-v1/${source}/${variant}/${slot}`,
      context.request.url,
    ).toString();
    return await cachedResponse(cacheUrl, ttl, context, async () => {
      const wallpaper = await fetchRemoteWallpaper(
        source as RemoteWallpaperSource,
        variant as WallpaperVariant,
        context.env,
      );
      return apiResponse(wallpaper, requestId, {}, `public, max-age=${ttl}`);
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
