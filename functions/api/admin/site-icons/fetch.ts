import { apiResponse, ApiError, errorResponse, getRequestId, parseJsonBody, requireSameOrigin } from "../../../lib/api";
import { requireOwnerSession, writeAuditLog } from "../../../lib/auth";
import { fetchSiteIcon } from "../../../lib/siteIcon";
import type { PagesContext } from "../../../lib/types";

interface FetchBody {
  siteUrl?: unknown;
  iconUrl?: unknown;
}

interface AssetRow {
  id: string;
  object_key: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
}

const assetResponse = (asset: AssetRow) => ({
  id: asset.id,
  url: `/api/assets/${asset.id}?kind=site-icon`,
  mimeType: asset.mime_type,
  sizeBytes: Number(asset.size_bytes),
  checksum: asset.checksum,
});

export const onRequestPost = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request);
    const session = await requireOwnerSession(context.request, context.env);
    const body = await parseJsonBody<FetchBody>(context.request, 2048);
    const icon = await fetchSiteIcon(body.siteUrl, body.iconUrl);
    const existing = await context.env.DB.prepare(`
      SELECT id, object_key, mime_type, size_bytes, checksum
      FROM assets
      WHERE kind = 'site_icon' AND checksum = ?
    `).bind(icon.checksum).first<AssetRow>();
    if (existing) return apiResponse({ asset: assetResponse(existing), reused: true }, requestId);

    const id = crypto.randomUUID();
    const objectKey = `site-icons/${icon.checksum}.${icon.extension}`;
    await context.env.ASSET_BUCKET.put(objectKey, icon.bytes, {
      httpMetadata: { contentType: icon.mimeType, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { kind: "site_icon", checksum: icon.checksum },
    });
    const now = new Date().toISOString();
    try {
      await context.env.DB.prepare(`
        INSERT INTO assets (
          id, object_key, kind, variant, original_name, mime_type,
          size_bytes, checksum, created_at, created_by_device
        ) VALUES (?, ?, 'site_icon', NULL, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, objectKey, `site-icon.${icon.extension}`, icon.mimeType,
        icon.bytes.byteLength, icon.checksum, now, session.deviceId,
      ).run();
    } catch (error) {
      const duplicate = await context.env.DB.prepare(`
        SELECT id, object_key, mime_type, size_bytes, checksum
        FROM assets
        WHERE kind = 'site_icon' AND checksum = ?
      `).bind(icon.checksum).first<AssetRow>();
      if (duplicate) return apiResponse({ asset: assetResponse(duplicate), reused: true }, requestId);
      await context.env.ASSET_BUCKET.delete(objectKey);
      throw error;
    }

    const asset: AssetRow = {
      id, object_key: objectKey, mime_type: icon.mimeType,
      size_bytes: icon.bytes.byteLength, checksum: icon.checksum,
    };
    await writeAuditLog(context.env, session, "site-icon.create", id, {
      sizeBytes: icon.bytes.byteLength,
      mimeType: icon.mimeType,
      checksum: icon.checksum,
    });
    return apiResponse({ asset: assetResponse(asset), reused: false }, requestId, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error, requestId);
    return errorResponse(error, requestId);
  }
};
