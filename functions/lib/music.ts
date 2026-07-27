import { ApiError } from "./api";
import { fetchWithTimeout } from "./http";

const NXVAV_ENDPOINT = "https://api.nxvav.cn/api/music/";
const CHKSZ_NETEASE_ENDPOINT = "https://api.chksz.top/api/163_music";
const CHKSZ_NETEASE_LEVEL = "lossless";

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

interface MusicResource {
  id: string;
  url: string;
}

interface ChkszMusicPayload {
  code?: unknown;
  data?: unknown;
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

export const resolveNeteasePlaybackUrl = async (id: string) => {
  if (!/^\d{1,20}$/.test(id)) {
    throw new ApiError(400, "MUSIC_TRACK_ID_INVALID", "歌曲 ID 格式无效");
  }

  const upstream = new URL(CHKSZ_NETEASE_ENDPOINT);
  upstream.searchParams.set("id", id);
  upstream.searchParams.set("level", CHKSZ_NETEASE_LEVEL);

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
