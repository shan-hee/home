import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { cachedResponse } from "../../lib/cache";
import { resolveNeteasePlaybackUrl } from "../../lib/music";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const id = new URL(context.request.url).searchParams.get("id")?.trim() || "";
    const cacheUrl = new URL(`/__edge-cache/music/resolve/${encodeURIComponent(id)}`, context.request.url).toString();
    return await cachedResponse(cacheUrl, 300, context, async () => {
      const url = await resolveNeteasePlaybackUrl(id);
      return apiResponse({ url }, requestId, {}, "public, max-age=300");
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
