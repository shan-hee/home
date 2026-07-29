import { apiResponse, errorResponse, getRequestId } from "../lib/api";
import { cachedResponse } from "../lib/cache";
import { fetchJson } from "../lib/http";
import { hitokotoCacheUrl, loadSiteContent } from "../lib/siteContent";
import type { PagesContext } from "../lib/types";

interface HitokotoResponse {
  hitokoto?: string;
  from?: string;
}

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    return await cachedResponse(hitokotoCacheUrl(context.request), 86400, context, async () => {
      const config = await loadSiteContent(context.env.DB);
      const hitokoto = config.sections.hitokoto as {
        mode: "remote" | "fixed";
        categories: string[];
        fixedText: string;
        fixedFrom: string;
        fallbackText: string;
        fallbackFrom: string;
      };
      if (hitokoto.mode === "fixed") {
        return apiResponse({
          hitokoto: hitokoto.fixedText || hitokoto.fallbackText,
          from: hitokoto.fixedFrom || hitokoto.fallbackFrom,
        }, requestId, {}, "public, max-age=86400, stale-while-revalidate=604800");
      }

      try {
        const upstream = new URL("https://v1.hitokoto.cn");
        hitokoto.categories.forEach((category) => upstream.searchParams.append("c", category));
        const payload = await fetchJson<HitokotoResponse>(upstream, {}, 5000);
        if (!payload.hitokoto?.trim()) throw new Error("一言响应缺少文本");
        return apiResponse({
          hitokoto: payload.hitokoto.trim(),
          from: payload.from?.trim() || hitokoto.fallbackFrom,
        }, requestId, {}, "public, max-age=86400, stale-while-revalidate=604800");
      } catch {
        return apiResponse({
          hitokoto: hitokoto.fallbackText,
          from: hitokoto.fallbackFrom,
        }, requestId, {}, "public, max-age=86400, stale-while-revalidate=604800");
      }
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
