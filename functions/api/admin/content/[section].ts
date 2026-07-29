import {
  apiResponse,
  ApiError,
  errorResponse,
  getRequestId,
  parseJsonBody,
  requireSameOrigin,
} from "../../../lib/api";
import { requireOwnerSession, writeAuditLog } from "../../../lib/auth";
import { deleteCachedResponse } from "../../../lib/cache";
import {
  hitokotoCacheUrl,
  isContentSectionKey,
  musicCacheUrl,
  normalizeContentSection,
  siteConfigCacheUrl,
} from "../../../lib/siteContent";
import type { PagesContext } from "../../../lib/types";

interface UpdateBody {
  mutationId?: unknown;
  baseRevision?: unknown;
  content?: unknown;
}

interface MutationRow {
  section_key: string;
  response_json: string;
}

interface SiteIconRow {
  id: string;
  object_key: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const routeSection = (context: PagesContext) => {
  const value = context.params?.section;
  return Array.isArray(value) ? value[0] : value;
};

const changes = (result: { meta?: Record<string, unknown> }) => {
  const value = Number(result.meta?.changes || 0);
  return Number.isFinite(value) ? value : 0;
};

export const onRequestPut = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request);
    const session = await requireOwnerSession(context.request, context.env);
    const section = routeSection(context)?.trim() || "";
    if (!isContentSectionKey(section)) {
      throw new ApiError(404, "CONTENT_SECTION_NOT_FOUND", "配置分区不存在");
    }

    const body = await parseJsonBody<UpdateBody>(context.request, 64 * 1024);
    const mutationId = typeof body.mutationId === "string" ? body.mutationId.trim() : "";
    if (!UUID_PATTERN.test(mutationId)) {
      throw new ApiError(400, "INVALID_MUTATION_ID", "保存操作标识无效");
    }
    const applied = await context.env.DB.prepare(
      "SELECT section_key, response_json FROM admin_mutations WHERE mutation_id = ?",
    ).bind(mutationId).first<MutationRow>();
    if (applied) {
      if (applied.section_key !== section) {
        throw new ApiError(409, "MUTATION_SECTION_CONFLICT", "保存操作标识已用于其它配置分区");
      }
      return apiResponse(JSON.parse(applied.response_json), requestId);
    }
    if (!Number.isInteger(body.baseRevision) || (body.baseRevision as number) < 0) {
      throw new ApiError(400, "INVALID_CONTENT_REVISION", "配置版本无效");
    }
    const content = normalizeContentSection(section, body.content);
    const baseRevision = body.baseRevision as number;
    const retainedSiteIconIds = new Set<string>();
    const previousSiteIconIds = new Set<string>();
    if (section === "wallpaper") {
      const wallpaper = content as { desktopAssetId: string | null; mobileAssetId: string | null };
      const assets = [
        [wallpaper.desktopAssetId, "desktop"],
        [wallpaper.mobileAssetId, "mobile"],
      ] as const;
      await Promise.all(assets.map(async ([assetId, variant]) => {
        if (!assetId) return;
        const asset = await context.env.DB.prepare(
          "SELECT id FROM assets WHERE id = ? AND kind = 'wallpaper' AND variant = ?",
        ).bind(assetId, variant).first<{ id: string }>();
        if (!asset) throw new ApiError(400, "INVALID_WALLPAPER_ASSET", `${variant === "desktop" ? "桌面端" : "移动端"}壁纸资源不存在`);
      }));
    }
    if (section === "siteLinks") {
      const links = content as Array<{ iconMode: "text" | "icon" | "asset"; iconValue: string }>;
      links.filter((link) => link.iconMode === "asset").forEach((link) => retainedSiteIconIds.add(link.iconValue));
      await Promise.all([...retainedSiteIconIds].map(async (id) => {
        const asset = await context.env.DB.prepare(
          "SELECT id FROM assets WHERE id = ? AND kind = 'site_icon'",
        ).bind(id).first<{ id: string }>();
        if (!asset) throw new ApiError(400, "INVALID_SITE_ICON_ASSET", "网站图标资源不存在");
      }));
      if (baseRevision > 0) {
        const current = await context.env.DB.prepare(
          "SELECT content_json FROM content_sections WHERE section_key = 'siteLinks' AND revision = ?",
        ).bind(baseRevision).first<{ content_json: string }>();
        if (current) {
          const currentLinks = JSON.parse(current.content_json) as unknown;
          if (Array.isArray(currentLinks)) {
            currentLinks.forEach((link) => {
              if (
                link && typeof link === "object"
                && "iconMode" in link && link.iconMode === "asset"
                && "iconValue" in link && typeof link.iconValue === "string"
                && UUID_PATTERN.test(link.iconValue)
              ) previousSiteIconIds.add(link.iconValue);
            });
          }
        }
      }
    }
    const now = new Date().toISOString();
    const revision = baseRevision + 1;
    const response = { section, content, revision, updatedAt: now };
    let result: { meta?: Record<string, unknown> } | undefined;

    if (baseRevision === 0) {
      try {
        [result] = await context.env.DB.batch([
          context.env.DB.prepare(`
            INSERT INTO content_sections (
              section_key, content_json, revision, updated_at, updated_by_device
            ) VALUES (?, ?, 1, ?, ?)
          `).bind(section, JSON.stringify(content), now, session.deviceId),
          context.env.DB.prepare(`
            INSERT INTO admin_mutations (mutation_id, device_id, section_key, response_json, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).bind(mutationId, session.deviceId, section, JSON.stringify(response), now),
        ]);
      } catch {
        throw new ApiError(409, "CONTENT_CONFLICT", "配置已被其它页面修改，请重新加载");
      }
    } else {
      [result] = await context.env.DB.batch([
        context.env.DB.prepare(`
          UPDATE content_sections
          SET content_json = ?,
              revision = revision + 1,
              updated_at = ?,
              updated_by_device = ?
          WHERE section_key = ? AND revision = ?
        `).bind(JSON.stringify(content), now, session.deviceId, section, baseRevision),
        context.env.DB.prepare(`
          INSERT INTO admin_mutations (mutation_id, device_id, section_key, response_json, created_at)
          SELECT ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM content_sections
            WHERE section_key = ? AND revision = ? AND updated_at = ? AND updated_by_device = ?
          )
        `).bind(
          mutationId, session.deviceId, section, JSON.stringify(response), now,
          section, revision, now, session.deviceId,
        ),
      ]);
    }
    if (!result || changes(result) !== 1) {
      throw new ApiError(409, "CONTENT_CONFLICT", "配置已被其它页面修改，请重新加载");
    }

    await writeAuditLog(context.env, session, "content.update", section, { revision });
    if (section === "siteLinks") {
      const removedIds = [...previousSiteIconIds].filter((id) => !retainedSiteIconIds.has(id));
      const cleanup = Promise.allSettled(removedIds.map(async (id) => {
        const asset = await context.env.DB.prepare(
          "SELECT id, object_key FROM assets WHERE id = ? AND kind = 'site_icon'",
        ).bind(id).first<SiteIconRow>();
        if (!asset) return;
        await context.env.ASSET_BUCKET.delete(asset.object_key);
        await context.env.DB.prepare("DELETE FROM assets WHERE id = ? AND kind = 'site_icon'").bind(asset.id).run();
        await deleteCachedResponse(new URL(`/api/assets/${asset.id}?kind=site-icon`, context.request.url).toString());
      })).then((results) => {
        results.forEach((result) => {
          if (result.status === "rejected") console.error("清理未引用网站图标失败：", result.reason);
        });
      });
      if (context.waitUntil) context.waitUntil(cleanup);
      else await cleanup;
    }
    const cacheDeletes = [deleteCachedResponse(siteConfigCacheUrl(context.request))];
    if (section === "music") cacheDeletes.push(deleteCachedResponse(musicCacheUrl(context.request)));
    if (section === "hitokoto") cacheDeletes.push(deleteCachedResponse(hitokotoCacheUrl(context.request)));
    await Promise.all(cacheDeletes);
    return apiResponse(response, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
