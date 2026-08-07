import { requestJson } from "@/services/apiClient";

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

export interface NeteaseLyrics {
  lrc: string;
  yrc: string;
}

const isPlaylistItem = (value: unknown): value is PlaylistItem => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<keyof PlaylistItem, unknown>;
  return typeof item.id === "string"
    && typeof item.name === "string"
    && typeof item.artist === "string"
    && typeof item.url === "string"
    && typeof item.cover === "string"
    && typeof item.lrc === "string";
};

const isMusicPlaylistSummary = (value: unknown): value is MusicPlaylistSummary => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<keyof MusicPlaylistSummary, unknown>;
  return typeof item.id === "string"
    && typeof item.name === "string"
    && typeof item.cover === "string"
    && typeof item.trackCount === "number";
};

/**
 * 获取歌单目录及指定歌单的播放队列。
 */
export const getMusicCatalog = async (revision: number, playlistId = ""): Promise<MusicCatalog> => {
  const params = new URLSearchParams({ revision: String(revision) });
  if (playlistId) params.set("playlistId", playlistId);
  const payload = await requestJson<unknown>(`/api/music?${params}`);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("音乐源响应格式无效");
  }
  const value = payload as Partial<MusicCatalog>;
  if (
    !Array.isArray(value.playlists)
    || !value.playlists.every(isMusicPlaylistSummary)
    || typeof value.playlistId !== "string"
    || !Array.isArray(value.tracks)
    || !value.tracks.every(isPlaylistItem)
  ) {
    throw new Error("音乐源响应格式无效");
  }
  return value as MusicCatalog;
};

export const resolveNeteasePlaybackUrl = async (id: string, signal?: AbortSignal): Promise<string> => {
  const payload = await requestJson<unknown>(`/api/music/resolve?id=${encodeURIComponent(id)}`, { signal });
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("音乐解析响应格式无效");
  }
  const url = (payload as { url?: unknown }).url;
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("音乐解析响应格式无效");
  }
  return url;
};

export const resolveNeteaseLyrics = async (id: string, signal?: AbortSignal): Promise<NeteaseLyrics> => {
  const payload = await requestJson<unknown>(`/api/music/lyric?id=${encodeURIComponent(id)}`, { signal });
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("歌词响应格式无效");
  }
  const { lrc, yrc } = payload as { lrc?: unknown; yrc?: unknown };
  if (typeof lrc !== "string" || typeof yrc !== "string") {
    throw new Error("歌词响应格式无效");
  }
  return { lrc, yrc };
};

export const getHitokoto = async (revision: number) => {
  const response = await fetch(`/api/hitokoto?revision=${revision}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`一言接口返回 ${response.status}`);
  return await response.json();
};
