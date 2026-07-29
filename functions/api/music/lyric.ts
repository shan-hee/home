import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { cachedResponse } from "../../lib/cache";
import { resolveNeteaseLyrics } from "../../lib/music";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const id = new URL(context.request.url).searchParams.get("id")?.trim() || "";
    const cacheUrl = new URL(`/__edge-cache/music/lyric/${encodeURIComponent(id)}`, context.request.url).toString();
    return await cachedResponse(cacheUrl, 30 * 24 * 60 * 60, context, async () => {
      const lyrics = await resolveNeteaseLyrics(id);
      return apiResponse(lyrics, requestId, {}, "public, max-age=2592000, immutable");
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
