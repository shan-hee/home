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
  baseRevision?: unknown;
  content?: unknown;
}

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
    requireSameOrigin(context.request, context.env);
    const session = await requireOwnerSession(context.request, context.env);
    const section = routeSection(context)?.trim() || "";
    if (!isContentSectionKey(section)) {
      throw new ApiError(404, "CONTENT_SECTION_NOT_FOUND", "配置分区不存在");
    }

    const body = await parseJsonBody<UpdateBody>(context.request, 64 * 1024);
    if (!Number.isInteger(body.baseRevision) || (body.baseRevision as number) < 0) {
      throw new ApiError(400, "INVALID_CONTENT_REVISION", "配置版本无效");
    }
    const content = normalizeContentSection(section, body.content);
    const baseRevision = body.baseRevision as number;
    const now = new Date().toISOString();
    let revision: number;

    if (baseRevision === 0) {
      try {
        await context.env.DB.prepare(`
          INSERT INTO content_sections (
            section_key, content_json, revision, updated_at, updated_by_device
          ) VALUES (?, ?, 1, ?, ?)
        `).bind(section, JSON.stringify(content), now, session.deviceId).run();
        revision = 1;
      } catch {
        throw new ApiError(409, "CONTENT_CONFLICT", "配置已被其它页面修改，请重新加载");
      }
    } else {
      const result = await context.env.DB.prepare(`
        UPDATE content_sections
        SET content_json = ?,
            revision = revision + 1,
            updated_at = ?,
            updated_by_device = ?
        WHERE section_key = ? AND revision = ?
      `).bind(JSON.stringify(content), now, session.deviceId, section, baseRevision).run();
      if (changes(result) !== 1) {
        throw new ApiError(409, "CONTENT_CONFLICT", "配置已被其它页面修改，请重新加载");
      }
      revision = baseRevision + 1;
    }

    await writeAuditLog(context.env, session, "content.update", section, { revision });
    const cacheDeletes = [deleteCachedResponse(siteConfigCacheUrl(context.request))];
    if (section === "music") cacheDeletes.push(deleteCachedResponse(musicCacheUrl(context.request)));
    if (section === "hitokoto") cacheDeletes.push(deleteCachedResponse(hitokotoCacheUrl(context.request)));
    await Promise.all(cacheDeletes);
    return apiResponse({ section, content, revision, updatedAt: now }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
