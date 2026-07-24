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

type PagesContext = { request: Request };

const fetchWithTimeout = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const onRequestGet = async ({ request }: PagesContext) => {
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim() || "";
  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: "城市名称长度应为 2–80 个字符" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      name,
      count: "8",
      language: "zh",
      format: "json",
    });
    const response = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!response.ok) throw new Error(`Geocoding 上游返回 ${response.status}`);
    const payload = await response.json() as OpenMeteoGeocodingResponse;
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

    return Response.json({ results }, {
      headers: { "cache-control": "public, max-age=3600" },
    });
  } catch (error) {
    console.error("城市搜索失败：", error);
    return Response.json({ error: "城市搜索暂时不可用" }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
};
