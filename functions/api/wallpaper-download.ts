import { ApiError, errorResponse, getRequestId } from "../lib/api";
import { fetchWithTimeout, securityHeaders } from "../lib/http";
import { remoteWallpaperImageUrl } from "../lib/wallpaper";
import type { PagesContext } from "../lib/types";

const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024;
const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const source = remoteWallpaperImageUrl(new URL(context.request.url).searchParams.get("url"));
    if (!source) throw new ApiError(400, "WALLPAPER_URL_INVALID", "壁纸下载地址无效");

    let response: Response;
    try {
      response = await fetchWithTimeout(source, { headers: { accept: "image/avif,image/webp,image/png,image/jpeg" } }, 15000);
    } catch {
      throw new ApiError(502, "WALLPAPER_DOWNLOAD_FAILED", "壁纸暂时无法下载");
    }
    if (!response.ok) throw new ApiError(502, "WALLPAPER_DOWNLOAD_FAILED", "壁纸暂时无法下载");
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || "";
    const extension = imageTypes.get(contentType);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (!extension || (Number.isFinite(declaredSize) && declaredSize > MAX_DOWNLOAD_SIZE)) {
      throw new ApiError(415, "WALLPAPER_DOWNLOAD_INVALID", "壁纸文件格式或大小无效");
    }
    const content = await response.arrayBuffer();
    if (content.byteLength < 1 || content.byteLength > MAX_DOWNLOAD_SIZE) {
      throw new ApiError(413, "WALLPAPER_DOWNLOAD_TOO_LARGE", "壁纸文件超过 50MB");
    }
    const headers = new Headers({
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="wallpaper.${extension}"`,
      "content-length": String(content.byteLength),
      "content-type": contentType,
      "x-request-id": requestId,
    });
    Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value));
    return new Response(content, { headers });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
