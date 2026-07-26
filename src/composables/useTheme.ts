import { useCallback, useEffect } from "react";
import { useMainStore } from "@/store";

type AppliedTheme = "light" | "dark";

export const useTheme = () => {
  const theme = useMainStore((state) => state.theme);

  const setTheme = useCallback((value: AppliedTheme) => {
    document.documentElement.dataset.theme = value;
  }, []);

  useEffect(() => {
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
    } else applyTime();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      systemQuery.removeEventListener("change", onSystemChange);
    };
  }, [theme, setTheme]);
};
