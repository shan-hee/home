import { cachedResponse } from "../lib/cache";
import { fetchWithTimeout, jsonResponse, securityHeaders } from "../lib/http";

type PagesContext = {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
};

const allowedHosts = new Set([
  "www.bing.com",
  "bing.com",
  "cn.bing.com",
  "s.cn.bing.net",
  "th.bing.com",
  "w.wallhaven.cc",
  "th.wallhaven.cc",
]);

const parseRemoteUrl = (request: Request) => {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return null;
  try {
    const remote = new URL(raw);
    if (remote.protocol !== "https:" || !allowedHosts.has(remote.hostname.toLowerCase())) return null;
    return remote;
  } catch {
    return null;
  }
};

export const onRequestGet = async (context: PagesContext) => {
  const remote = parseRemoteUrl(context.request);
  if (!remote) return jsonResponse({ error: "图片地址无效或不在允许列表" }, { status: 400 });

  const cacheUrl = new URL(
    `/__edge-cache/image?url=${encodeURIComponent(remote.toString())}`,
    context.request.url,
  ).toString();
  try {
    return await cachedResponse(cacheUrl, 604800, context, async () => {
      const upstream = await fetchWithTimeout(remote, {
        headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
        redirect: "follow",
      }, 12000);
      if (!upstream.ok) throw new Error(`图片上游返回 ${upstream.status}`);
      const finalUrl = new URL(upstream.url || remote.toString());
      if (!allowedHosts.has(finalUrl.hostname.toLowerCase())) throw new Error("图片上游发生不安全跳转");
      const contentType = upstream.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("image/")) throw new Error("上游响应不是图片");
      const contentLength = Number(upstream.headers.get("content-length") || 0);
      if (contentLength > 15 * 1024 * 1024) throw new Error("图片超过 15MB 限制");

      const headers = new Headers({
        "content-type": contentType,
        "cache-control": "public, max-age=604800",
      });
      Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value));
      return new Response(upstream.body, { status: 200, headers });
    });
  } catch (error) {
    console.error("在线图片代理失败：", error);
    return jsonResponse({ error: "在线图片暂时不可用" }, { status: 502 });
  }
};
