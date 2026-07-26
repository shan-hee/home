import { requestJson } from "@/services/apiClient";

export interface PlaylistItem {
  name: string;
  artist: string;
  url: string;
  cover: string;
  lrc: string;
}

const isPlaylistItem = (value: unknown): value is PlaylistItem => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<keyof PlaylistItem, unknown>;
  return typeof item.name === "string"
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

export const getHitokoto = async () => {
  const response = await fetch("/api/hitokoto", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`一言接口返回 ${response.status}`);
  return await response.json();
};
