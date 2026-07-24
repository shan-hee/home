import { cacheCoordinate, cachedResponse } from "../lib/cache";
import { fetchJson, jsonResponse } from "../lib/http";

interface Environment {
  QWEATHER_API_KEY?: string;
  QWEATHER_API_HOST?: string;
}

interface QWeatherWarning {
  id?: string;
  title?: string;
  typeName?: string;
  severity?: string;
  severityColor?: string;
  text?: string;
  startTime?: string;
  endTime?: string;
}

interface QWeatherResponse {
  code?: string;
  warning?: QWeatherWarning[];
}

type PagesContext = {
  request: Request;
  env: Environment;
  waitUntil?: (promise: Promise<unknown>) => void;
};

const coordinate = (value: string | null, min: number, max: number) => {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

export const onRequestGet = async (context: PagesContext) => {
  const { request, env } = context;
  if (!env.QWEATHER_API_KEY) {
    return jsonResponse({ alerts: [], configured: false }, {}, "public, max-age=300");
  }

  const url = new URL(request.url);
  const latitude = coordinate(url.searchParams.get("latitude"), -90, 90);
  const longitude = coordinate(url.searchParams.get("longitude"), -180, 180);
  if (latitude === null || longitude === null) {
    return jsonResponse({ error: "缺少有效坐标" }, { status: 400 });
  }

  try {
    const cacheUrl = new URL(
      `/__edge-cache/alerts?latitude=${cacheCoordinate(latitude)}&longitude=${cacheCoordinate(longitude)}`,
      request.url,
    ).toString();
    return await cachedResponse(cacheUrl, 300, context, async () => {
      const host = env.QWEATHER_API_HOST?.trim() || "devapi.qweather.com";
      const params = new URLSearchParams({
        location: `${longitude.toFixed(2)},${latitude.toFixed(2)}`,
        key: env.QWEATHER_API_KEY!,
        lang: "zh",
      });
      const payload = await fetchJson<QWeatherResponse>(`https://${host}/v7/warning/now?${params}`);
      if (payload.code !== "200") throw new Error(`预警上游状态 ${payload.code || "unknown"}`);

      const alerts = (payload.warning || []).map((warning, index) => ({
        id: warning.id || String(index),
        title: warning.title || warning.typeName || "天气预警",
        type: warning.typeName || "天气预警",
        level: warning.severityColor || warning.severity || "",
        text: warning.text || "",
        startAt: warning.startTime || null,
        endAt: warning.endTime || null,
      }));
      return jsonResponse({ alerts, configured: true }, {}, "public, max-age=300");
    });
  } catch (error) {
    console.error("可选天气预警请求失败：", error);
    return jsonResponse({ alerts: [], configured: true });
  }
};
