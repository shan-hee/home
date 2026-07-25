import fetchJsonp from "fetch-jsonp";
import { useSiteContentStore } from "@/stores/siteContent";

export interface PlaylistItem {
  name: string;
  artist: string;
  album: string;
  url: string;
  cover: string;
  lrc: string;
}

type MusicApiItem = Record<string, unknown>;

const asText = (value: unknown, fallback = "") => {
  return typeof value === "string" ? value : fallback;
};

/**
 * 获取单一音乐播放队列。
 */
export const getPlayerList = async (): Promise<PlaylistItem[]> => {
  const response = await fetch("/api/music", { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`音乐源返回 ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("音乐源响应格式无效");
  }
  const data = payload as MusicApiItem[];
  const siteName = useSiteContentStore().profile.siteName;

  if (data.length > 0 && asText(data[0]?.url).startsWith("@")) {
    const encodedUrl = asText(data[0].url);
    const url = encodedUrl.split("@").at(-1);
    if (!url) {
      throw new Error("音乐源缺少播放地址");
    }
    const jsonpData = await fetchJsonp(url).then((response) => response.json());
    const sipList = jsonpData.req_0?.data?.sip || [];
    const domain = (
      sipList.find((item: string) => !item.startsWith("http://ws")) ||
      sipList[0] ||
      ""
    ).replace("http://", "https://");

    return data
      .map((item, index) => ({
        name: asText(item.name, asText(item.title, "未知歌曲")),
        artist: asText(item.artist, asText(item.author, "未知歌手")),
        album: asText(item.album, siteName),
        url: domain + asText(jsonpData.req_0?.data?.midurlinfo[index]?.purl),
        cover: asText(item.cover, asText(item.pic)),
        lrc: asText(item.lrc),
      }))
      .filter((item) => item.url.length > 0);
  }

  return data
    .map((item) => ({
      name: asText(item.name, asText(item.title, "未知歌曲")),
      artist: asText(item.artist, asText(item.author, "未知歌手")),
      album: asText(item.album, siteName),
      url: asText(item.url),
      cover: asText(item.cover, asText(item.pic)),
      lrc: asText(item.lrc),
    }))
    .filter((item) => item.url.length > 0);
};

export const getHitokoto = async () => {
  const response = await fetch("/api/hitokoto", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`一言接口返回 ${response.status}`);
  return await response.json();
};
