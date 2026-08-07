import { apiResponse, ApiError, errorResponse, getRequestId } from "../../lib/api";
import { requireOwnerSession } from "../../lib/auth";
import { fetchMusicPlaylist, fetchNeteaseUserPlaylists } from "../../lib/music";
import type { MusicQuery } from "../../lib/music";
import { normalizeContentSection } from "../../lib/siteContent";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    await requireOwnerSession(context.request, context.env);
    const params = new URL(context.request.url).searchParams;
    const server = params.get("server")?.trim() || "";
    const type = params.get("type")?.trim() || "";
    const id = params.get("id")?.trim() || "";
    if (type === "user") {
      if (server !== "netease") throw new ApiError(400, "MUSIC_USER_SERVER_INVALID", "用户歌单目前只支持网易云音乐");
      const result = await fetchNeteaseUserPlaylists(id);
      return apiResponse({ tracks: [], ...result }, requestId);
    }
    const query = normalizeContentSection("music", {
      server,
      type,
      id,
      playlistIds: [],
    }) as MusicQuery;
    if (!query.id) throw new ApiError(400, "MUSIC_QUERY_REQUIRED", "请输入资源 ID 或搜索词");
    const tracks = await fetchMusicPlaylist(query);
    return apiResponse({ tracks, playlists: [] }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
