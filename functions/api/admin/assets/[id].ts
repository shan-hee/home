import { apiResponse, ApiError, errorResponse, getRequestId, requireSameOrigin } from "../../../lib/api";
import { requireOwnerSession, writeAuditLog } from "../../../lib/auth";
import { deleteCachedResponse } from "../../../lib/cache";
import type { PagesContext } from "../../../lib/types";

interface AssetRow {
  id: string;
  object_key: string;
}

const routeId = (context: PagesContext) => {
  const value = context.params?.id;
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
};

export const onRequestDelete = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request, context.env);
    const session = await requireOwnerSession(context.request, context.env);
    const id = routeId(context);
    const asset = await context.env.DB.prepare("SELECT id, object_key FROM assets WHERE id = ?").bind(id).first<AssetRow>();
    if (!asset) throw new ApiError(404, "ASSET_NOT_FOUND", "壁纸资源不存在");
    const wallpaper = await context.env.DB.prepare("SELECT content_json FROM content_sections WHERE section_key = 'wallpaper'").first<{ content_json: string }>();
    const content = wallpaper ? JSON.parse(wallpaper.content_json) as { desktopAssetId?: unknown; mobileAssetId?: unknown } : {};
    if (content.desktopAssetId === id || content.mobileAssetId === id) {
      throw new ApiError(409, "ASSET_IN_USE", "当前壁纸正在使用，不能删除");
    }
    await context.env.DB.prepare("DELETE FROM assets WHERE id = ?").bind(id).run();
    await context.env.WALLPAPER_BUCKET.delete(asset.object_key);
    await Promise.all([
      deleteCachedResponse(new URL(`/api/assets/${id}`, context.request.url).toString()),
      writeAuditLog(context.env, session, "asset.delete", id),
    ]);
    return apiResponse({ deleted: true, id }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
