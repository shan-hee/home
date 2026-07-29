import { ApiError, errorResponse, getRequestId } from "../../lib/api";
import { cachedResponse } from "../../lib/cache";
import type { PagesContext } from "../../lib/types";

interface AssetRow {
  object_key: string;
  mime_type: string;
  original_name: string;
}

type AssetKind = "wallpaper" | "site_icon";

const routeId = (context: PagesContext) => {
  const value = context.params?.id;
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
};

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  const id = routeId(context);
  const url = new URL(context.request.url);
  const download = url.searchParams.get("download") === "1";
  const kind: AssetKind = url.searchParams.get("kind") === "site-icon" ? "site_icon" : "wallpaper";
  try {
    return await cachedResponse(context.request.url, 31536000, context, async () => {
      const asset = await context.env.DB.prepare(
        "SELECT object_key, mime_type, original_name FROM assets WHERE id = ? AND kind = ?",
      ).bind(id, kind).first<AssetRow>();
      if (!asset) throw new ApiError(404, "ASSET_NOT_FOUND", "资源不存在");
      const object = await context.env.ASSET_BUCKET.get(asset.object_key);
      if (!object) throw new ApiError(404, "ASSET_OBJECT_NOT_FOUND", "资源文件不存在");
      const headers = new Headers({
        "content-type": object.httpMetadata?.contentType || asset.mime_type,
        "cache-control": "public, max-age=31536000, immutable",
        etag: object.httpEtag,
        "x-content-type-options": "nosniff",
        "x-request-id": requestId,
      });
      if (asset.mime_type === "image/svg+xml") {
        headers.set("content-security-policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        headers.set("referrer-policy", "no-referrer");
        headers.set("x-frame-options", "DENY");
      }
      if (download) headers.set("content-disposition", `attachment; filename="asset"; filename*=UTF-8''${encodeURIComponent(asset.original_name)}`);
      return new Response(object.body, { headers });
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
