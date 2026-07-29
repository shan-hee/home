import { apiResponse, ApiError, errorResponse, getRequestId } from "../lib/api";
import { cachedResponse } from "../lib/cache";
import { fetchMusicPlaylist } from "../lib/music";
import { loadSiteContent, musicCacheUrl } from "../lib/siteContent";
import type { PagesContext } from "../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    return await cachedResponse(musicCacheUrl(context.request), 3600, context, async () => {
      const config = await loadSiteContent(context.env.DB);
      const music = config.sections.music as {
        server: string;
        type: string;
        id: string;
      };
      if (!music.id) return apiResponse([], requestId, {}, "public, max-age=3600");

      const playlist = await fetchMusicPlaylist(music);
      if (!playlist.length) {
        throw new ApiError(404, "MUSIC_PLAYLIST_EMPTY", "未找到可播放内容");
      }
      return apiResponse(playlist, requestId, {}, "public, max-age=3600, stale-while-revalidate=86400");
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
