<template>
  <div class="weather weather-widget">
    <button type="button" class="weather-summary" :aria-label="summaryAria" @click="dialogOpen = true">
      <template v-if="weatherData">
        <span>{{ weatherData.city }}&nbsp;</span>
        <span>{{ weatherData.weather }}&nbsp;</span>
        <span>{{ weatherData.temperature }}℃</span>
        <span class="sm-hidden">
          &nbsp;{{ weatherData.winddirection.endsWith("风") ? weatherData.winddirection : `${weatherData.winddirection}风` }}
          {{ weatherData.windpower.endsWith("级") ? weatherData.windpower : `${weatherData.windpower}级` }}
        </span>
        <span v-if="weatherData.stale" class="status-badge">旧数据</span>
        <span v-if="alerts.length" class="alert-badge">{{ alerts.length }} 条预警</span>
      </template>
      <span v-else-if="loading">天气加载中…</span>
      <span v-else>{{ errorMessage || "选择城市" }}</span>
    </button>

    <el-dialog v-model="dialogOpen" title="选择城市" width="min(92vw, 440px)" append-to-body>
      <div class="search-row">
        <input v-model="cityQuery" type="search" autocomplete="off" placeholder="城市名称" aria-label="城市名称"
          @input="queueCitySearch" @keydown.enter.prevent="searchCities" />
        <button type="button" aria-label="搜索城市" :disabled="cityQuery.trim().length < 2 || searching"
          @click="searchCities">
          <Search theme="outline" size="18" />
        </button>
        <button type="button" aria-label="使用当前位置" :disabled="locating" @click="useBrowserLocation">
          <Gps theme="outline" size="18" />
        </button>
      </div>

      <div v-if="searching" class="search-state">正在搜索…</div>
      <div v-else-if="searchError" class="search-state error">{{ searchError }}</div>
      <ul v-else-if="cityResults.length" class="city-results">
        <li v-for="city in cityResults" :key="city.id">
          <button type="button" @click="selectCity(city)">
            <span>{{ city.name }}</span>
            <small>{{ [city.admin1, city.country].filter(Boolean).join(" · ") }}</small>
          </button>
        </li>
      </ul>

      <div v-if="weatherData" class="weather-details">
        <span>{{ weatherData.source === "open-meteo" ? "Open-Meteo" : "MET Norway" }}</span>
        <span>{{ updatedLabel }}</span>
        <span v-if="weatherData.stale" class="status-badge">旧数据</span>
      </div>

      <ul v-if="alerts.length" class="weather-alerts">
        <li v-for="alert in alerts" :key="alert.id">
          <strong>{{ alert.title }}</strong>
          <span v-if="alert.level">{{ alert.level }}</span>
          <p v-if="alert.text">{{ alert.text }}</p>
        </li>
      </ul>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Error as ErrorIcon, Gps, Search } from "@icon-park/vue-next";
import type {
  GeocodingApiResponse,
  GeocodingResult,
  WeatherAlertsResponse,
  WeatherAlert,
  WeatherApiResponse,
  WeatherLocation,
} from "@/typings/weather";

type WeatherDisplay = WeatherApiResponse & { stale: boolean };

interface WeatherCacheEntry {
  data: WeatherApiResponse;
  savedAt: string;
}

interface WeatherCacheStore {
  version: 1;
  entries: Record<string, WeatherCacheEntry>;
}

const SAVED_LOCATION_KEY = "home:weather:location:v1";
const WEATHER_CACHE_KEY = "home:weather:cache:v1";

const weatherData = ref<WeatherDisplay | null>(null);
const alerts = ref<WeatherAlert[]>([]);
const loading = ref(false);
const locating = ref(false);
const errorMessage = ref("");
const dialogOpen = ref(false);
const cityQuery = ref("");
const cityResults = ref<GeocodingResult[]>([]);
const searching = ref(false);
const searchError = ref("");

let searchTimer: number | null = null;
let searchController: AbortController | null = null;
let weatherController: AbortController | null = null;
let alertsController: AbortController | null = null;
let locationRequestId = 0;

const isWeatherApiResponse = (value: unknown): value is WeatherApiResponse => {
  if (!value || typeof value !== "object") return false;
  const weather = value as Record<string, unknown>;
  return (
    typeof weather.city === "string" &&
    typeof weather.weather === "string" &&
    typeof weather.temperature === "number" && Number.isFinite(weather.temperature) &&
    typeof weather.winddirection === "string" &&
    typeof weather.windpower === "string" &&
    (weather.source === "open-meteo" || weather.source === "met-norway") &&
    typeof weather.updatedAt === "string"
  );
};

const isWeatherLocation = (value: unknown): value is WeatherLocation => {
  if (!value || typeof value !== "object") return false;
  const location = value as Record<string, unknown>;
  return (
    typeof location.name === "string" && location.name.trim().length > 0 &&
    typeof location.latitude === "number" && Number.isFinite(location.latitude) &&
    location.latitude >= -90 && location.latitude <= 90 &&
    typeof location.longitude === "number" && Number.isFinite(location.longitude) &&
    location.longitude >= -180 && location.longitude <= 180
  );
};

const isGeocodingResult = (value: unknown): value is GeocodingResult => {
  if (!isWeatherLocation(value)) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.id === "string" &&
    typeof result.admin1 === "string" &&
    typeof result.country === "string"
  );
};

const storageGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const storageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("天气设置无法写入本地存储：", error);
  }
};

const cacheKey = (location: WeatherLocation) => {
  return `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
};

const readCacheStore = (): WeatherCacheStore => {
  const raw = storageGet(WEATHER_CACHE_KEY);
  if (!raw) return { version: 1, entries: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("缓存格式无效");
    const candidate = parsed as Partial<WeatherCacheStore>;
    if (candidate.version !== 1 || !candidate.entries || typeof candidate.entries !== "object") {
      throw new Error("缓存版本无效");
    }
    return candidate as WeatherCacheStore;
  } catch {
    return { version: 1, entries: {} };
  }
};

const readCachedWeather = (location: WeatherLocation) => {
  const entry = readCacheStore().entries[cacheKey(location)];
  return entry && isWeatherApiResponse(entry.data) ? entry : null;
};

const saveWeatherCache = (location: WeatherLocation, data: WeatherApiResponse) => {
  const cache = readCacheStore();
  cache.entries[cacheKey(location)] = { data, savedAt: new Date().toISOString() };
  const newestEntries = Object.entries(cache.entries)
    .sort(([, first], [, second]) => Date.parse(second.savedAt) - Date.parse(first.savedAt))
    .slice(0, 5);
  cache.entries = Object.fromEntries(newestEntries);
  storageSet(WEATHER_CACHE_KEY, JSON.stringify(cache));
};

const savedLocation = () => {
  const raw = storageGet(SAVED_LOCATION_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isWeatherLocation(value) ? value : null;
  } catch {
    return null;
  }
};

const loadAlerts = async (location: WeatherLocation) => {
  alertsController?.abort();
  const controller = new AbortController();
  alertsController = controller;
  alerts.value = [];
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
  });
  try {
    const response = await fetch(`/api/alerts?${params}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`预警接口返回 ${response.status}`);
    const payload = await response.json() as WeatherAlertsResponse;
    if (!Array.isArray(payload.alerts)) throw new Error("预警响应格式无效");
    alerts.value = payload.alerts;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    alerts.value = [];
    console.warn("可选天气预警不可用，不影响普通天气：", error);
  }
};

const loadWeather = async (location: WeatherLocation) => {
  weatherController?.abort();
  const controller = new AbortController();
  weatherController = controller;
  loading.value = true;
  errorMessage.value = "";
  void loadAlerts(location);
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    city: location.name,
  });

  try {
    const response = await fetch(`/api/weather?${params}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`天气接口返回 ${response.status}`);
    const payload: unknown = await response.json();
    if (!isWeatherApiResponse(payload)) throw new Error("天气接口响应格式无效");
    weatherData.value = { ...payload, stale: false };
    saveWeatherCache(location, payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const cached = readCachedWeather(location);
    if (cached) {
      weatherData.value = { ...cached.data, stale: true };
      errorMessage.value = "实时天气不可用，正在显示旧数据";
    } else {
      weatherData.value = null;
      errorMessage.value = "天气数据获取失败";
      dialogOpen.value = true;
      ElMessage({
        message: "天气获取失败，请选择城市",
        icon: h(ErrorIcon, { theme: "filled", fill: "var(--el-message-icon-color)" }),
      });
    }
  } finally {
    if (weatherController === controller) loading.value = false;
  }
};

const getBrowserLocation = () => {
  return new Promise<WeatherLocation>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("浏览器不支持定位"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        name: "当前位置",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
};

const useBrowserLocation = async () => {
  const requestId = ++locationRequestId;
  locating.value = true;
  try {
    const location = await getBrowserLocation();
    if (requestId !== locationRequestId) return;
    try {
      localStorage.removeItem(SAVED_LOCATION_KEY);
    } catch {
      // 无法访问本地存储时仍可使用本次定位。
    }
    dialogOpen.value = false;
    await loadWeather(location);
  } catch (error) {
    if (requestId !== locationRequestId) return;
    console.warn("浏览器定位不可用：", error);
    errorMessage.value = "定位不可用，请选择城市";
    dialogOpen.value = true;
  } finally {
    if (requestId === locationRequestId) locating.value = false;
  }
};

const searchCities = async () => {
  if (searchTimer !== null) window.clearTimeout(searchTimer);
  searchController?.abort();
  const query = cityQuery.value.trim();
  if (query.length < 2) {
    cityResults.value = [];
    searchError.value = "";
    searching.value = false;
    return;
  }
  const controller = new AbortController();
  searchController = controller;
  searching.value = true;
  searchError.value = "";
  try {
    const response = await fetch(`/api/geocoding?name=${encodeURIComponent(query)}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`城市搜索返回 ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("城市搜索响应格式无效");
    const results = (payload as Partial<GeocodingApiResponse>).results;
    if (!Array.isArray(results)) throw new Error("城市搜索响应格式无效");
    cityResults.value = results.filter(isGeocodingResult);
    if (cityResults.value.length === 0) searchError.value = "未找到匹配城市";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    cityResults.value = [];
    searchError.value = "城市搜索暂时不可用";
  } finally {
    if (searchController === controller) searching.value = false;
  }
};

const queueCitySearch = () => {
  if (searchTimer !== null) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void searchCities(), 400);
};

const selectCity = async (city: GeocodingResult) => {
  locationRequestId += 1;
  locating.value = false;
  const location: WeatherLocation = {
    name: city.name,
    latitude: Number(city.latitude.toFixed(2)),
    longitude: Number(city.longitude.toFixed(2)),
  };
  storageSet(SAVED_LOCATION_KEY, JSON.stringify(location));
  cityResults.value = [];
  cityQuery.value = "";
  dialogOpen.value = false;
  await loadWeather(location);
};

const updatedLabel = computed(() => {
  if (!weatherData.value) return "";
  const date = new Date(weatherData.value.updatedAt);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
});

const summaryAria = computed(() => {
  if (!weatherData.value) return errorMessage.value || "选择城市";
  const stale = weatherData.value.stale ? "，旧数据" : "";
  return `${weatherData.value.city}，${weatherData.value.weather}，${weatherData.value.temperature} 摄氏度${stale}`;
});

onMounted(async () => {
  const storedLocation = savedLocation();
  if (storedLocation) {
    await loadWeather(storedLocation);
  } else {
    await useBrowserLocation();
  }
});

onBeforeUnmount(() => {
  locationRequestId += 1;
  if (searchTimer !== null) window.clearTimeout(searchTimer);
  searchController?.abort();
  weatherController?.abort();
  alertsController?.abort();
});
</script>

<style lang="scss" scoped>
.weather-widget {
  display: flex;
  align-items: center;
  justify-content: center;

  .weather-summary {
    max-width: 100%;
    padding: 4px 8px;
    border: 0;
    border-radius: 6px;
    color: inherit;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover,
    &:focus-visible {
      background: rgb(255 255 255 / 12%);
    }
  }
}

.status-badge,
.alert-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 0.72rem;
}

.status-badge { background: rgb(255 193 7 / 25%); }
.alert-badge { background: rgb(244 67 54 / 28%); }

.search-row {
  display: grid;
  grid-template-columns: 1fr 38px 38px;
  gap: 8px;

  input,
  button {
    height: 38px;
    border: 1px solid var(--set-radio-border-color);
    border-radius: 7px;
    color: var(--text-color);
    background: var(--set-radio-bg-color);
  }

  input { padding: 0 10px; }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  }
}

.search-state {
  padding: 18px 4px 4px;
  color: var(--text-color);

  &.error { color: #d9534f; }
}

.city-results,
.weather-alerts {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.city-results {
  max-height: 240px;
  overflow-y: auto;

  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px;
    border: 0;
    border-radius: 7px;
    color: var(--text-color);
    background: transparent;
    cursor: pointer;

    &:hover,
    &:focus-visible { background: var(--set-radio-bg-color); }
  }

  small { opacity: 0.7; }
}

.weather-details {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
  font-size: 0.78rem;
  opacity: 0.8;
}

.weather-alerts li {
  padding: 10px;
  border-radius: 7px;
  color: var(--text-color);
  background: rgb(244 67 54 / 12%);

  & + li { margin-top: 8px; }

  span { margin-left: 8px; }

  p {
    margin: 6px 0 0;
    line-height: 1.5;
    white-space: normal;
  }
}
</style>
