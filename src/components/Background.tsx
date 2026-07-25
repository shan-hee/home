import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import type { BackgroundEffect } from "@/typings/store";
import type { WallpaperContentConfig } from "@/typings/siteContent";
import { initSnowfall, closeSnowfall } from "@/utils/season/snow";
import { initFirefly, closeFirefly } from "@/utils/season/firefly";
import { initLantern, closeLantern } from "@/utils/season/lantern";
import { initMeteor, closeMeteor } from "@/utils/season/meteor";
import { toast } from "@/ui/toast";
import "@/components/Background.scss";

interface Props {
  onLoadComplete: () => void;
  onImageLoaded: (image: HTMLImageElement) => void;
}

interface OnlineWallpaper { imageUrl: string; downloadUrl: string }

const defaultConfig: WallpaperContentConfig = {
  version: 1,
  desktop: { count: 10, pattern: "/images/background{id}.jpg", fallback: "/images/background1.jpg" },
  mobile: { count: 2, pattern: "/images/phone/backgroundphone{id}.jpg", fallback: "/images/phone/backgroundphone1.jpg" },
};

const preloadImage = (url: string, timeout = 12000) => new Promise<HTMLImageElement | null>((resolve) => {
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

export default function Background({ onLoadComplete, onImageLoaded }: Props) {
  const backgroundShow = useMainStore((state) => state.backgroundShow);
  const coverType = useMainStore((state) => state.coverType);
  const wallpaperLocalId = useMainStore((state) => state.wallpaperLocalId);
  const autoInterval = useMainStore((state) => state.autoBGSwitchInterval);
  const effectsMode = useMainStore((state) => state.effectsMode);
  const selectedEffects = useMainStore((state) => state.selectedEffects);
  const config = useSiteContentStore((state) => state.snapshot.sections.wallpaper || defaultConfig);
  const wallpaperRevision = useSiteContentStore((state) => state.snapshot.sectionRevisions.wallpaper);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  const collection = mobile ? config.mobile : config.desktop;
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [blurringIn, setBlurringIn] = useState(false);
  const [solidFallback, setSolidFallback] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const currentRef = useRef<string | null>(null);
  const sequence = useRef(0);
  const initialComplete = useRef(false);
  const loading = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const finishInitial = useCallback(() => {
    useMainStore.getState().setImgLoadStatus(true);
    if (initialComplete.current) return;
    initialComplete.current = true;
    queueMicrotask(onLoadComplete);
  }, [onLoadComplete]);

  const activateSolidFallback = useCallback((requestId: number) => {
    if (requestId !== sequence.current) return;
    clearTimers();
    currentRef.current = null;
    setCurrentUrl(null); setNextUrl(null); setTransitioning(false); setBlurringIn(false);
    setSolidFallback(true); setDownloadUrl(null);
    finishInitial();
  }, [clearTimers, finishInitial]);

  const loadWallpaper = useCallback(async (source = coverType, temporaryId?: number) => {
    const requestId = ++sequence.current;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    loading.current = true;
    useMainStore.getState().patch({ wallpaperMaxId: collection.count });
    const localUrl = (id: number) => collection.pattern.replace("{id}", String(id));
    const randomId = () => Math.floor(Math.random() * collection.count) + 1;
    let candidate: string;
    let resolvedDownload: string;

    if (source === 0) {
      const preferred = temporaryId ?? wallpaperLocalId ?? randomId();
      if (!Number.isInteger(preferred) || preferred < 1 || preferred > collection.count) {
        toast.error(`当前设备的壁纸 ID 应在 1–${collection.count} 之间，已改为随机`);
        candidate = localUrl(randomId());
      } else candidate = localUrl(preferred);
      resolvedDownload = candidate;
    } else {
      try {
        const sourceName = source === 1 ? "bing" : source === 2 ? "wallhaven" : "wallhaven-anime";
        const response = await fetch(`/api/wallpaper?source=${sourceName}`, {
          headers: { accept: "application/json" }, cache: "no-store", signal: requestController.signal,
        });
        if (!response.ok) throw new Error(`在线壁纸接口返回 ${response.status}`);
        const value = await response.json() as Partial<OnlineWallpaper>;
        if (!value.imageUrl || !value.downloadUrl) throw new Error("在线壁纸响应格式无效");
        candidate = value.imageUrl; resolvedDownload = value.downloadUrl;
      } catch (error) {
        if (requestController.signal.aborted || requestId !== sequence.current) return;
        console.error("无法获取在线壁纸，使用本地 fallback：", error);
        candidate = collection.fallback; resolvedDownload = candidate;
        toast.error("在线壁纸加载失败，已切换到本地壁纸");
      }
    }

    let image = await preloadImage(candidate);
    let finalUrl = candidate;
    if (!image) {
      image = await preloadImage(collection.fallback);
      finalUrl = collection.fallback;
      resolvedDownload = finalUrl;
    }
    if (requestId !== sequence.current) return;
    if (!image) {
      toast.error("本地壁纸也无法加载，已使用纯色背景");
      activateSolidFallback(requestId);
      return;
    }
    setSolidFallback(false); setDownloadUrl(resolvedDownload); onImageLoaded(image);
    if (!currentRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clearTimers(); currentRef.current = finalUrl; setCurrentUrl(finalUrl); setNextUrl(null);
      setTransitioning(false); setBlurringIn(false); finishInitial();
    } else {
      setNextUrl(finalUrl); setTransitioning(true); setBlurringIn(false);
      timers.current.push(window.setTimeout(() => requestId === sequence.current && setBlurringIn(true), 30));
      timers.current.push(window.setTimeout(() => {
        if (requestId !== sequence.current) return;
        currentRef.current = finalUrl; setCurrentUrl(finalUrl); setNextUrl(null);
        setTransitioning(false); setBlurringIn(false);
      }, 850));
    }
    loading.current = false;
  }, [activateSolidFallback, clearTimers, collection, coverType, finishInitial, onImageLoaded, wallpaperLocalId]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const change = () => setMobile(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  useEffect(() => { void loadWallpaper(); }, [loadWallpaper, wallpaperRevision]);

  useEffect(() => useMainStore.subscribe(
    (state) => state.sBGCount,
    (value) => {
      if (!value || useMainStore.getState().coverType !== 0) return;
      useMainStore.getState().patch({ sBGCount: null });
      void loadWallpaper(0, Number(value));
    },
  ), [loadWallpaper]);

  useEffect(() => {
    const milliseconds = ({ 0: 0, 1: 15000, 2: 30000, 3: 45000 } as Record<number, number>)[autoInterval] || 0;
    if (!milliseconds) return;
    const timer = window.setInterval(() => !document.hidden && !loading.current && void loadWallpaper(), milliseconds);
    return () => window.clearInterval(timer);
  }, [autoInterval, loadWallpaper]);

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

  useEffect(() => () => {
    sequence.current += 1; controller.current?.abort(); clearTimers(); closeAllEffects();
  }, [clearTimers]);

  const coverClass = useMemo(() => `cover${backgroundShow ? " show" : ""}${solidFallback ? " solid-fallback" : ""}`, [backgroundShow, solidFallback]);
  return (
    <div className={coverClass}>
      {currentUrl && !solidFallback && <img src={currentUrl} className={`bg current${transitioning ? " blur-out" : ""}`} alt="" aria-hidden="true" onError={() => activateSolidFallback(++sequence.current)} />}
      {nextUrl && transitioning && <img src={nextUrl} className={`bg next${blurringIn ? " blur-in" : ""}`} alt="" aria-hidden="true" />}
      <div className={`gray${backgroundShow ? " o-hidden" : ""}`} />
      {backgroundShow && downloadUrl && <a className="down" href={downloadUrl} target="_blank" rel="noopener noreferrer">下载壁纸</a>}
    </div>
  );
}
