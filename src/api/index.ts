import { requestJson } from "@/services/apiClient";

export interface PlaylistItem {
  id: string;
  name: string;
  artist: string;
  url: string;
  cover: string;
  lrc: string;
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

/**
 * 获取单一音乐播放队列。
 */
export const getPlayerList = async (): Promise<PlaylistItem[]> => {
  const payload = await requestJson<unknown>("/api/music", { cache: "no-cache" });
  if (!Array.isArray(payload)) {
    throw new Error("音乐源响应格式无效");
  }
  if (!payload.every(isPlaylistItem)) {
    throw new Error("音乐源响应格式无效");
  }
  return payload;
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

export const getHitokoto = async () => {
  const response = await fetch("/api/hitokoto", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`一言接口返回 ${response.status}`);
  return await response.json();
};
