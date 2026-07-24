import { cachedResponse } from "../lib/cache";
import { fetchJson, jsonResponse } from "../lib/http";

interface Environment {
  WALLHAVEN_API_KEY?: string;
}

type PagesContext = {
  request: Request;
  env: Environment;
  waitUntil?: (promise: Promise<unknown>) => void;
};

interface BingResponse {
  images?: Array<{ url?: string; title?: string; copyright?: string }>;
}

interface WallhavenResponse {
  data?: Array<{ path?: string; short_url?: string; id?: string }>;
}

const imageProxyUrl = (request: Request, remoteUrl: string) => {
  const origin = new URL(request.url).origin;
  return `${origin}/api/image?url=${encodeURIComponent(remoteUrl)}`;
};

const loadBing = async (request: Request) => {
  const payload = await fetchJson<BingResponse>(
    "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN",
  );
  const image = payload.images?.[0];
  if (!image?.url) throw new Error("Bing 壁纸响应缺少图片地址");
  const remoteUrl = new URL(image.url, "https://www.bing.com").toString();
  return jsonResponse({
    source: "bing",
    title: image.title || "Bing 每日壁纸",
    author: image.copyright || "",
    imageUrl: imageProxyUrl(request, remoteUrl),
    downloadUrl: remoteUrl,
  }, {}, "public, max-age=21600");
};

const loadWallhaven = async (request: Request, env: Environment, anime: boolean) => {
  const params = new URLSearchParams({
    categories: anime ? "010" : "100",
    purity: "100",
    sorting: "random",
    atleast: "1920x1080",
    ratios: "landscape",
  });
  if (env.WALLHAVEN_API_KEY?.trim()) params.set("apikey", env.WALLHAVEN_API_KEY.trim());
  const payload = await fetchJson<WallhavenResponse>(`https://wallhaven.cc/api/v1/search?${params}`);
  const candidates = (payload.data || []).filter((item) => typeof item.path === "string");
  const image = candidates[Math.floor(Math.random() * candidates.length)];
  if (!image?.path) throw new Error("Wallhaven 没有返回可用壁纸");
  return jsonResponse({
    source: "wallhaven",
    title: image.id ? `Wallhaven #${image.id}` : "Wallhaven 随机壁纸",
    author: "Wallhaven",
    imageUrl: imageProxyUrl(request, image.path),
    downloadUrl: image.short_url || image.path,
  }, {}, "public, max-age=600");
};

export const onRequestGet = async (context: PagesContext) => {
  const source = new URL(context.request.url).searchParams.get("source") || "bing";
  if (!["bing", "wallhaven", "wallhaven-anime"].includes(source)) {
    return jsonResponse({ error: "不支持的壁纸来源" }, { status: 400 });
  }
  const ttl = source === "bing" ? 21600 : 60;
  const rotationSlot = source === "bing" ? "daily" : String(Math.floor(Date.now() / 15000));
  const cacheUrl = new URL(
    `/__edge-cache/wallpaper?source=${source}&slot=${rotationSlot}`,
    context.request.url,
  ).toString();
  try {
    return await cachedResponse(cacheUrl, ttl, context, () => (
      source === "bing"
        ? loadBing(context.request)
        : loadWallhaven(context.request, context.env, source === "wallhaven-anime")
    ));
  } catch (error) {
    console.error("在线壁纸元数据请求失败：", error);
    return jsonResponse({ error: "在线壁纸暂时不可用" }, { status: 503 });
  }
};
