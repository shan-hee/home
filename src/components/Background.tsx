import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/services/apiClient";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import { useVisitorAppearanceStore } from "@/stores/visitorAppearance";
import type { BackgroundEffect } from "@/typings/store";
import { initSnowfall, closeSnowfall } from "@/utils/season/snow";
import { initFirefly, closeFirefly } from "@/utils/season/firefly";
import { initLantern, closeLantern } from "@/utils/season/lantern";
import { initMeteor, closeMeteor } from "@/utils/season/meteor";
import "@/components/Background.scss";

interface Props {
  onLoadComplete: () => void;
}

const preloadImage = (url: string, timeout = 12000) => new Promise<HTMLImageElement | null>((resolve) => {
  const image = new Image();
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
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
    try { await image.decode(); } catch { /* 图像本身仍可用。 */ }
    finish(image);
  };
  image.onerror = () => finish(null);
  image.src = url;
});

const lunarNewYearRanges: Record<number, [string, string]> = {
  2026: ["2026-02-10", "2026-03-03"], 2027: ["2027-01-30", "2027-02-20"],
  2028: ["2028-01-19", "2028-02-10"], 2029: ["2029-02-06", "2029-02-27"],
  2030: ["2030-01-27", "2030-02-17"],
};

const automaticEffects = (date = new Date()): BackgroundEffect[] => {
  const result: BackgroundEffect[] = [];
  const month = date.getMonth() + 1;
  const hour = date.getHours();
  if (hour >= 19 || hour < 6) result.push("meteor");
  if ([12, 1, 2].includes(month)) result.push("snow");
  if ([6, 7, 8].includes(month) && (hour >= 19 || hour < 6)) result.push("firefly");
  const range = lunarNewYearRanges[date.getFullYear()];
  const today = date.toISOString().slice(0, 10);
  if (range && today >= range[0] && today <= range[1]) result.push("lantern");
  return result;
};

const closeAllEffects = () => { closeMeteor(); closeSnowfall(); closeFirefly(); closeLantern(); };
const assetUrl = (assetId: string) => `/api/assets/${encodeURIComponent(assetId)}`;

interface RemoteWallpaper {
  imageUrl: string;
}

export default function Background({ onLoadComplete }: Props) {
  const wallpaper = useSiteContentStore((state) => state.snapshot.sections.wallpaper);
  const wallpaperRevision = useSiteContentStore((state) => state.snapshot.sectionRevisions.wallpaper);
  const rotationMinutes = useSiteContentStore((state) => state.snapshot.sections.preferences.wallpaperRotationMinutes);
  const effectsMode = useVisitorAppearanceStore((state) => state.effectsMode);
  const selectedEffects = useVisitorAppearanceStore((state) => state.selectedEffects);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  const variant = mobile ? "mobile" : "desktop";
  const assetId = mobile ? wallpaper.mobileAssetId : wallpaper.desktopAssetId;
  const rotationKey = `${wallpaper.source}:${variant}:${assetId || "none"}:${rotationMinutes}`;
  const [rotation, setRotation] = useState({ key: "", tick: 0 });
  const rotationTick = rotation.key === rotationKey ? rotation.tick : 0;
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [blurringIn, setBlurringIn] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);
  const [solidFallback, setSolidFallback] = useState(false);
  const currentRef = useRef<string | null>(null);
  const sequence = useRef(0);
  const initialComplete = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const finishInitial = useCallback(() => {
    useMainStore.getState().patch({ imgLoadStatus: true });
    if (initialComplete.current) return;
    initialComplete.current = true;
    onLoadComplete();
  }, [onLoadComplete]);

  const activateSolidFallback = useCallback((requestId: number) => {
    if (requestId !== sequence.current) return;
    clearTimers();
    currentRef.current = null;
    setCurrentUrl(null); setNextUrl(null); setTransitioning(false); setBlurringIn(false);
    setSolidFallback(true);
    finishInitial();
  }, [clearTimers, finishInitial]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const change = () => setMobile(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const requestId = ++sequence.current;
    clearTimers();
    const fail = () => {
      if (currentRef.current && (wallpaper.source !== "custom" || rotationTick > 0)) {
        finishInitial();
        return;
      }
      activateSolidFallback(requestId);
    };
    const resolveUrl = async () => {
      if (wallpaper.source === "custom" && (!assetId || rotationTick === 0)) {
        return assetId ? assetUrl(assetId) : null;
      }
      const params = new URLSearchParams({ source: wallpaper.source, variant });
      if (wallpaper.source === "wallhaven") params.set("rotationMinutes", String(rotationMinutes));
      if (wallpaper.source === "custom") {
        params.set("current", assetId!);
        params.set("cursor", String(rotationTick));
      }
      const result = await requestJson<RemoteWallpaper>(`/api/wallpaper?${params}`);
      return result.imageUrl;
    };
    void resolveUrl().then(async (candidate) => {
      if (requestId !== sequence.current) return;
      if (!candidate) return fail();
      const image = await preloadImage(candidate);
      if (requestId !== sequence.current) return;
      if (!image) return fail();
      setSolidFallback(false);
      if (currentRef.current === candidate) {
        setCurrentUrl(candidate); setNextUrl(null); setTransitioning(false); setBlurringIn(false); finishInitial();
        return;
      }
      if (!currentRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        currentRef.current = candidate; setCurrentUrl(candidate); setNextUrl(null);
        setTransitioning(false); setBlurringIn(false); finishInitial();
        return;
      }
      setNextUrl(candidate); setTransitioning(true); setBlurringIn(false);
      timers.current.push(window.setTimeout(() => requestId === sequence.current && setBlurringIn(true), 30));
      timers.current.push(window.setTimeout(() => {
        if (requestId !== sequence.current) return;
        setSkipTransition(true);
        currentRef.current = candidate; setCurrentUrl(candidate); setNextUrl(null);
        setTransitioning(false); setBlurringIn(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setSkipTransition(false)));
      }, 850));
    }).catch(fail);
  }, [activateSolidFallback, assetId, clearTimers, finishInitial, rotationMinutes, rotationTick, variant, wallpaper.source, wallpaperRevision]);

  useEffect(() => {
    if (rotationMinutes <= 0 || (wallpaper.source === "custom" && !assetId)) return;
    const duration = rotationMinutes * 60 * 1000;
    let lastRotationAt = Date.now();
    const rotate = () => {
      if (document.hidden) return;
      lastRotationAt = Date.now();
      setRotation((current) => ({
        key: rotationKey,
        tick: current.key === rotationKey ? current.tick + 1 : 1,
      }));
    };
    const interval = window.setInterval(rotate, duration);
    const online = () => rotate();
    const visible = () => {
      if (!document.hidden && Date.now() - lastRotationAt >= duration) rotate();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [assetId, rotationKey, rotationMinutes, wallpaper.source]);

  useEffect(() => {
    if (wallpaper.source !== "custom") return;
    [wallpaper.desktopAssetId, wallpaper.mobileAssetId]
      .filter((value): value is string => Boolean(value) && value !== assetId)
      .forEach((value) => { const image = new Image(); image.decoding = "async"; image.referrerPolicy = "no-referrer"; image.src = assetUrl(value); });
  }, [assetId, wallpaper.desktopAssetId, wallpaper.mobileAssetId, wallpaper.source]);

  useEffect(() => {
    const apply = () => {
      if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches || effectsMode === "off") {
        closeAllEffects(); return;
      }
      const desired = new Set<BackgroundEffect>(effectsMode === "manual" ? selectedEffects : automaticEffects());
      desired.has("meteor") ? initMeteor() : closeMeteor();
      desired.has("snow") ? initSnowfall() : closeSnowfall();
      desired.has("firefly") ? initFirefly() : closeFirefly();
      desired.has("lantern") ? initLantern() : closeLantern();
    };
    apply();
    const refresh = window.setInterval(apply, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", apply);
    return () => { window.clearInterval(refresh); document.removeEventListener("visibilitychange", apply); closeAllEffects(); };
  }, [effectsMode, selectedEffects]);

  useEffect(() => () => { sequence.current += 1; clearTimers(); closeAllEffects(); }, [clearTimers]);

  return <div className={`cover${solidFallback ? " solid-fallback" : ""}`}>
    {currentUrl && !solidFallback && <img src={currentUrl} referrerPolicy="no-referrer" className={`bg current${transitioning ? " blur-out" : ""}${skipTransition ? " no-transition" : ""}`} alt="" aria-hidden="true" onError={() => activateSolidFallback(++sequence.current)} />}
    {nextUrl && transitioning && <img src={nextUrl} referrerPolicy="no-referrer" className={`bg next${blurringIn ? " blur-in" : ""}`} alt="" aria-hidden="true" />}
    <div className="gray" />
  </div>;
}
