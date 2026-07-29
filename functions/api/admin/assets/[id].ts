import { apiResponse, ApiError, errorResponse, getRequestId, requireSameOrigin } from "../../../lib/api";
import { requireOwnerSession, writeAuditLog } from "../../../lib/auth";
import { deleteCachedResponse } from "../../../lib/cache";
import type { PagesContext } from "../../../lib/types";

interface AssetRow {
  id: string;
  object_key: string;
  kind: "wallpaper" | "site_icon";
}

const routeId = (context: PagesContext) => {
  const value = context.params?.id;
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
};

export const onRequestDelete = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request);
    const session = await requireOwnerSession(context.request, context.env);
    const id = routeId(context);
    const asset = await context.env.DB.prepare("SELECT id, object_key, kind FROM assets WHERE id = ?").bind(id).first<AssetRow>();
    if (!asset) throw new ApiError(404, "ASSET_NOT_FOUND", "资源不存在");
    if (asset.kind === "wallpaper") {
      const wallpaper = await context.env.DB.prepare("SELECT content_json FROM content_sections WHERE section_key = 'wallpaper'").first<{ content_json: string }>();
      const content = wallpaper ? JSON.parse(wallpaper.content_json) as { desktopAssetId?: unknown; mobileAssetId?: unknown } : {};
      if (content.desktopAssetId === id || content.mobileAssetId === id) {
        throw new ApiError(409, "ASSET_IN_USE", "当前壁纸正在使用，不能删除");
      }
    } else {
      const links = await context.env.DB.prepare("SELECT content_json FROM content_sections WHERE section_key = 'siteLinks'").first<{ content_json: string }>();
      const content = links ? JSON.parse(links.content_json) as Array<{ iconMode?: unknown; iconValue?: unknown }> : [];
      if (content.some((link) => link.iconMode === "asset" && link.iconValue === id)) {
        throw new ApiError(409, "ASSET_IN_USE", "当前网站图标正在使用，不能删除");
      }
    }
    await context.env.DB.prepare("DELETE FROM assets WHERE id = ?").bind(id).run();
    await context.env.ASSET_BUCKET.delete(asset.object_key);
    await Promise.all([
      deleteCachedResponse(new URL(
        asset.kind === "site_icon" ? `/api/assets/${id}?kind=site-icon` : `/api/assets/${id}`,
        context.request.url,
      ).toString()),
      writeAuditLog(context.env, session, "asset.delete", id),
    ]);
    return apiResponse({ deleted: true, id }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
