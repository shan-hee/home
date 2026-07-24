<template>
  <div class="cover" :class="{ show: store.backgroundShow, 'solid-fallback': useSolidFallback }">
    <img
      v-if="currentBgUrl && !useSolidFallback"
      :src="currentBgUrl"
      :class="['bg', 'current', { 'blur-out': isTransitioning }]"
      alt=""
      aria-hidden="true"
      @error="handleCommittedImageError"
    />
    <img
      v-if="nextBgUrl && isTransitioning"
      :src="nextBgUrl"
      :class="['bg', 'next', { 'blur-in': isBlurringIn }]"
      alt=""
      aria-hidden="true"
    />
    <div :class="store.backgroundShow ? 'gray o-hidden' : 'gray'" />
    <Transition name="fade" mode="out-in">
      <a v-if="store.backgroundShow && downloadUrl" class="down" :href="downloadUrl" target="_blank"
        rel="noopener noreferrer">
        下载壁纸
      </a>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Error as ErrorIcon } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import type { SeasonalEffect } from "@/typings/store";
import { initSnowfall, closeSnowfall } from "@/utils/season/snow";
import { initFirefly, closeFirefly } from "@/utils/season/firefly";
import { initLantern, closeLantern } from "@/utils/season/lantern";

interface WallpaperCollection {
  count: number;
  pattern: string;
  fallback: string;
}

interface WallpaperConfig {
  version: number;
  desktop: WallpaperCollection;
  mobile: WallpaperCollection;
}

const defaultConfig: WallpaperConfig = {
  version: 1,
  desktop: {
    count: 10,
    pattern: "/images/background{id}.jpg",
    fallback: "/images/background1.jpg",
  },
  mobile: {
    count: 2,
    pattern: "/images/phone/backgroundphone{id}.jpg",
    fallback: "/images/phone/backgroundphone1.jpg",
  },
};

const store = mainStore();
const emit = defineEmits<{
  loadComplete: [];
  imageLoaded: [image: HTMLImageElement];
}>();

const currentBgUrl = ref<string | null>(null);
const nextBgUrl = ref<string | null>(null);
const isTransitioning = ref(false);
const isBlurringIn = ref(false);
const useSolidFallback = ref(false);
const config = ref<WallpaperConfig | null>(null);
const isLoading = ref(false);
const hasCompletedInitialLoad = ref(false);

let requestSequence = 0;
let transitionStartTimer: number | null = null;
let transitionEndTimer: number | null = null;
let autoSwitchTimer: number | null = null;
let effectRefreshTimer: number | null = null;

const deviceQuery = window.matchMedia("(max-width: 720px)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const activeCollection = computed(() => {
  const resolvedConfig = config.value || defaultConfig;
  return deviceQuery.matches ? resolvedConfig.mobile : resolvedConfig.desktop;
});

const downloadUrl = computed(() => useSolidFallback.value ? null : currentBgUrl.value);

const isWallpaperCollection = (value: unknown): value is WallpaperCollection => {
  if (!value || typeof value !== "object") return false;
  const collection = value as Record<string, unknown>;
  return (
    Number.isInteger(collection.count) &&
    Number(collection.count) > 0 &&
    typeof collection.pattern === "string" &&
    collection.pattern.includes("{id}") &&
    typeof collection.fallback === "string" &&
    collection.fallback.length > 0
  );
};

const loadConfig = async () => {
  try {
    const response = await fetch("/images/config.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`壁纸配置返回 ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("壁纸配置格式无效");
    const value = payload as Record<string, unknown>;
    if (value.version !== 1 || !isWallpaperCollection(value.desktop) || !isWallpaperCollection(value.mobile)) {
      throw new Error("壁纸配置字段无效");
    }
    config.value = payload as WallpaperConfig;
  } catch (error) {
    console.error("无法加载壁纸配置，使用内置 fallback：", error);
    config.value = defaultConfig;
  }
  store.wallpaperMaxId = activeCollection.value.count;
};

const localUrl = (id: number) => activeCollection.value.pattern.replace("{id}", String(id));

const randomLocalId = () => {
  const count = activeCollection.value.count;
  return Math.floor(Math.random() * count) + 1;
};

const resolveLocalCandidate = (temporaryId?: number) => {
  const preferredId = temporaryId ?? store.wallpaperLocalId ?? randomLocalId();
  if (!Number.isInteger(preferredId) || preferredId < 1 || preferredId > activeCollection.value.count) {
    ElMessage.error(`当前设备的壁纸 ID 应在 1–${activeCollection.value.count} 之间，已改为随机`);
    return localUrl(randomLocalId());
  }
  return localUrl(preferredId);
};

const resolveOnlineCandidate = (source: number) => {
  const cacheBuster = Date.now();
  if (source === 1) return "https://api.dujin.org/bing/1920.php";
  if (source === 2) return `https://api.vvhan.com/api/wallpaper/views?time=${cacheBuster}`;
  return `https://api.vvhan.com/api/wallpaper/acg?time=${cacheBuster}`;
};

const preloadImage = (url: string, timeout = 12000) => {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };
    const timeoutId = window.setTimeout(() => finish(null), timeout);
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // 部分浏览器在 onload 后仍会拒绝 decode，图像本身依然可用。
      }
      finish(image);
    };
    image.onerror = () => finish(null);
    image.src = url;
  });
};

const clearTransitionTimers = () => {
  if (transitionStartTimer !== null) window.clearTimeout(transitionStartTimer);
  if (transitionEndTimer !== null) window.clearTimeout(transitionEndTimer);
  transitionStartTimer = null;
  transitionEndTimer = null;
};

const finishInitialLoad = () => {
  store.setImgLoadStatus(true);
  if (hasCompletedInitialLoad.value) return;
  hasCompletedInitialLoad.value = true;
  nextTick(() => emit("loadComplete"));
};

const commitImage = async (url: string, image: HTMLImageElement, sequence: number) => {
  if (sequence !== requestSequence) return;
  useSolidFallback.value = false;
  emit("imageLoaded", image);

  if (!currentBgUrl.value || reducedMotionQuery.matches) {
    clearTransitionTimers();
    currentBgUrl.value = url;
    nextBgUrl.value = null;
    isTransitioning.value = false;
    isBlurringIn.value = false;
    finishInitialLoad();
    return;
  }

  nextBgUrl.value = url;
  isTransitioning.value = true;
  isBlurringIn.value = false;
  await nextTick();
  transitionStartTimer = window.setTimeout(() => {
    if (sequence === requestSequence) isBlurringIn.value = true;
  }, 30);
  transitionEndTimer = window.setTimeout(() => {
    if (sequence !== requestSequence) return;
    currentBgUrl.value = url;
    nextBgUrl.value = null;
    isTransitioning.value = false;
    isBlurringIn.value = false;
  }, 850);
};

const activateSolidFallback = (sequence: number) => {
  if (sequence !== requestSequence) return;
  clearTransitionTimers();
  currentBgUrl.value = null;
  nextBgUrl.value = null;
  isTransitioning.value = false;
  isBlurringIn.value = false;
  useSolidFallback.value = true;
  finishInitialLoad();
};

const loadWallpaper = async (source = Number(store.coverType), temporaryId?: number) => {
  const sequence = ++requestSequence;
  isLoading.value = true;
  if (!config.value) await loadConfig();
  store.wallpaperMaxId = activeCollection.value.count;

  const candidate = source === 0 ? resolveLocalCandidate(temporaryId) : resolveOnlineCandidate(source);
  let image = await preloadImage(candidate);
  let finalUrl = candidate;

  if (!image) {
    const fallbackUrl = activeCollection.value.fallback;
    image = await preloadImage(fallbackUrl);
    finalUrl = fallbackUrl;
    if (source !== 0) {
      ElMessage({
        message: "在线壁纸加载失败，已切换到本地壁纸",
        icon: h(ErrorIcon, { theme: "filled", fill: "var(--el-message-icon-color)" }),
      });
    }
  }

  if (sequence !== requestSequence) return;
  if (image) {
    await commitImage(finalUrl, image, sequence);
  } else {
    ElMessage({
      message: "本地壁纸也无法加载，已使用纯色背景",
      icon: h(ErrorIcon, { theme: "filled", fill: "var(--el-message-icon-color)" }),
    });
    activateSolidFallback(sequence);
  }
  if (sequence === requestSequence) isLoading.value = false;
};

const handleCommittedImageError = () => {
  const sequence = ++requestSequence;
  activateSolidFallback(sequence);
};

const clearAutoSwitch = () => {
  if (autoSwitchTimer !== null) window.clearTimeout(autoSwitchTimer);
  autoSwitchTimer = null;
};

const scheduleAutoSwitch = () => {
  clearAutoSwitch();
  const intervals: Record<number, number> = { 0: 0, 1: 15000, 2: 30000, 3: 45000 };
  const interval = intervals[store.autoBGSwitchInterval] || 0;
  if (!interval || document.hidden) return;
  autoSwitchTimer = window.setTimeout(async () => {
    if (!isLoading.value) await loadWallpaper();
    scheduleAutoSwitch();
  }, interval);
};

const lunarNewYearRanges: Record<number, [string, string]> = {
  2026: ["2026-02-10", "2026-03-03"],
  2027: ["2027-01-30", "2027-02-20"],
  2028: ["2028-01-19", "2028-02-10"],
  2029: ["2029-02-06", "2029-02-27"],
  2030: ["2030-01-27", "2030-02-17"],
};

const automaticEffects = (date = new Date()): SeasonalEffect[] => {
  const effects: SeasonalEffect[] = [];
  const month = date.getMonth() + 1;
  const hour = date.getHours();
  if ([12, 1, 2].includes(month)) effects.push("snow");
  if ([6, 7, 8].includes(month) && (hour >= 19 || hour < 6)) effects.push("firefly");
  const range = lunarNewYearRanges[date.getFullYear()];
  if (range) {
    const today = date.toISOString().slice(0, 10);
    if (today >= range[0] && today <= range[1]) effects.push("lantern");
  }
  return effects;
};

const closeAllEffects = () => {
  closeSnowfall();
  closeFirefly();
  closeLantern();
};

const applyEffects = () => {
  if (document.hidden || reducedMotionQuery.matches || store.effectsMode === "off") {
    closeAllEffects();
    return;
  }
  const desired = new Set<SeasonalEffect>(
    store.effectsMode === "manual" ? store.selectedEffects : automaticEffects(),
  );
  desired.has("snow") ? initSnowfall() : closeSnowfall();
  desired.has("firefly") ? initFirefly() : closeFirefly();
  desired.has("lantern") ? initLantern() : closeLantern();
};

const scheduleEffectRefresh = () => {
  if (effectRefreshTimer !== null) window.clearInterval(effectRefreshTimer);
  effectRefreshTimer = window.setInterval(applyEffects, 30 * 60 * 1000);
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    clearAutoSwitch();
    closeAllEffects();
  } else {
    scheduleAutoSwitch();
    applyEffects();
  }
};

const handleDeviceChange = async () => {
  store.wallpaperMaxId = activeCollection.value.count;
  await loadWallpaper();
};

watch(() => store.coverType, (value) => {
  void loadWallpaper(Number(value));
  scheduleAutoSwitch();
});

watch(() => store.sBGCount, (value) => {
  if (!value || store.coverType !== 0) return;
  const temporaryId = Number(value);
  store.sBGCount = null;
  void loadWallpaper(0, temporaryId);
});

watch(() => store.wallpaperLocalId, () => {
  if (store.coverType === 0) void loadWallpaper(0);
});

watch(() => store.autoBGSwitchInterval, scheduleAutoSwitch);
watch([() => store.effectsMode, () => [...store.selectedEffects]], applyEffects);

onMounted(async () => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  deviceQuery.addEventListener("change", handleDeviceChange);
  reducedMotionQuery.addEventListener("change", applyEffects);
  await loadConfig();
  await loadWallpaper();
  applyEffects();
  scheduleEffectRefresh();
  scheduleAutoSwitch();
});

onBeforeUnmount(() => {
  requestSequence++;
  clearTransitionTimers();
  clearAutoSwitch();
  if (effectRefreshTimer !== null) window.clearInterval(effectRefreshTimer);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  deviceQuery.removeEventListener("change", handleDeviceChange);
  reducedMotionQuery.removeEventListener("change", applyEffects);
  closeAllEffects();
});
</script>

<style lang="scss" scoped>
.cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
  background: linear-gradient(145deg, #243447, #101820);
  transition: 0.25s;

  &.show { z-index: 1; }

  &.solid-fallback {
    background:
      radial-gradient(circle at 25% 20%, rgb(88 124 154 / 55%), transparent 45%),
      linear-gradient(145deg, #243447, #101820);
  }

  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    backface-visibility: hidden;
    will-change: filter, opacity, transform;
    transition:
      filter 0.8s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);

    &.current {
      filter: blur(0) brightness(1);
      opacity: 1;
      transform: scale(1);

      &.blur-out {
        filter: blur(24px) brightness(0.5);
        opacity: 0;
        transform: scale(1.04);
      }
    }

    &.next {
      z-index: 2;
      filter: blur(24px) brightness(0.5);
      opacity: 0;
      transform: scale(1.04);

      &.blur-in {
        filter: blur(0) brightness(1);
        opacity: 1;
        transform: scale(1);
      }
    }
  }

  .gray {
    position: absolute;
    inset: 0;
    z-index: 3;
    opacity: 1;
    pointer-events: none;
    background-image:
      radial-gradient(rgb(0 0 0 / 0%) 0, rgb(0 0 0 / 50%) 100%),
      radial-gradient(rgb(0 0 0 / 0%) 33%, rgb(0 0 0 / 30%) 166%);
    transition: opacity 0.8s;

    &.o-hidden { opacity: 0; }
  }

  .down {
    position: absolute;
    right: 0;
    bottom: 30px;
    left: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 40px;
    margin: 0 auto;
    border-radius: 8px;
    color: white;
    background-color: rgb(0 0 0 / 30%);

    &:hover {
      transform: scale(1.05);
      background-color: rgb(0 0 0 / 60%);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .cover,
  .cover .bg,
  .cover .gray {
    transition: none;
  }
}
</style>
