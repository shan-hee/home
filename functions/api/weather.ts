import { cacheCoordinate, cachedResponse } from "../lib/cache";
import { fetchJson, jsonResponse } from "../lib/http";

interface Environment {
  DEFAULT_LATITUDE?: string;
  DEFAULT_LONGITUDE?: string;
  DEFAULT_CITY?: string;
}

interface CloudflareLocation {
  latitude?: string;
  longitude?: string;
  city?: string;
}

type PagesRequest = Request & { cf?: CloudflareLocation };
type PagesContext = {
  request: PagesRequest;
  env: Environment;
  waitUntil?: (promise: Promise<unknown>) => void;
};

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
}

interface MetNorwayResponse {
  properties?: {
    timeseries?: Array<{
      data?: {
        instant?: {
          details?: {
            air_temperature?: number;
            wind_speed?: number;
            wind_from_direction?: number;
          };
        };
        next_1_hours?: {
          summary?: {
            symbol_code?: string;
          };
        };
      };
    }>;
  };
}

const weatherCodeMap: Record<number, string> = {
  0: "晴",
  1: "大部晴朗",
  2: "局部多云",
  3: "阴",
  45: "雾",
  48: "冻雾",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  56: "冻雨",
  57: "强冻雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "阵雨",
  81: "中阵雨",
  82: "强阵雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷雨",
  96: "雷雨伴有冰雹",
  99: "强雷雨伴有冰雹",
};

const metSymbolMap: Record<string, string> = {
  clearsky: "晴",
  fair: "晴间多云",
  partlycloudy: "局部多云",
  cloudy: "阴",
  fog: "雾",
  lightrain: "小雨",
  rain: "中雨",
  heavyrain: "大雨",
  lightsnow: "小雪",
  snow: "中雪",
  heavysnow: "大雪",
  lightrainshowers: "阵雨",
  rainshowers: "中阵雨",
  heavyrainshowers: "强阵雨",
  lightsnowshowers: "阵雪",
  snowshowers: "中阵雪",
  heavysnowshowers: "强阵雪",
  thundershower: "雷雨",
  rainandthunder: "雷雨",
};

const directionNames = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getWindDirection = (degrees: number) => {
  return directionNames[Math.round(degrees / 45) % directionNames.length];
};

const getWindLevel = (speed: number) => {
  const thresholds = [0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  return Math.min(
    thresholds.reduce((level, threshold, index) => (speed >= threshold ? index + 1 : level), 0),
    12,
  ).toString();
};

const resolveLocation = (request: PagesRequest, env: Environment) => {
  const url = new URL(request.url);
  const latitude = toNumber(url.searchParams.get("latitude") || request.cf?.latitude || env.DEFAULT_LATITUDE);
  const longitude = toNumber(url.searchParams.get("longitude") || request.cf?.longitude || env.DEFAULT_LONGITUDE);
  const city = (url.searchParams.get("city") || request.cf?.city || env.DEFAULT_CITY || "IP 所在地").trim().slice(0, 80);

  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("缺少有效的定位信息");
  }

  return { latitude, longitude, city };
};

const loadOpenMeteo = async (location: ReturnType<typeof resolveLocation>) => {
  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    current: "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m",
    wind_speed_unit: "ms",
    timezone: "auto",
  });
  const data = await fetchJson<OpenMeteoResponse>(`https://api.open-meteo.com/v1/forecast?${params}`);
  const current = data.current;
  const temperature = toNumber(current?.temperature_2m);
  const weatherCode = toNumber(current?.weather_code);
  const windSpeed = toNumber(current?.wind_speed_10m);
  const windDirection = toNumber(current?.wind_direction_10m);

  if (temperature === null || weatherCode === null || windSpeed === null || windDirection === null) {
    throw new Error("Open-Meteo 响应字段不完整");
  }

  return {
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    weather: weatherCodeMap[weatherCode] || "未知天气",
    temperature: Math.round(temperature),
    winddirection: getWindDirection(windDirection),
    windpower: getWindLevel(windSpeed),
    source: "open-meteo" as const,
    updatedAt: new Date().toISOString(),
  };
};

const loadMetNorway = async (location: ReturnType<typeof resolveLocation>) => {
  const data = await fetchJson<MetNorwayResponse>(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude}&lon=${location.longitude}`,
    { headers: { "user-agent": "home-pages-functions/1.0" } },
  );
  const point = data.properties?.timeseries?.[0];
  const details = point?.data?.instant?.details;
  const temperature = toNumber(details?.air_temperature);
  const windSpeed = toNumber(details?.wind_speed);
  const windDirection = toNumber(details?.wind_from_direction);
  const symbol = point?.data?.next_1_hours?.summary?.symbol_code?.split("_")[0];

  if (temperature === null || windSpeed === null || windDirection === null || !symbol) {
    throw new Error("MET Norway 响应字段不完整");
  }

  return {
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    weather: metSymbolMap[symbol] || "未知天气",
    temperature: Math.round(temperature),
    winddirection: getWindDirection(windDirection),
    windpower: getWindLevel(windSpeed),
    source: "met-norway" as const,
    updatedAt: new Date().toISOString(),
  };
};

export const onRequestGet = async (context: PagesContext) => {
  try {
    const location = resolveLocation(context.request, context.env);
    const cacheUrl = new URL(
      `/__edge-cache/weather?latitude=${cacheCoordinate(location.latitude)}&longitude=${cacheCoordinate(location.longitude)}&city=${encodeURIComponent(location.city)}`,
      context.request.url,
    ).toString();
    return await cachedResponse(cacheUrl, 300, context, async () => {
      let weather;
      try {
        weather = await loadOpenMeteo(location);
      } catch (error) {
        console.error("Open-Meteo 请求失败，尝试 MET Norway：", error);
        weather = await loadMetNorway(location);
      }
      return jsonResponse(weather, {}, "public, max-age=300");
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "天气服务暂时不可用" },
      { status: 503 },
    );
  }
};
