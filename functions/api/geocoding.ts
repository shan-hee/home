import { cachedResponse } from "../lib/cache";
import { fetchJson, jsonResponse } from "../lib/http";

interface OpenMeteoGeocodingResult {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
  country?: string;
}

interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingResult[];
}

type PagesContext = {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
};

export const onRequestGet = async (context: PagesContext) => {
  const { request } = context;
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim() || "";
  if (name.length < 2 || name.length > 80) {
    return jsonResponse({ error: "城市名称长度应为 2–80 个字符" }, { status: 400 });
  }

  try {
    const cacheUrl = new URL(`/__edge-cache/geocoding?name=${encodeURIComponent(name.toLocaleLowerCase("zh-CN"))}`, request.url).toString();
    return await cachedResponse(cacheUrl, 3600, context, async () => {
      const params = new URLSearchParams({
        name,
        count: "8",
        language: "zh",
        format: "json",
      });
      const payload = await fetchJson<OpenMeteoGeocodingResponse>(
        `https://geocoding-api.open-meteo.com/v1/search?${params}`,
      );
      const results = (payload.results || [])
        .filter((item) => (
          typeof item.name === "string" &&
          typeof item.latitude === "number" && Number.isFinite(item.latitude) &&
          typeof item.longitude === "number" && Number.isFinite(item.longitude)
        ))
        .map((item) => ({
          id: String(item.id ?? `${item.latitude},${item.longitude}`),
          name: item.name!,
          latitude: item.latitude!,
          longitude: item.longitude!,
          admin1: item.admin1 || "",
          country: item.country || "",
        }));
      return jsonResponse({ results }, {}, "public, max-age=3600");
    });
  } catch (error) {
    console.error("城市搜索失败：", error);
    return jsonResponse({ error: "城市搜索暂时不可用" }, {
      status: 503,
    });
  }
};
