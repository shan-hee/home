import fetchJsonp from "fetch-jsonp";

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

const appendTranslationFlag = (url: string, enabled: boolean) => {
  if (!enabled || !url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}trlrc=true`;
};

/**
 * 获取单一音乐播放队列。
 */
export const getPlayerList = async (
  server: string,
  type: string,
  id: string,
  playerTrLrc: boolean,
): Promise<PlaylistItem[]> => {
  const response = await fetch(
    `${envConfig.VITE_SONG_API}?server=${server}&type=${type}&id=${id}`,
  );
  if (!response.ok) {
    throw new Error(`音乐源返回 ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("音乐源响应格式无效");
  }
  const data = payload as MusicApiItem[];

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
        album: asText(item.album, envConfig.VITE_SITE_NAME),
        url: domain + asText(jsonpData.req_0?.data?.midurlinfo[index]?.purl),
        cover: asText(item.cover, asText(item.pic)),
        lrc: appendTranslationFlag(asText(item.lrc), playerTrLrc),
      }))
      .filter((item) => item.url.length > 0);
  }

  return data
    .map((item) => ({
      name: asText(item.name, asText(item.title, "未知歌曲")),
      artist: asText(item.artist, asText(item.author, "未知歌手")),
      album: asText(item.album, envConfig.VITE_SITE_NAME),
      url: asText(item.url),
      cover: asText(item.cover, asText(item.pic)),
      lrc: appendTranslationFlag(asText(item.lrc), playerTrLrc),
    }))
    .filter((item) => item.url.length > 0);
};

export const getHitokoto = async () => {
  const response = await fetch("https://v1.hitokoto.cn");
  return await response.json();
};
