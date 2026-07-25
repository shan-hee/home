type CacheContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

const getEdgeCache = () => {
  if (typeof caches === "undefined") return null;
  return (caches as unknown as { default?: Cache }).default || null;
};

export const deleteCachedResponse = async (cacheUrl: string) => {
  const cache = getEdgeCache();
  if (!cache) return false;
  return cache.delete(new Request(cacheUrl, { method: "GET" }));
};

export const cachedResponse = async (
  cacheUrl: string,
  ttlSeconds: number,
  context: CacheContext,
  loader: () => Promise<Response>,
) => {
  const cache = getEdgeCache();
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const response = await loader();
  if (!cache || !response.ok) return response;

  const cacheable = new Response(response.body, response);
  cacheable.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
  const write = cache.put(cacheKey, cacheable.clone());
  if (context.waitUntil) context.waitUntil(write);
  else await write;
  return cacheable;
};

export const cacheCoordinate = (value: number) => value.toFixed(2);
