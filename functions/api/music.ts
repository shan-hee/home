import { apiResponse, ApiError, errorResponse, getRequestId } from "../lib/api";
import { cachedResponse } from "../lib/cache";
import { fetchMusicPlaylist, fetchNeteaseUserPlaylists } from "../lib/music";
import type { MusicCatalog } from "../lib/music";
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
        playlistIds: string[];
      };
      if (!music.id) {
        const empty: MusicCatalog = { playlists: [], playlistId: "", tracks: [] };
        return apiResponse(empty, requestId, {}, "public, max-age=3600");
      }

      if (music.type === "user") {
        const catalog = await fetchNeteaseUserPlaylists(music.id);
        const byId = new Map(catalog.playlists.map((playlist) => [playlist.id, playlist]));
        const playlists = music.playlistIds.map((id) => byId.get(id)).filter((playlist) => playlist !== undefined);
        if (!playlists.length) {
          throw new ApiError(404, "MUSIC_PLAYLIST_EMPTY", "已选择的用户歌单均不可用");
        }
        const requestedId = new URL(context.request.url).searchParams.get("playlistId") || "";
        const playlistId = playlists.some((playlist) => playlist.id === requestedId) ? requestedId : playlists[0]!.id;
        const tracks = await fetchMusicPlaylist({ server: "netease", type: "playlist", id: playlistId });
        if (!tracks.length) {
          throw new ApiError(404, "MUSIC_PLAYLIST_EMPTY", "所选歌单中没有可播放内容");
        }
        const result: MusicCatalog = { playlists, playlistId, tracks };
        return apiResponse(result, requestId, {}, "public, max-age=3600, stale-while-revalidate=86400");
      }

      const tracks = await fetchMusicPlaylist(music);
      if (!tracks.length) {
        throw new ApiError(404, "MUSIC_PLAYLIST_EMPTY", "未找到可播放内容");
      }
      const result: MusicCatalog = {
        playlists: [{ id: "default", name: "全部歌曲", cover: tracks[0]?.cover || "", trackCount: tracks.length }],
        playlistId: "default",
        tracks,
      };
      return apiResponse(result, requestId, {}, "public, max-age=3600, stale-while-revalidate=86400");
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
