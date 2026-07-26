import { apiResponse, ApiError, errorResponse, getRequestId } from "../../lib/api";
import { requireOwnerSession } from "../../lib/auth";
import { fetchMusicPlaylist } from "../../lib/music";
import type { MusicQuery } from "../../lib/music";
import { normalizeContentSection } from "../../lib/siteContent";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    await requireOwnerSession(context.request, context.env);
    const params = new URL(context.request.url).searchParams;
    const query = normalizeContentSection("music", {
      server: params.get("server"),
      type: params.get("type"),
      id: params.get("id"),
    }) as MusicQuery;
    if (!query.id) throw new ApiError(400, "MUSIC_QUERY_REQUIRED", "请输入资源 ID 或搜索词");
    const tracks = await fetchMusicPlaylist(query);
    return apiResponse({ tracks }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
