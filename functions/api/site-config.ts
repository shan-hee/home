import { apiResponse, errorResponse, getRequestId } from "../lib/api";
import { cachedResponse } from "../lib/cache";
import { loadSiteContent, siteConfigCacheUrl } from "../lib/siteContent";
import type { PagesContext } from "../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const response = await cachedResponse(siteConfigCacheUrl(context.request), 60, context, async () => {
      const config = await loadSiteContent(context.env.DB);
      return apiResponse(config, requestId, {
        headers: { etag: config.etag },
      }, "public, max-age=60, stale-while-revalidate=86400");
    });

    const etag = response.headers.get("etag");
    if (etag && context.request.headers.get("if-none-match") === etag) {
      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);
      return new Response(null, { status: 304, headers });
    }
    const headers = new Headers(response.headers);
    headers.set("x-request-id", requestId);
    headers.set("cache-control", "public, max-age=60, stale-while-revalidate=86400");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
