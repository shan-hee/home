<template>
  <div class="weather" v-if="weatherData.city && weatherData.weather">
    <span>{{ weatherData.city }}&nbsp;</span>
    <span>{{ weatherData.weather }}&nbsp;</span>
    <span>{{ weatherData.temperature }}℃</span>
    <span class="sm-hidden">
      &nbsp;{{
        weatherData.winddirection.endsWith("风")
          ? weatherData.winddirection
          : weatherData.winddirection + "风"
      }}&nbsp;
    </span>
    <span class="sm-hidden">
      {{
        weatherData.windpower.endsWith("级")
          ? weatherData.windpower
          : weatherData.windpower + "级"
      }}&nbsp;
    </span>
  </div>
  <div class="weather" v-else>
    <span>天气数据获取失败</span>
  </div>
</template>

<script setup lang="ts">
import { Error as ErrorIcon } from "@icon-park/vue-next";
import type { WeatherApiResponse } from "@/typings/weather";

const weatherData = reactive<WeatherApiResponse>({
  city: "",
  weather: "",
  temperature: 0,
  winddirection: "",
  windpower: "",
  source: "open-meteo",
  updatedAt: "",
});

const isWeatherApiResponse = (value: unknown): value is WeatherApiResponse => {
  if (!value || typeof value !== "object") return false;
  const weather = value as Record<string, unknown>;
  return (
    typeof weather.city === "string" &&
    typeof weather.weather === "string" &&
    typeof weather.temperature === "number" &&
    typeof weather.winddirection === "string" &&
    typeof weather.windpower === "string" &&
    (weather.source === "open-meteo" || weather.source === "met-norway") &&
    typeof weather.updatedAt === "string"
  );
};

const getWeatherData = async () => {
  try {
    const response = await fetch("/api/weather", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`天气接口返回 ${response.status}`);
    }
    const data: unknown = await response.json();
    if (!isWeatherApiResponse(data)) {
      throw new Error("天气接口响应格式无效");
    }
    Object.assign(weatherData, data);
  } catch (error) {
    console.error("天气信息获取失败：", error);
    ElMessage({
      message: "天气信息获取失败",
      icon: h(ErrorIcon, {
        theme: "filled",
        fill: "var(--el-message-icon-color)",
      }),
    });
  }
};

onMounted(getWeatherData);
</script>
