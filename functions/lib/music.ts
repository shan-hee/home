import { ApiError } from "./api";
import { fetchWithTimeout } from "./http";

const NXVAV_ENDPOINT = "https://api.nxvav.cn/api/music/";
const CHKSZ_NETEASE_ENDPOINT = "https://api.chksz.com/api/163_music";
const CHKSZ_NETEASE_LEVEL = "lossless";
const NETEASE_LYRIC_ENDPOINT = "https://music.163.com/api/song/lyric";
const NETEASE_USER_PLAYLIST_ENDPOINT = "https://music.163.com/api/user/playlist";

interface MusicUpstreamItem {
  title?: unknown;
  author?: unknown;
  url?: unknown;
  pic?: unknown;
  lrc?: unknown;
}

export interface MusicQuery {
  server: string;
  type: string;
  id: string;
}

export interface PlaylistItem {
  id: string;
  name: string;
  artist: string;
  url: string;
  cover: string;
  lrc: string;
}

export interface MusicPlaylistSummary {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
}

export interface MusicCatalog {
  playlists: MusicPlaylistSummary[];
  playlistId: string;
  tracks: PlaylistItem[];
}

interface MusicResource {
  id: string;
  url: string;
}

interface ChkszMusicPayload {
  code?: unknown;
  data?: unknown;
}

interface NeteaseLyricPayload {
  lrc?: { lyric?: unknown };
  yrc?: { lyric?: unknown };
}

interface NeteaseUserPlaylistPayload {
  playlist?: unknown;
}

const text = (value: unknown, fallback: string, maxLength: number) => {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength) || fallback;
};

const musicResource = (value: unknown, type: "url" | "pic" | "lrc", server: string): MusicResource | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    const id = url.searchParams.get("id") || "";
    if (
      url.protocol !== "https:"
      || url.hostname !== "api.nxvav.cn"
      || !["/api/music", "/api/music/"].includes(url.pathname)
      || url.username
      || url.password
      || url.searchParams.get("server") !== server
      || url.searchParams.get("type") !== type
      || !id
      || !/^[a-f0-9]{40}$/i.test(url.searchParams.get("auth") || "")
    ) return null;
    return { id, url: url.toString() };
  } catch {
    return null;
  }
};

const normalizeTrack = (value: unknown, server: string): PlaylistItem | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as MusicUpstreamItem;
  const playback = musicResource(item.url, "url", server);
  if (!playback) return null;
  return {
    id: playback.id,
    name: text(item.title, "未知歌曲", 200),
    artist: text(item.author, "未知歌手", 300),
    url: playback.url,
    cover: musicResource(item.pic, "pic", server)?.url || "",
    lrc: musicResource(item.lrc, "lrc", server)?.url || "",
  };
};

const chkszMediaUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || (url.hostname !== "music.126.net" && !url.hostname.endsWith(".music.126.net"))
    ) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const neteaseImageUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol)
      || url.username
      || url.password
      || url.port
      || (url.hostname !== "music.126.net" && !url.hostname.endsWith(".music.126.net"))
    ) return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
};

export const normalizeNeteaseUserId = (value: string) => {
  const normalized = value.trim();
  if (/^\d{1,20}$/.test(normalized)) return normalized;
  try {
    const url = new URL(normalized);
    if (
      url.protocol !== "https:"
      || !["music.163.com", "y.music.163.com"].includes(url.hostname)
      || url.username
      || url.password
      || url.port
    ) return "";
    const id = url.searchParams.get("id") || "";
    return /^\d{1,20}$/.test(id) ? id : "";
  } catch {
    return "";
  }
};

export const fetchNeteaseUserPlaylists = async (input: string): Promise<{ userId: string; playlists: MusicPlaylistSummary[] }> => {
  const userId = normalizeNeteaseUserId(input);
  if (!userId) {
    throw new ApiError(400, "MUSIC_USER_ID_INVALID", "请输入有效的网易云用户 ID 或用户主页地址");
  }

  const upstream = new URL(NETEASE_USER_PLAYLIST_ENDPOINT);
  upstream.searchParams.set("uid", userId);
  upstream.searchParams.set("limit", "1000");
  upstream.searchParams.set("offset", "0");

  let response: Response;
  try {
    response = await fetchWithTimeout(upstream, {
      headers: {
        accept: "application/json",
        referer: "https://music.163.com/",
      },
    }, 10000);
  } catch {
    throw new ApiError(502, "MUSIC_USER_PLAYLISTS_FAILED", "用户歌单暂时无法查询");
  }
  if (!response.ok) {
    throw new ApiError(502, "MUSIC_USER_PLAYLISTS_FAILED", "用户歌单暂时无法查询");
  }

  let payload: NeteaseUserPlaylistPayload;
  try {
    payload = await response.json() as NeteaseUserPlaylistPayload;
  } catch {
    throw new ApiError(502, "MUSIC_USER_PLAYLISTS_INVALID", "用户歌单服务返回无效数据");
  }
  if (!Array.isArray(payload.playlist)) {
    throw new ApiError(502, "MUSIC_USER_PLAYLISTS_INVALID", "用户歌单服务返回无效数据");
  }

  const playlists = payload.playlist.slice(0, 500).map((item): MusicPlaylistSummary | null => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const value = item as Record<string, unknown>;
    const id = String(value.id ?? "");
    if (!/^\d{1,20}$/.test(id)) return null;
    const trackCount = Number(value.trackCount);
    return {
      id,
      name: text(value.name, "未命名歌单", 200),
      cover: neteaseImageUrl(value.coverImgUrl),
      trackCount: Number.isInteger(trackCount) && trackCount >= 0 ? Math.min(trackCount, 100000) : 0,
    };
  }).filter((playlist): playlist is MusicPlaylistSummary => playlist !== null);

  if (payload.playlist.length > 0 && playlists.length === 0) {
    throw new ApiError(502, "MUSIC_USER_PLAYLISTS_INVALID", "用户歌单服务返回无效数据");
  }
  return { userId, playlists };
};

export const resolveNeteasePlaybackUrl = async (id: string, apiKey: string | undefined) => {
  if (!/^\d{1,20}$/.test(id)) {
    throw new ApiError(400, "MUSIC_TRACK_ID_INVALID", "歌曲 ID 格式无效");
  }
  const normalizedApiKey = apiKey?.trim();
  if (!normalizedApiKey) {
    throw new ApiError(503, "MUSIC_RESOLVE_NOT_CONFIGURED", "音乐解析服务 API 密钥未配置");
  }

  const upstream = new URL(CHKSZ_NETEASE_ENDPOINT);
  upstream.searchParams.set("id", id);
  upstream.searchParams.set("level", CHKSZ_NETEASE_LEVEL);
  upstream.searchParams.set("apikey", normalizedApiKey);

  let response: Response;
  try {
    response = await fetchWithTimeout(upstream, {
      headers: { accept: "application/json" },
    }, 8000);
  } catch {
    throw new ApiError(502, "MUSIC_RESOLVE_FAILED", "音乐播放地址暂时无法解析");
  }
  if (!response.ok) {
    throw new ApiError(502, "MUSIC_RESOLVE_FAILED", "音乐播放地址暂时无法解析");
  }

  let payload: ChkszMusicPayload;
  try {
    payload = await response.json() as ChkszMusicPayload;
  } catch {
    throw new ApiError(502, "MUSIC_RESOLVE_INVALID", "音乐解析服务返回无效数据");
  }
  if (payload.code !== 200 || typeof payload.data !== "object" || payload.data === null || Array.isArray(payload.data)) {
    throw new ApiError(502, "MUSIC_RESOLVE_FAILED", "音乐播放地址暂时无法解析");
  }

  const data = payload.data as Record<string, unknown>;
  if (String(data.id ?? "") !== id) {
    throw new ApiError(502, "MUSIC_RESOLVE_INVALID", "音乐解析服务返回无效数据");
  }
  const url = chkszMediaUrl(data.url);
  if (!url) {
    throw new ApiError(502, "MUSIC_RESOLVE_INVALID", "音乐解析服务返回无效数据");
  }
  return url;
};

export const resolveNeteaseLyrics = async (id: string) => {
  if (!/^\d{1,20}$/.test(id)) {
    throw new ApiError(400, "MUSIC_TRACK_ID_INVALID", "歌曲 ID 格式无效");
  }

  const upstream = new URL(NETEASE_LYRIC_ENDPOINT);
  upstream.searchParams.set("id", id);
  upstream.searchParams.set("lv", "-1");
  upstream.searchParams.set("kv", "-1");
  upstream.searchParams.set("tv", "-1");
  upstream.searchParams.set("yv", "-1");
  upstream.searchParams.set("rv", "-1");

  let response: Response;
  try {
    response = await fetchWithTimeout(upstream, {
      headers: {
        accept: "application/json",
        referer: "https://music.163.com/",
      },
    }, 8000);
  } catch {
    throw new ApiError(502, "MUSIC_LYRIC_FAILED", "逐字歌词暂时无法获取");
  }
  if (!response.ok) {
    throw new ApiError(502, "MUSIC_LYRIC_FAILED", "逐字歌词暂时无法获取");
  }

  let payload: NeteaseLyricPayload;
  try {
    payload = await response.json() as NeteaseLyricPayload;
  } catch {
    throw new ApiError(502, "MUSIC_LYRIC_INVALID", "歌词服务返回无效数据");
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ApiError(502, "MUSIC_LYRIC_INVALID", "歌词服务返回无效数据");
  }

  const lrc = typeof payload.lrc?.lyric === "string" ? payload.lrc.lyric : "";
  const yrc = typeof payload.yrc?.lyric === "string" ? payload.yrc.lyric : "";
  if (!lrc && !yrc) {
    throw new ApiError(404, "MUSIC_LYRIC_EMPTY", "这首歌曲暂无歌词");
  }
  return { lrc, yrc };
};

export const fetchMusicPlaylist = async ({ server, type, id }: MusicQuery) => {
  const upstream = new URL(NXVAV_ENDPOINT);
  upstream.searchParams.set("server", server);
  upstream.searchParams.set("type", type);
  upstream.searchParams.set("id", id);

  let response: Response;
  try {
    response = await fetchWithTimeout(upstream, {
      headers: { accept: "application/json" },
    }, 10000);
  } catch {
    throw new ApiError(502, "MUSIC_UPSTREAM_FAILED", "音乐服务暂时不可用");
  }
  if (!response.ok) {
    throw new ApiError(502, "MUSIC_UPSTREAM_FAILED", "音乐服务暂时不可用");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(502, "MUSIC_UPSTREAM_INVALID", "音乐服务返回无效数据");
  }
  if (!Array.isArray(payload)) {
    throw new ApiError(502, "MUSIC_UPSTREAM_INVALID", "音乐服务返回无效数据");
  }

  const tracks = payload.map((item) => normalizeTrack(item, server)).filter((track): track is PlaylistItem => track !== null);
  if (payload.length > 0 && tracks.length === 0) {
    throw new ApiError(502, "MUSIC_UPSTREAM_INVALID", "音乐服务返回无效数据");
  }
  return tracks;
};
