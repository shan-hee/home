<template>
  <div class="weather weather-widget">
    <form v-if="editingCity" class="city-inline" role="search" @submit.prevent="searchCities">
      <input
        ref="cityInput"
        v-model="cityQuery"
        type="search"
        autocomplete="off"
        :placeholder="searchError || '输入城市后回车'"
        aria-label="城市名称"
        :aria-invalid="Boolean(searchError)"
        @input="searchError = ''"
        @keydown.esc.prevent="closeCityInput"
      />
      <button
        type="submit"
        aria-label="搜索城市"
        :disabled="cityQuery.trim().length < 2 || searching"
      >
        <Search theme="outline" size="17" />
      </button>
    </form>

    <button
      v-else
      type="button"
      class="weather-summary"
      :aria-label="`${summaryAria}，点击输入城市`"
      @click="openCityInput"
    >
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
      <span v-else>{{ errorMessage || "天气数据获取失败" }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Search } from "@icon-park/vue-next";
import type {
  GeocodingApiResponse,
  GeocodingResult,
  WeatherAlertsResponse,
  WeatherAlert,
  WeatherApiResponse,
  WeatherLocation,
} from "@/typings/weather";
import { SETTINGS_RESET_EVENT, STORAGE_KEYS } from "@/utils/storageKeys";

type WeatherDisplay = WeatherApiResponse & { stale: boolean };

interface WeatherCacheEntry {
  data: WeatherApiResponse;
  savedAt: string;
}

interface WeatherCacheStore {
  version: 1;
  entries: Record<string, WeatherCacheEntry>;
}

const SAVED_LOCATION_KEY = STORAGE_KEYS.weatherLocation;
const WEATHER_CACHE_KEY = STORAGE_KEYS.weatherCache;

const weatherData = ref<WeatherDisplay | null>(null);
const alerts = ref<WeatherAlert[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const editingCity = ref(false);
const cityInput = ref<HTMLInputElement | null>(null);
const cityQuery = ref("");
const searching = ref(false);
const searchError = ref("");

let searchController: AbortController | null = null;
let weatherController: AbortController | null = null;
let alertsController: AbortController | null = null;
let locationRequestId = 0;

const isWeatherApiResponse = (value: unknown): value is WeatherApiResponse => {
  if (!value || typeof value !== "object") return false;
  const weather = value as Record<string, unknown>;
  return (
    typeof weather.city === "string" &&
    typeof weather.latitude === "number" && Number.isFinite(weather.latitude) &&
    weather.latitude >= -90 && weather.latitude <= 90 &&
    typeof weather.longitude === "number" && Number.isFinite(weather.longitude) &&
    weather.longitude >= -180 && weather.longitude <= 180 &&
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

const readLatestCachedWeather = () => {
  const entries = Object.values(readCacheStore().entries)
    .filter((entry) => isWeatherApiResponse(entry.data))
    .sort((first, second) => Date.parse(second.savedAt) - Date.parse(first.savedAt));
  return entries[0] || null;
};

const saveWeatherCache = (location: WeatherLocation, data: WeatherApiResponse) => {
  const cache = readCacheStore();
  cache.entries[cacheKey(location)] = { data, savedAt: new Date().toISOString() };
  cache.entries = Object.fromEntries(
    Object.entries(cache.entries)
      .sort(([, first], [, second]) => Date.parse(second.savedAt) - Date.parse(first.savedAt))
      .slice(0, 5),
  );
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

const loadWeather = async (location?: WeatherLocation) => {
  weatherController?.abort();
  const controller = new AbortController();
  weatherController = controller;
  loading.value = true;
  errorMessage.value = "";
  const params = new URLSearchParams();
  if (location) {
    params.set("latitude", String(location.latitude));
    params.set("longitude", String(location.longitude));
    params.set("city", location.name);
  }
  const query = params.size > 0 ? `?${params}` : "";

  try {
    const response = await fetch(`/api/weather${query}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`天气接口返回 ${response.status}`);
    const payload: unknown = await response.json();
    if (!isWeatherApiResponse(payload)) throw new Error("天气接口响应格式无效");
    weatherData.value = { ...payload, stale: false };
    const resolvedLocation: WeatherLocation = {
      name: payload.city,
      latitude: payload.latitude,
      longitude: payload.longitude,
    };
    saveWeatherCache(resolvedLocation, payload);
    void loadAlerts(resolvedLocation);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const cached = location ? readCachedWeather(location) : readLatestCachedWeather();
    if (cached) {
      weatherData.value = { ...cached.data, stale: true };
      errorMessage.value = "实时天气不可用，正在显示旧数据";
    } else {
      weatherData.value = null;
      alerts.value = [];
      errorMessage.value = "天气数据获取失败";
    }
  } finally {
    if (weatherController === controller) loading.value = false;
  }
};

const closeCityInput = () => {
  searchController?.abort();
  editingCity.value = false;
  cityQuery.value = "";
  searchError.value = "";
  searching.value = false;
};

const useIpLocation = async () => {
  const requestId = ++locationRequestId;
  closeCityInput();
  try {
    localStorage.removeItem(SAVED_LOCATION_KEY);
  } catch {
    // 无法访问本地存储时仍可使用本次 IP 定位。
  }
  await loadWeather();
  if (requestId !== locationRequestId) return;
};

const selectCity = async (city: GeocodingResult) => {
  locationRequestId += 1;
  const location: WeatherLocation = {
    name: city.name,
    latitude: Number(city.latitude.toFixed(2)),
    longitude: Number(city.longitude.toFixed(2)),
  };
  storageSet(SAVED_LOCATION_KEY, JSON.stringify(location));
  closeCityInput();
  await loadWeather(location);
};

const searchCities = async () => {
  searchController?.abort();
  const query = cityQuery.value.trim();
  if (query.length < 2) {
    searchError.value = "至少输入两个字符";
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
    const city = results.find(isGeocodingResult);
    if (!city) {
      searchError.value = "未找到匹配城市";
      cityQuery.value = "";
      await nextTick();
      cityInput.value?.focus();
      return;
    }
    await selectCity(city);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    searchError.value = "城市搜索暂时不可用";
    cityQuery.value = "";
    await nextTick();
    cityInput.value?.focus();
  } finally {
    if (searchController === controller) searching.value = false;
  }
};

const openCityInput = async () => {
  editingCity.value = true;
  cityQuery.value = weatherData.value?.city || "";
  searchError.value = "";
  await nextTick();
  cityInput.value?.focus();
  cityInput.value?.select();
};

const summaryAria = computed(() => {
  if (!weatherData.value) return errorMessage.value || "天气数据获取失败";
  const stale = weatherData.value.stale ? "，旧数据" : "";
  return `${weatherData.value.city}，${weatherData.value.weather}，${weatherData.value.temperature} 摄氏度${stale}`;
});

const handleSettingsReset = () => {
  void useIpLocation();
};

onMounted(async () => {
  window.addEventListener(SETTINGS_RESET_EVENT, handleSettingsReset);
  const storedLocation = savedLocation();
  if (storedLocation) await loadWeather(storedLocation);
  else await useIpLocation();
});

onBeforeUnmount(() => {
  window.removeEventListener(SETTINGS_RESET_EVENT, handleSettingsReset);
  locationRequestId += 1;
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

  .city-inline {
    width: min(100%, 190px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;

    input {
      width: 100%;
      min-width: 0;
      height: 28px;
      padding: 0 8px;
      border: 1px solid rgba(from currentColor r g b / 0.24);
      border-radius: 6px;
      color: inherit;
      background: rgba(from currentColor r g b / 0.08);
      font: inherit;
      text-align: center;
      outline: none;

      &::placeholder {
        color: inherit;
        opacity: 0.68;
      }

      &:focus {
        border-color: rgba(from currentColor r g b / 0.48);
        background: rgba(from currentColor r g b / 0.12);
      }

      &[aria-invalid="true"] {
        border-color: rgb(255 150 150 / 70%);
      }
    }

    button {
      width: 28px;
      height: 28px;
      flex: 0 0 28px;
      display: grid;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 6px;
      color: inherit;
      background: rgba(from currentColor r g b / 0.08);
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background: rgba(from currentColor r g b / 0.14);
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.42;
      }
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

.status-badge {
  background: rgb(255 193 7 / 25%);
}

.alert-badge {
  background: rgb(244 67 54 / 28%);
}
</style>
