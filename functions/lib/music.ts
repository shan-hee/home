import { ApiError } from "./api";
import { fetchWithTimeout } from "./http";

const NXVAV_ENDPOINT = "https://api.nxvav.cn/api/music/";

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
  name: string;
  artist: string;
  url: string;
  cover: string;
  lrc: string;
}

const text = (value: unknown, fallback: string, maxLength: number) => {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength) || fallback;
};

const musicResourceUrl = (value: unknown, type: "url" | "pic" | "lrc") => {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.hostname !== "api.nxvav.cn"
      || !["/api/music", "/api/music/"].includes(url.pathname)
      || url.username
      || url.password
      || url.searchParams.get("type") !== type
      || !url.searchParams.get("id")
      || !/^[a-f0-9]{40}$/i.test(url.searchParams.get("auth") || "")
    ) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const normalizeTrack = (value: unknown): PlaylistItem | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as MusicUpstreamItem;
  const url = musicResourceUrl(item.url, "url");
  if (!url) return null;
  return {
    name: text(item.title, "未知歌曲", 200),
    artist: text(item.author, "未知歌手", 300),
    url,
    cover: musicResourceUrl(item.pic, "pic"),
    lrc: musicResourceUrl(item.lrc, "lrc"),
  };
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

  const tracks = payload.map(normalizeTrack).filter((track): track is PlaylistItem => track !== null);
  if (payload.length > 0 && tracks.length === 0) {
    throw new ApiError(502, "MUSIC_UPSTREAM_INVALID", "音乐服务返回无效数据");
  }
  return tracks;
};
