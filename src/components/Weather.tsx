import { Search } from "@icon-park/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMainStore } from "@/store";
import type { GeocodingApiResponse, GeocodingResult, WeatherAlertsResponse, WeatherAlert, WeatherApiResponse, WeatherLocation } from "@/typings/weather";
import { SETTINGS_RESET_EVENT, STORAGE_KEYS } from "@/utils/storageKeys";
import "@/components/Weather.scss";

type WeatherDisplay = WeatherApiResponse & { stale: boolean };
interface WeatherCacheEntry { data: WeatherApiResponse; savedAt: string }
interface WeatherCacheStore { version: 1; entries: Record<string, WeatherCacheEntry> }

const isWeatherApiResponse = (value: unknown): value is WeatherApiResponse => {
  if (!value || typeof value !== "object") return false;
  const weather = value as Record<string, unknown>;
  return typeof weather.city === "string" && typeof weather.latitude === "number" && Number.isFinite(weather.latitude)
    && typeof weather.longitude === "number" && Number.isFinite(weather.longitude) && typeof weather.weather === "string"
    && typeof weather.temperature === "number" && Number.isFinite(weather.temperature) && typeof weather.winddirection === "string"
    && typeof weather.windpower === "string" && (weather.source === "open-meteo" || weather.source === "met-norway")
    && typeof weather.updatedAt === "string";
};

const isLocation = (value: unknown): value is WeatherLocation => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === "string" && item.name.trim().length > 0 && typeof item.latitude === "number"
    && Number.isFinite(item.latitude) && typeof item.longitude === "number" && Number.isFinite(item.longitude);
};

const isGeocodingResult = (value: unknown): value is GeocodingResult => isLocation(value)
  && typeof (value as Record<string, unknown>).id === "string";

const readCache = (): WeatherCacheStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.weatherCache);
    if (!raw) return { version: 1, entries: {} };
    const parsed = JSON.parse(raw) as Partial<WeatherCacheStore>;
    return parsed.version === 1 && parsed.entries && typeof parsed.entries === "object"
      ? parsed as WeatherCacheStore : { version: 1, entries: {} };
  } catch { return { version: 1, entries: {} }; }
};

const locationKey = (location: WeatherLocation) => `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;

export default function Weather() {
  const location = useMainStore((state) => state.weatherLocation);
  const setSetting = useMainStore((state) => state.setSetting);
  const [weather, setWeather] = useState<WeatherDisplay | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const weatherController = useRef<AbortController | null>(null);
  const alertController = useRef<AbortController | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const locationName = location?.name ?? "";
  const locationLatitude = location?.latitude ?? null;
  const locationLongitude = location?.longitude ?? null;

  const loadAlerts = useCallback(async (target: WeatherLocation) => {
    alertController.current?.abort();
    const controller = new AbortController();
    alertController.current = controller;
    try {
      const params = new URLSearchParams({ latitude: String(target.latitude), longitude: String(target.longitude) });
      const response = await fetch(`/api/alerts?${params}`, { headers: { accept: "application/json" }, signal: controller.signal });
      if (!response.ok) return setAlerts([]);
      const payload = await response.json() as WeatherAlertsResponse;
      setAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
    } catch { if (!controller.signal.aborted) setAlerts([]); }
  }, []);

  const loadWeather = useCallback(async (target?: WeatherLocation) => {
    weatherController.current?.abort();
    const controller = new AbortController();
    weatherController.current = controller;
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (target) { params.set("latitude", String(target.latitude)); params.set("longitude", String(target.longitude)); params.set("city", target.name); }
    try {
      const response = await fetch(`/api/weather${params.size ? `?${params}` : ""}`, { headers: { accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error();
      const payload: unknown = await response.json();
      if (!isWeatherApiResponse(payload)) throw new Error();
      setWeather({ ...payload, stale: false });
      const resolved = { name: payload.city, latitude: payload.latitude, longitude: payload.longitude };
      const cache = readCache();
      cache.entries[locationKey(resolved)] = { data: payload, savedAt: new Date().toISOString() };
      cache.entries = Object.fromEntries(Object.entries(cache.entries).sort(([, a], [, b]) => Date.parse(b.savedAt) - Date.parse(a.savedAt)).slice(0, 5));
      try { localStorage.setItem(STORAGE_KEYS.weatherCache, JSON.stringify(cache)); } catch { /* 保持内存数据即可。 */ }
      void loadAlerts(resolved);
    } catch {
      if (controller.signal.aborted) return;
      const entries = Object.values(readCache().entries).filter((entry) => isWeatherApiResponse(entry.data));
      const cached = target ? readCache().entries[locationKey(target)] : entries.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0];
      if (cached && isWeatherApiResponse(cached.data)) { setWeather({ ...cached.data, stale: true }); setError("实时天气不可用，正在显示旧数据"); }
      else { setWeather(null); setAlerts([]); setError("天气数据获取失败"); }
    } finally { if (weatherController.current === controller) setLoading(false); }
  }, [loadAlerts]);

  useEffect(() => {
    const target = locationName && locationLatitude !== null && locationLongitude !== null
      ? { name: locationName, latitude: locationLatitude, longitude: locationLongitude }
      : undefined;
    void loadWeather(target);
  }, [loadWeather, locationName, locationLatitude, locationLongitude]);
  useEffect(() => {
    const reset = () => setSetting("weatherLocation", null);
    window.addEventListener(SETTINGS_RESET_EVENT, reset);
    return () => { window.removeEventListener(SETTINGS_RESET_EVENT, reset); weatherController.current?.abort(); alertController.current?.abort(); searchController.current?.abort(); };
  }, [setSetting]);

  const close = () => { searchController.current?.abort(); setEditing(false); setQuery(""); setSearchError(""); setSearching(false); };
  const open = () => { setEditing(true); setQuery(weather?.city || ""); setSearchError(""); window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }); };
  const search = async (event: FormEvent) => {
    event.preventDefault();
    const name = query.trim();
    if (name.length < 2) return setSearchError("至少输入两个字符");
    searchController.current?.abort();
    const controller = new AbortController(); searchController.current = controller; setSearching(true); setSearchError("");
    try {
      const response = await fetch(`/api/geocoding?name=${encodeURIComponent(name)}`, { headers: { accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error();
      const payload = await response.json() as Partial<GeocodingApiResponse>;
      const city = Array.isArray(payload.results) ? payload.results.find(isGeocodingResult) : undefined;
      if (!city) { setQuery(""); setSearchError("未找到匹配城市"); window.setTimeout(() => inputRef.current?.focus()); return; }
      const next = { name: city.name, latitude: Number(city.latitude.toFixed(2)), longitude: Number(city.longitude.toFixed(2)) };
      close(); setSetting("weatherLocation", next);
      if (JSON.stringify(location) === JSON.stringify(next)) void loadWeather(next);
    } catch { if (!controller.signal.aborted) { setQuery(""); setSearchError("城市搜索暂时不可用"); window.setTimeout(() => inputRef.current?.focus()); } }
    finally { if (searchController.current === controller) setSearching(false); }
  };

  const aria = useMemo(() => weather ? `${weather.city}，${weather.weather}，${weather.temperature} 摄氏度${weather.stale ? "，旧数据" : ""}` : error || "天气数据获取失败", [error, weather]);

  return <div className="weather weather-widget">
    {editing ? <form className="city-inline" role="search" onSubmit={search}>
      <input ref={inputRef} value={query} type="search" autoComplete="off" placeholder={searchError || "输入城市后回车"} aria-label="城市名称" aria-invalid={Boolean(searchError)} onChange={(event) => { setQuery(event.target.value); setSearchError(""); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }} />
      <button type="submit" aria-label="搜索城市" disabled={query.trim().length < 2 || searching}><Search theme="outline" size="17" /></button>
    </form> : <button type="button" className="weather-summary" aria-label={`${aria}，点击输入城市`} onClick={open}>
      {weather ? <><span>{weather.city}&nbsp;</span><span>{weather.weather}&nbsp;</span><span>{weather.temperature}℃</span><span className="sm-hidden">&nbsp;{weather.winddirection.endsWith("风") ? weather.winddirection : `${weather.winddirection}风`} {weather.windpower.endsWith("级") ? weather.windpower : `${weather.windpower}级`}</span>{weather.stale && <span className="status-badge">旧数据</span>}{alerts.length > 0 && <span className="alert-badge">{alerts.length} 条预警</span>}</> : <span>{loading ? "天气加载中…" : error || "天气数据获取失败"}</span>}
    </button>}
  </div>;
}
