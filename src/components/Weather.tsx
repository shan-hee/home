import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSiteContentStore } from "@/stores/siteContent";
import type { WeatherAlertsResponse, WeatherAlert, WeatherApiResponse } from "@/typings/weather";
import "@/components/Weather.scss";

const isWeatherApiResponse = (value: unknown): value is WeatherApiResponse => {
  if (!value || typeof value !== "object") return false;
  const weather = value as Record<string, unknown>;
  return typeof weather.city === "string" && typeof weather.latitude === "number" && Number.isFinite(weather.latitude)
    && typeof weather.longitude === "number" && Number.isFinite(weather.longitude) && typeof weather.weather === "string"
    && typeof weather.temperature === "number" && Number.isFinite(weather.temperature) && typeof weather.winddirection === "string"
    && typeof weather.windpower === "string" && (weather.source === "open-meteo" || weather.source === "met-norway")
    && typeof weather.updatedAt === "string";
};

export default function Weather() {
  const location = useSiteContentStore((state) => state.snapshot.sections.preferences.weatherLocation);
  const [weather, setWeather] = useState<WeatherApiResponse | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const weatherController = useRef<AbortController | null>(null);
  const alertController = useRef<AbortController | null>(null);

  const loadAlerts = useCallback(async (latitude: number, longitude: number) => {
    alertController.current?.abort();
    const controller = new AbortController();
    alertController.current = controller;
    try {
      const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
      const response = await fetch(`/api/alerts?${params}`, { headers: { accept: "application/json" }, signal: controller.signal });
      if (!response.ok) return setAlerts([]);
      const payload = await response.json() as WeatherAlertsResponse;
      setAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
    } catch { if (!controller.signal.aborted) setAlerts([]); }
  }, []);

  useEffect(() => {
    weatherController.current?.abort();
    const controller = new AbortController();
    weatherController.current = controller;
    const params = new URLSearchParams();
    if (location) {
      params.set("latitude", String(location.latitude));
      params.set("longitude", String(location.longitude));
      params.set("city", location.city);
    }
    setLoading(true); setError("");
    void fetch(`/api/weather${params.size ? `?${params}` : ""}`, { headers: { accept: "application/json" }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const payload: unknown = await response.json();
        if (!isWeatherApiResponse(payload)) throw new Error();
        setWeather(payload);
        void loadAlerts(payload.latitude, payload.longitude);
      })
      .catch(() => { if (!controller.signal.aborted) { setWeather(null); setAlerts([]); setError("天气数据暂时不可用"); } })
      .finally(() => { if (weatherController.current === controller) setLoading(false); });
    return () => controller.abort();
  }, [loadAlerts, location]);

  useEffect(() => () => { weatherController.current?.abort(); alertController.current?.abort(); }, []);
  const aria = useMemo(() => weather ? `${weather.city}，${weather.weather}，${weather.temperature} 摄氏度` : error || "天气数据获取失败", [error, weather]);

  return <div className="weather weather-widget"><div className="weather-summary" aria-label={aria}>
    {weather ? <><span>{weather.city}&nbsp;</span><span>{weather.weather}&nbsp;</span><span>{weather.temperature}℃</span><span className="sm-hidden">&nbsp;{weather.winddirection.endsWith("风") ? weather.winddirection : `${weather.winddirection}风`} {weather.windpower.endsWith("级") ? weather.windpower : `${weather.windpower}级`}</span>{alerts.length > 0 && <span className="alert-badge">{alerts.length} 条预警</span>}</> : <span>{loading ? "天气加载中…" : error || "天气数据获取失败"}</span>}
  </div></div>;
}
