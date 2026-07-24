import { onBeforeUnmount, watch } from "vue";
import { ElMessage } from "element-plus";
import type { mainStore } from "@/store";
import { getBrightness } from "@/utils/getColor";

type MainStore = ReturnType<typeof mainStore>;
type AppliedTheme = "light" | "dark";

const DARK_THRESHOLD = 116;
const LIGHT_THRESHOLD = 140;

const currentAppliedTheme = (): AppliedTheme => {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
};

export const useTheme = (store: MainStore) => {
  const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let timeThemeTimer: number | null = null;
  let listeningToSystem = false;
  let brightnessSequence = 0;

  const setTheme = (theme: AppliedTheme) => {
    document.documentElement.dataset.theme = theme;
  };

  const applySystemTheme = () => setTheme(systemQuery.matches ? "dark" : "light");
  const handleSystemChange = () => {
    if (store.theme === "system") applySystemTheme();
  };

  const toggleSystemListener = (enabled: boolean) => {
    if (enabled === listeningToSystem) return;
    listeningToSystem = enabled;
    if (enabled) systemQuery.addEventListener("change", handleSystemChange);
    else systemQuery.removeEventListener("change", handleSystemChange);
  };

  const clearTimeThemeTimer = () => {
    if (timeThemeTimer !== null) window.clearTimeout(timeThemeTimer);
    timeThemeTimer = null;
  };

  const applyTimeTheme = () => {
    const now = new Date();
    const hour = now.getHours();
    setTheme(hour >= 19 || hour < 6 ? "dark" : "light");

    const nextBoundary = new Date(now);
    if (hour < 6) nextBoundary.setHours(6, 0, 0, 0);
    else if (hour < 19) nextBoundary.setHours(19, 0, 0, 0);
    else {
      nextBoundary.setDate(nextBoundary.getDate() + 1);
      nextBoundary.setHours(6, 0, 0, 0);
    }
    clearTimeThemeTimer();
    timeThemeTimer = window.setTimeout(applyTimeTheme, nextBoundary.getTime() - now.getTime());
  };

  const applyBackgroundTheme = async (img: HTMLImageElement) => {
    if (store.theme !== "bg") return;
    const sequence = ++brightnessSequence;
    try {
      const brightness = await getBrightness(img);
      if (sequence !== brightnessSequence || store.theme !== "bg") return;
      if (brightness <= DARK_THRESHOLD) setTheme("dark");
      else if (brightness >= LIGHT_THRESHOLD) setTheme("light");
      else setTheme(currentAppliedTheme());
    } catch (error) {
      console.error(error);
      if (sequence !== brightnessSequence || store.theme !== "bg") return;
      ElMessage.error("背景主题切换失败，已回退到跟随系统");
      store.theme = "system";
    }
  };

  const stopThemeWatch = watch(
    () => store.theme,
    (theme) => {
      brightnessSequence += 1;
      clearTimeThemeTimer();
      toggleSystemListener(theme === "system");
      if (theme === "light" || theme === "dark") setTheme(theme);
      else if (theme === "system") applySystemTheme();
      else if (theme === "time") applyTimeTheme();
      else {
        const background = document.querySelector("img.bg.current") as HTMLImageElement | null;
        if (background?.complete) void applyBackgroundTheme(background);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    brightnessSequence += 1;
    stopThemeWatch();
    clearTimeThemeTimer();
    toggleSystemListener(false);
  });

  return { applyBackgroundTheme };
};
