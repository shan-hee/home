import { useCallback, useEffect, useRef } from "react";
import { useMainStore } from "@/store";
import { getBrightness } from "@/utils/getColor";
import { toast } from "@/ui/toast";

type AppliedTheme = "light" | "dark";
const DARK_THRESHOLD = 116;
const LIGHT_THRESHOLD = 140;

export const useTheme = () => {
  const theme = useMainStore((state) => state.theme);
  const setSetting = useMainStore((state) => state.setSetting);
  const sequence = useRef(0);

  const setTheme = useCallback((value: AppliedTheme) => {
    document.documentElement.dataset.theme = value;
  }, []);

  const applyBackgroundTheme = useCallback(async (img: HTMLImageElement) => {
    if (useMainStore.getState().theme !== "bg") return;
    const current = ++sequence.current;
    try {
      const brightness = await getBrightness(img);
      if (current !== sequence.current || useMainStore.getState().theme !== "bg") return;
      if (brightness <= DARK_THRESHOLD) setTheme("dark");
      else if (brightness >= LIGHT_THRESHOLD) setTheme("light");
    } catch (error) {
      console.error(error);
      if (current !== sequence.current || useMainStore.getState().theme !== "bg") return;
      toast.error("背景主题切换失败，已回退到跟随系统");
      setSetting("theme", "system");
    }
  }, [setSetting, setTheme]);

  useEffect(() => {
    sequence.current += 1;
    const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let timer: number | null = null;
    const applySystem = () => setTheme(systemQuery.matches ? "dark" : "light");
    const applyTime = () => {
      const now = new Date();
      const hour = now.getHours();
      setTheme(hour >= 19 || hour < 6 ? "dark" : "light");
      const next = new Date(now);
      if (hour < 6) next.setHours(6, 0, 0, 0);
      else if (hour < 19) next.setHours(19, 0, 0, 0);
      else {
        next.setDate(next.getDate() + 1);
        next.setHours(6, 0, 0, 0);
      }
      timer = window.setTimeout(applyTime, next.getTime() - now.getTime());
    };
    const onSystemChange = () => {
      if (useMainStore.getState().theme === "system") applySystem();
    };

    if (theme === "light" || theme === "dark") setTheme(theme);
    else if (theme === "system") {
      applySystem();
      systemQuery.addEventListener("change", onSystemChange);
    } else if (theme === "time") applyTime();
    else {
      const background = document.querySelector<HTMLImageElement>("img.bg.current");
      if (background?.complete) void applyBackgroundTheme(background);
    }

    return () => {
      sequence.current += 1;
      if (timer !== null) window.clearTimeout(timer);
      systemQuery.removeEventListener("change", onSystemChange);
    };
  }, [theme, applyBackgroundTheme, setTheme]);

  return { applyBackgroundTheme };
};
