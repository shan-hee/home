import { apiResponse, ApiError, errorResponse, getRequestId } from "../lib/api";
import { cachedResponse } from "../lib/cache";
import { fetchWithTimeout } from "../lib/http";
import { loadSiteContent, musicCacheUrl } from "../lib/siteContent";
import type { PagesContext } from "../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    return await cachedResponse(musicCacheUrl(context.request), 300, context, async () => {
      const config = await loadSiteContent(context.env.DB);
      const music = config.sections.music as {
        enabled: boolean;
        server: string;
        type: string;
        id: string;
      };
      if (!music.enabled || !music.id) return apiResponse([], requestId, {}, "public, max-age=300");

      const upstreamValue = context.env.MUSIC_API_URL?.trim() || "";
      let upstream: URL;
      try {
        upstream = new URL(upstreamValue);
        if (upstream.protocol !== "https:") throw new Error("protocol");
      } catch {
        throw new ApiError(503, "MUSIC_NOT_CONFIGURED", "音乐服务暂时不可用");
      }
      upstream.searchParams.set("server", music.server);
      upstream.searchParams.set("type", music.type);
      upstream.searchParams.set("id", music.id);

      const response = await fetchWithTimeout(upstream, {
        headers: { accept: "application/json" },
      }, 10000);
      if (!response.ok) throw new ApiError(502, "MUSIC_UPSTREAM_FAILED", "音乐服务暂时不可用");
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new ApiError(502, "MUSIC_UPSTREAM_INVALID", "音乐服务暂时不可用");
      return apiResponse(payload, requestId, {}, "public, max-age=300");
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
