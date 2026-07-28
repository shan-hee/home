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

interface ImageFormat {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  extension: "jpg" | "png" | "webp" | "avif";
}

const MAX_ASSET_SIZE = 50 * 1024 * 1024;
const decoder = new TextDecoder();
const hasBytes = (bytes: Uint8Array, expected: readonly number[]) => bytes.length >= expected.length && expected.every((value, index) => bytes[index] === value);

const detectImageFormat = (bytes: Uint8Array): ImageFormat | null => {
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return { mimeType: "image/jpeg", extension: "jpg" };
  if (hasBytes(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return { mimeType: "image/png", extension: "png" };
  if (bytes.length >= 12 && decoder.decode(bytes.slice(0, 4)) === "RIFF" && decoder.decode(bytes.slice(8, 12)) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  if (bytes.length >= 16 && decoder.decode(bytes.slice(4, 8)) === "ftyp") {
    const brands = decoder.decode(bytes.slice(8));
    if (brands.includes("avif") || brands.includes("avis")) return { mimeType: "image/avif", extension: "avif" };
  }
  return null;
};

const normalizedFileName = (fileName: string, extension: ImageFormat["extension"]) => {
  const cleaned = fileName.trim().replace(/[\\/\u0000-\u001f\u007f]/g, "_");
  const base = cleaned.replace(/\.[^.]+$/, "").trim() || "wallpaper";
  const suffix = `.${extension}`;
  return `${base.slice(0, 200 - suffix.length)}${suffix}`;
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
    requireSameOrigin(context.request);
    const session = await requireOwnerSession(context.request, context.env);
    const form = await context.request.formData();
    const file = form.get("file");
    const variant = form.get("variant");
    if (!(file instanceof File) || (variant !== "desktop" && variant !== "mobile")) {
      throw new ApiError(400, "INVALID_ASSET_UPLOAD", "壁纸文件或适用设备无效");
    }
    if (file.size < 1 || file.size > MAX_ASSET_SIZE) {
      throw new ApiError(400, "INVALID_ASSET_SIZE", "壁纸文件大小应在 1 字节到 50MB 之间");
    }
    const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    const format = detectImageFormat(header);
    if (!format) throw new ApiError(400, "INVALID_ASSET_TYPE", "文件内容不是受支持的 JPEG、PNG、WebP 或 AVIF 图片");
    const id = crypto.randomUUID();
    const objectKey = `wallpapers/${variant}/${id}.${format.extension}`;
    const originalName = normalizedFileName(file.name, format.extension);
    const stored = await context.env.WALLPAPER_BUCKET.put(objectKey, file, {
      httpMetadata: { contentType: format.mimeType, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { assetId: id },
    });
    const checksum = stored.etag;
    const now = new Date().toISOString();
    try {
      await context.env.DB.prepare(`
        INSERT INTO assets (
          id, object_key, kind, variant, original_name, mime_type,
          size_bytes, checksum, created_at, created_by_device
        ) VALUES (?, ?, 'wallpaper', ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, objectKey, variant, originalName, format.mimeType, file.size, checksum, now, session.deviceId).run();
    } catch (error) {
      await context.env.WALLPAPER_BUCKET.delete(objectKey);
      throw error;
    }
    const row: AssetRow = {
      id, object_key: objectKey, kind: "wallpaper", variant,
      original_name: originalName, mime_type: format.mimeType,
      size_bytes: file.size, checksum, created_at: now,
    };
    await writeAuditLog(context.env, session, "asset.create", id, { variant, sizeBytes: file.size, mimeType: format.mimeType, checksum });
    return apiResponse({ asset: assetResponse(row) }, requestId, { status: 201 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
