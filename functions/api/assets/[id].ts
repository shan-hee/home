import { ApiError, errorResponse, getRequestId } from "../../lib/api";
import { cachedResponse } from "../../lib/cache";
import type { PagesContext } from "../../lib/types";

interface AssetRow {
  object_key: string;
  mime_type: string;
}

const routeId = (context: PagesContext) => {
  const value = context.params?.id;
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
};

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  const id = routeId(context);
  try {
    return await cachedResponse(context.request.url, 31536000, context, async () => {
      const asset = await context.env.DB.prepare("SELECT object_key, mime_type FROM assets WHERE id = ?").bind(id).first<AssetRow>();
      if (!asset) throw new ApiError(404, "ASSET_NOT_FOUND", "资源不存在");
      const object = await context.env.WALLPAPER_BUCKET.get(asset.object_key);
      if (!object) throw new ApiError(404, "ASSET_OBJECT_NOT_FOUND", "资源文件不存在");
      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType || asset.mime_type,
          "cache-control": "public, max-age=31536000, immutable",
          etag: object.httpEtag,
          "x-content-type-options": "nosniff",
          "x-request-id": requestId,
        },
      });
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
