import fetchJsonp from "fetch-jsonp";

/**
 * 获取单一音乐播放队列。
 */
export const getPlayerList = async (server, type, id, playerTrLrc) => {
  let data: any[] = [];
  try {
    const response = await fetch(
      `${envConfig.VITE_SONG_API}?server=${server}&type=${type}&id=${id}`,
    );
    data = await response.json();
  } catch (error) {
    console.error("音乐源请求失败:", error);
  };

  if (data.length > 0 && data[0]?.url?.startsWith("@")) {
    const url = data[0].url.split("@").at(-1);
    const jsonpData = await fetchJsonp(url).then((response) => response.json());
    const sipList = jsonpData.req_0?.data?.sip || [];
    const domain = (
      sipList.find((item: string) => !item.startsWith("http://ws")) ||
      sipList[0] ||
      ""
    ).replace("http://", "https://");

    return data.map((item, index) => ({
      name: item.name || item.title,
      artist: item.artist || item.author,
      album: item.album || envConfig.VITE_SITE_NAME,
      url: domain + (jsonpData.req_0?.data?.midurlinfo[index]?.purl || ""),
      cover: item.cover || item.pic,
      lrc:
        playerTrLrc && item.lrc
          ? `${item.lrc}${item.lrc.includes("?") ? "&" : "?"}trlrc=true`
          : item.lrc,
    }));
  }

  return data.map((item) => ({
    name: item.name || item.title,
    artist: item.artist || item.author,
    album: item.album || envConfig.VITE_SITE_NAME,
    url: item.url,
    cover: item.cover || item.pic,
    lrc:
      playerTrLrc && item.lrc
        ? `${item.lrc}${item.lrc.includes("?") ? "&" : "?"}trlrc=true`
        : item.lrc,
  }));
};

export const getHitokoto = async () => {
  const response = await fetch("https://v1.hitokoto.cn");
  return await response.json();
};

export const testGitHubConnectivity = async (): Promise<number> => {
  const testUrl =
    "https://raw.githubusercontent.com/NanoRocky/home/EFU/public/images/icon/github.png";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(testUrl, {
      method: "HEAD",
      signal: controller.signal,
    });
    return response.ok ? 1 : 0;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeoutId);
  }
};
