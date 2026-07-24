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
};

const coordinate = (value: string | null, min: number, max: number) => {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

export const onRequestGet = async ({ request, env }: PagesContext) => {
  if (!env.QWEATHER_API_KEY) {
    return Response.json({ alerts: [], configured: false }, {
      headers: { "cache-control": "public, max-age=300" },
    });
  }

  const url = new URL(request.url);
  const latitude = coordinate(url.searchParams.get("latitude"), -90, 90);
  const longitude = coordinate(url.searchParams.get("longitude"), -180, 180);
  if (latitude === null || longitude === null) {
    return Response.json({ error: "缺少有效坐标" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const host = env.QWEATHER_API_HOST?.trim() || "devapi.qweather.com";
    const params = new URLSearchParams({
      location: `${longitude.toFixed(2)},${latitude.toFixed(2)}`,
      key: env.QWEATHER_API_KEY,
      lang: "zh",
    });
    const response = await fetch(`https://${host}/v7/warning/now?${params}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`预警上游返回 ${response.status}`);
    const payload = await response.json() as QWeatherResponse;
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
    return Response.json({ alerts, configured: true }, {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("可选天气预警请求失败：", error);
    return Response.json({ alerts: [], configured: true }, {
      headers: { "cache-control": "no-store" },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};
