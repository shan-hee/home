import { apiResponse, ApiError, errorResponse, getRequestId, requireSameOrigin } from "../../lib/api";
import { requireOwnerSession, writeAuditLog } from "../../lib/auth";
import type { PagesContext } from "../../lib/types";

interface AssetRow {
  id: string;
  object_key: string;
  kind: "wallpaper";
  variant: "desktop" | "mobile";
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  created_at: string;
}

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

const validImageHeader = (bytes: Uint8Array, type: string) => {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (type === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (type === "image/avif") {
    if (bytes.length < 16 || new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp") return false;
    const brands = new TextDecoder().decode(bytes.slice(8));
    return brands.includes("avif") || brands.includes("avis");
  }
  return false;
};

const assetResponse = (row: AssetRow) => ({
  id: row.id,
  kind: row.kind,
  variant: row.variant,
  originalName: row.original_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  checksum: row.checksum,
  createdAt: row.created_at,
  url: `/api/assets/${row.id}`,
});

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    await requireOwnerSession(context.request, context.env);
    const result = await context.env.DB.prepare(`
      SELECT id, object_key, kind, variant, original_name, mime_type, size_bytes, checksum, created_at
      FROM assets
      WHERE kind = 'wallpaper'
      ORDER BY created_at DESC
    `).all<AssetRow>();
    return apiResponse({ assets: (result.results || []).map(assetResponse) }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};

export const onRequestPost = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request, context.env);
    const session = await requireOwnerSession(context.request, context.env);
    const form = await context.request.formData();
    const file = form.get("file");
    const variant = form.get("variant");
    if (!(file instanceof File) || (variant !== "desktop" && variant !== "mobile")) {
      throw new ApiError(400, "INVALID_ASSET_UPLOAD", "壁纸文件或适用设备无效");
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      throw new ApiError(400, "INVALID_ASSET_SIZE", "壁纸文件大小应在 1 字节到 10MB 之间");
    }
    const extension = allowedTypes.get(file.type.toLowerCase());
    if (!extension) throw new ApiError(400, "INVALID_ASSET_TYPE", "仅支持 JPEG、PNG、WebP 和 AVIF 壁纸");
    const body = await file.arrayBuffer();
    if (!validImageHeader(new Uint8Array(body.slice(0, 64)), file.type.toLowerCase())) {
      throw new ApiError(400, "INVALID_ASSET_CONTENT", "壁纸文件内容与声明格式不一致");
    }
    const checksumBytes = await crypto.subtle.digest("SHA-256", body);
    const checksum = [...new Uint8Array(checksumBytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
    const id = crypto.randomUUID();
    const objectKey = `wallpapers/${variant}/${id}.${extension}`;
    await context.env.WALLPAPER_BUCKET.put(objectKey, body, {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { assetId: id, checksum },
    });
    const now = new Date().toISOString();
    try {
      await context.env.DB.prepare(`
        INSERT INTO assets (
          id, object_key, kind, variant, original_name, mime_type,
          size_bytes, checksum, created_at, created_by_device
        ) VALUES (?, ?, 'wallpaper', ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, objectKey, variant, file.name.slice(0, 200), file.type, file.size, checksum, now, session.deviceId).run();
    } catch (error) {
      await context.env.WALLPAPER_BUCKET.delete(objectKey);
      throw error;
    }
    const row: AssetRow = {
      id, object_key: objectKey, kind: "wallpaper", variant,
      original_name: file.name.slice(0, 200), mime_type: file.type,
      size_bytes: file.size, checksum, created_at: now,
    };
    await writeAuditLog(context.env, session, "asset.create", id, { variant, sizeBytes: file.size, checksum });
    return apiResponse({ asset: assetResponse(row) }, requestId, { status: 201 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
