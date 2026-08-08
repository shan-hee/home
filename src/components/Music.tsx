import { Close, FullScreen, GoEnd, GoStart, LoopOnce, MusicList, MusicOne, OffScreen, Pause, PlayCycle, PlayOne, Shuffle, TextMessage, VolumeMute, VolumeNotice, VolumeSmall } from "@icon-park/react";
import { createPortal } from "react-dom";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { getMusicCatalog, resolveNeteaseLyrics, resolveNeteasePlaybackUrl } from "@/api";
import type { MusicPlaylistSummary, PlaylistItem } from "@/api";
import PlayerSeekBar from "@/components/PlayerSeekBar";
import ThemedSelect from "@/components/ThemedSelect";
import VolumeSlider from "@/components/VolumeSlider";
import { ApiClientError } from "@/services/apiClient";
import { useMainStore } from "@/store";
import { loadPlayerPreferences, savePlayerPreferences } from "@/stores/playerPreferences";
import { useSiteContentStore } from "@/stores/siteContent";
import type { MainState } from "@/typings/store";
import type { MusicContentConfig } from "@/typings/siteContent";
import "@/components/Music.scss";

interface LyricWord {
  startTime: number;
  duration: number;
  text: string;
}

interface LyricLine {
  startTime: number;
  duration: number;
  text: string;
  words: LyricWord[];
}
type PlaybackSource = { url: string; source: "chksz" | "original" };

const modes: Array<{ value: MainState["playerOrder"]; label: string; icon: typeof PlayCycle }> = [
  { value: "list", label: "列表循环", icon: PlayCycle },
  { value: "single", label: "单曲循环", icon: LoopOnce },
  { value: "shuffle", label: "随机播放", icon: Shuffle },
];
const musicServerLabels = {
  netease: "网易云音乐",
  tencent: "QQ 音乐",
  kugou: "酷狗音乐",
  baidu: "百度音乐",
  kuwo: "酷我音乐",
} satisfies Record<MusicContentConfig["server"], string>;

function PlaybackToggleIcon({ playing, size, strokeWidth }: { playing: boolean; size: number; strokeWidth?: number }) {
  return playing ? <Pause theme="filled" size={size} strokeWidth={strokeWidth} fill="currentColor" /> : <PlayOne theme="filled" size={size} strokeWidth={strokeWidth} fill="currentColor" />;
}

function QueueTrackCover({ track, playing = false }: { track: PlaylistItem; playing?: boolean }) {
  return <span className="queue-track-cover" aria-hidden="true">{track.cover ? <img src={track.cover} alt="" /> : <span className="queue-cover-placeholder"><MusicOne theme="outline" size="24" /></span>}<span className="queue-track-action"><PlaybackToggleIcon playing={playing} size={22} /></span></span>;
}

interface CompactPlayerSurfaceProps {
  onOpen: () => void;
  onToggle: () => void;
  onChange: (direction: -1 | 1) => void;
  onSeek: (value: number) => void;
  onToggleMute: () => void;
  onPreviewVolume: (value: number) => void;
  onSaveVolume: (value: number) => void;
  displayName: string;
  artist?: string;
  currentTime: number;
  duration: number;
  volume: number;
  effectiveVolume: number;
  volumeIcon: ReactNode;
  playing: boolean;
  ready: boolean;
  hideProgress: boolean;
}

function CompactPlayerSurface({ onOpen, onToggle, onChange, onSeek, onToggleMute, onPreviewVolume, onSaveVolume, displayName, artist, currentTime, duration, volume, effectiveVolume, volumeIcon, playing, ready, hideProgress }: CompactPlayerSurfaceProps) {
  return <div className="compact-player">
    <div className="compact-controls">
      <button type="button" aria-label="打开播放列表" onClick={onOpen}><MusicList theme="filled" size="24" strokeWidth={5} fill="currentColor" /></button>
      <button type="button" aria-label="上一首" disabled={!ready} onClick={() => onChange(-1)}><GoStart theme="filled" size="27" strokeWidth={5} fill="currentColor" /></button>
      <button type="button" className="compact-play" aria-label={playing ? "暂停" : "播放"} disabled={!ready} onClick={onToggle}><PlaybackToggleIcon playing={playing} size={34} strokeWidth={5} /></button>
      <button type="button" aria-label="下一首" disabled={!ready} onClick={() => onChange(1)}><GoEnd theme="filled" size="27" strokeWidth={5} fill="currentColor" /></button>
      <div className="volume-control compact-volume"><button type="button" aria-label={effectiveVolume === 0 ? "恢复音量" : "静音"} onClick={onToggleMute}>{volumeIcon}</button><div className="volume-popover"><VolumeSlider value={volume} onPreview={onPreviewVolume} onCommit={onSaveVolume} /></div></div>
    </div>
    <div className="compact-meta"><span className="track-name">{displayName}</span>{artist && <span className="track-artist">{artist}</span>}</div>
    <div className={`compact-seek-shell${hideProgress ? " is-hidden" : ""}`}><PlayerSeekBar className="compact-seek" currentTime={currentTime} duration={duration} onSeek={onSeek} /></div>
  </div>;
}

const parseLrc = (source: string): LyricLine[] => {
  const result: LyricLine[] = [];
  for (const line of source.split(/\r?\n/)) {
    const text = line.replace(/\[(\d{1,3}):([\d.]+)\]/g, "").trim();
    for (const match of line.matchAll(/\[(\d{1,3}):([\d.]+)\]/g)) {
      result.push({
        startTime: Number(match[1]) * 60 + Number(match[2]),
        duration: 0,
        text,
        words: [],
      });
    }
  }
  result.sort((a, b) => a.startTime - b.startTime);
  for (let index = 0; index < result.length - 1; index += 1) {
    result[index]!.duration = Math.max(0, result[index + 1]!.startTime - result[index]!.startTime);
  }
  return result;
};

const parseYrc = (source: string): LyricLine[] => {
  const result: LyricLine[] = [];
  for (const sourceLine of source.split(/\r?\n/)) {
    const lineMatch = sourceLine.match(/^\[(\d+),(\d+)\](.*)$/);
    if (!lineMatch) continue;
    const words: LyricWord[] = [];
    const wordSource = lineMatch[3] || "";
    for (const match of wordSource.matchAll(/\((\d+),(\d+),\d+\)(.*?)(?=\(\d+,\d+,\d+\)|$)/g)) {
      const text = match[3] || "";
      if (!text) continue;
      words.push({
        startTime: Number(match[1]) / 1000,
        duration: Number(match[2]) / 1000,
        text,
      });
    }
    const text = words.map((word) => word.text).join("").trim();
    if (!text) continue;
    result.push({
      startTime: Number(lineMatch[1]) / 1000,
      duration: Number(lineMatch[2]) / 1000,
      text,
      words,
    });
  }
  return result.sort((a, b) => a.startTime - b.startTime);
};

const progressBetween = (current: number, start: number, duration: number) => {
  if (duration <= 0) return current >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (current - start) / duration));
};

function KaraokeLyricLine({ line, active, lineIndex }: { line: LyricLine; active: boolean; lineIndex: number }) {
  const wordSynced = line.words.some((word) => word.duration > 0);
  const className = `lyric-line${active ? " is-active" : ""}${wordSynced ? " is-word-synced" : ""}`;

  return <p className={className} data-line-index={lineIndex}>{wordSynced ? line.words.map((word, wordIndex) => {
    return <span key={`${word.startTime}-${wordIndex}`} className="lyric-word"><span className="lyric-word-base">{word.text}</span><span className="lyric-word-highlight" aria-hidden="true">{word.text}</span></span>;
  }) : line.text}</p>;
}

const timedIndexAt = <T extends { startTime: number }>(items: T[], time: number) => {
  let low = 0;
  let high = items.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (items[middle]!.startTime <= time) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
};

const KaraokeLyrics = memo(function KaraokeLyrics({ lyrics, audio, artist }: { lyrics: LyricLine[]; audio: RefObject<HTMLAudioElement | null>; artist?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef(-1);
  const activeWordRef = useRef(-1);
  const activeWordElements = useRef<HTMLElement[]>([]);
  const lastTime = useRef(Number.NaN);
  const [activeLine, setActiveLine] = useState(-1);

  useEffect(() => {
    const media = audio.current;
    const container = panel.current;
    if (!media || !container) return;
    let frame: number | null = null;

    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const setWordProgress = (element: HTMLElement | undefined, progress: number) => {
      if (!element) return;
      const remaining = 100 - Math.min(1, Math.max(0, progress)) * 100;
      element.style.setProperty("--word-remaining", `${remaining.toFixed(3)}%`);
    };
    const sync = (force = false) => {
      const time = Number.isFinite(media.currentTime) ? media.currentTime : 0;
      const nextLine = timedIndexAt(lyrics, time);
      const lineChanged = nextLine !== activeLineRef.current;
      if (lineChanged) {
        activeLineRef.current = nextLine;
        activeWordRef.current = -1;
        activeWordElements.current = nextLine >= 0
          ? Array.from(container.querySelectorAll<HTMLElement>(`[data-line-index="${nextLine}"] .lyric-word-highlight`))
          : [];
        setActiveLine(nextLine);
      }

      const line = nextLine >= 0 ? lyrics[nextLine] : undefined;
      if (!line?.words.length) {
        lastTime.current = time;
        return;
      }
      const nextWord = timedIndexAt(line.words, time);
      const jumped = !Number.isFinite(lastTime.current) || Math.abs(time - lastTime.current) > 0.25;
      if (force || lineChanged || jumped || nextWord !== activeWordRef.current) {
        line.words.forEach((word, wordIndex) => {
          setWordProgress(activeWordElements.current[wordIndex], progressBetween(time, word.startTime, word.duration));
        });
      } else if (nextWord >= 0) {
        const word = line.words[nextWord]!;
        setWordProgress(activeWordElements.current[nextWord], progressBetween(time, word.startTime, word.duration));
      }
      activeWordRef.current = nextWord;
      lastTime.current = time;
    };
    const loop = () => {
      sync();
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      stop();
      sync(true);
      if (!document.hidden && !media.paused && !media.ended) frame = requestAnimationFrame(loop);
    };
    const stopAndSync = () => {
      stop();
      sync(true);
    };
    const syncNow = () => sync(true);
    const handleVisibility = () => {
      if (document.hidden) stop();
      else if (!media.paused && !media.ended) start();
      else sync(true);
    };

    activeLineRef.current = -1;
    activeWordRef.current = -1;
    activeWordElements.current = [];
    lastTime.current = Number.NaN;
    sync(true);
    if (!media.paused && !media.ended) start();
    media.addEventListener("playing", start);
    media.addEventListener("pause", stopAndSync);
    media.addEventListener("waiting", stopAndSync);
    media.addEventListener("seeking", stopAndSync);
    media.addEventListener("seeked", start);
    media.addEventListener("ended", stopAndSync);
    media.addEventListener("timeupdate", syncNow);
    media.addEventListener("ratechange", syncNow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      media.removeEventListener("playing", start);
      media.removeEventListener("pause", stopAndSync);
      media.removeEventListener("waiting", stopAndSync);
      media.removeEventListener("seeking", stopAndSync);
      media.removeEventListener("seeked", start);
      media.removeEventListener("ended", stopAndSync);
      media.removeEventListener("timeupdate", syncNow);
      media.removeEventListener("ratechange", syncNow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [audio, lyrics]);

  useEffect(() => {
    const container = panel.current;
    const active = activeLine >= 0 ? container?.querySelector<HTMLElement>(`[data-line-index="${activeLine}"]`) : null;
    if (!container || !active) return;
    const panelRect = container.getBoundingClientRect();
    const lineRect = active.getBoundingClientRect();
    container.scrollTo({
      top: Math.max(0, container.scrollTop + lineRect.top - panelRect.top - (container.clientHeight - lineRect.height) / 2),
      behavior: "smooth",
    });
  }, [activeLine]);

  return <div ref={panel} className="lyrics-panel" aria-label="歌词">{lyrics.length ? lyrics.map((line, lineIndex) => <KaraokeLyricLine key={`${line.startTime}-${lineIndex}`} line={line} lineIndex={lineIndex} active={activeLine === lineIndex} />) : <div className="lyrics-placeholder"><strong>{artist || "未知歌手"}</strong><span>歌词数据将在播放后显示</span></div>}</div>;
});

const usableLyric = (value: string | undefined) => Boolean(value?.trim()) && !["loading", "not available", "歌词加载中..."].includes(value!.trim().toLowerCase());

const mediaUsesSource = (media: HTMLMediaElement, source: string | undefined) => {
  if (!source || !media.currentSrc) return false;
  try {
    return new URL(media.currentSrc, document.baseURI).href === new URL(source, document.baseURI).href;
  } catch {
    return media.currentSrc === source;
  }
};

export default function Music() {
  const audio = useRef<HTMLAudioElement>(null);
  const sourceGeneration = useRef(0);
  const sourceRequestSerial = useRef(0);
  const sourceRequests = useRef(new Map<string, number>());
  const playlistRequest = useRef(0);
  const lyricsTrackId = useRef<string | null>(null);
  const playAttempt = useRef(0);
  const failedSources = useRef(new Set<string>());
  const previousVolume = useRef(useMainStore.getState().musicVolume || .3);
  const volumeFrame = useRef<number | null>(null);
  const pendingVolume = useRef(useMainStore.getState().musicVolume || .3);
  const queuePlaylistPicker = useRef<HTMLDivElement>(null);
  const [storedPlayerPreferences] = useState(loadPlayerPreferences);
  const hasLocalPlayerPreferences = useRef(storedPlayerPreferences !== null);
  const preferredPlaylistId = useRef(storedPlayerPreferences?.activeMusicPlaylistId || "");

  const [playlists, setPlaylists] = useState<MusicPlaylistSummary[]>([]);
  const [playlistCache, setPlaylistCache] = useState<Record<string, PlaylistItem[]>>({});
  const [playbackPlaylistId, setPlaybackPlaylistId] = useState("");
  const [visiblePlaylistId, setVisiblePlaylistId] = useState("");
  const [loadingPlaylistId, setLoadingPlaylistId] = useState("");
  const [playlistError, setPlaylistError] = useState("");
  const [sources, setSources] = useState<Record<string, PlaybackSource>>({});
  const [index, setIndex] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [volume, setVolume] = useState(() => useMainStore.getState().musicVolume ?? 0.3);
  const [muted, setMuted] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const musicConfig = useSiteContentStore((state) => state.snapshot.sections.music);
  const musicRevision = useSiteContentStore((state) => state.snapshot.sectionRevisions.music);
  const preferences = useSiteContentStore((state) => state.snapshot.sections.preferences);
  const status = useMainStore((state) => state.playerStatus);
  const playIntent = useMainStore((state) => state.playerPlayIntent);
  const currentTime = useMainStore((state) => state.playerCurrentTime);
  const duration = useMainStore((state) => state.playerDuration);
  const ready = useMainStore((state) => state.musicIsOk);
  const error = useMainStore((state) => state.playerError);
  const footerShow = useMainStore((state) => state.footerPlayerShow);
  const queueOpen = useMainStore((state) => state.musicBoxOpenState);
  const fullscreen = useMainStore((state) => state.playerFullscreen);
  const order = useMainStore((state) => state.playerOrder);
  const shortcuts = preferences.playerKeyboardShortcuts;
  const autoplay = preferences.playerAutoplay;
  const patch = useMainStore((state) => state.patch);
  const setStatus = useMainStore((state) => state.setPlayerStatus);
  const playlist = playlistCache[playbackPlaylistId] || [];
  const visiblePlaylist = playlistCache[visiblePlaylistId] || [];
  const visiblePlaylistSummary = playlists.find((item) => item.id === visiblePlaylistId);
  const current = playlist[index] ?? null;
  const currentSource = current ? sources[current.id] : undefined;
  const playbackUrl = currentSource?.url;
  const actuallyPlaying = status === "playing";
  const playing = playIntent;
  const displayName = current?.name || useMainStore.getState().playerTitle || error || "播放器准备中";
  const currentMode = modes.find((mode) => mode.value === order) ?? modes[0]!;
  const effectiveVolume = muted ? 0 : volume;
  const footerActive = footerShow && ready;
  const activeLyric = useMemo(() => {
    let active = -1;
    for (let lineIndex = 0; lineIndex < lyrics.length; lineIndex += 1) {
      if (lyrics[lineIndex]!.startTime <= currentTime) active = lineIndex; else break;
    }
    return active;
  }, [currentTime, lyrics]);
  const backgroundStyle = useMemo<CSSProperties>(() => current?.cover ? { backgroundImage: `url(${JSON.stringify(current.cover)})` } : {}, [current?.cover]);

  const persistPlayerPreferences = useCallback((next: Partial<Pick<MainState, "musicVolume" | "playerOrder">> & { activeMusicPlaylistId?: string }) => {
    const state = useMainStore.getState();
    if (next.activeMusicPlaylistId !== undefined) preferredPlaylistId.current = next.activeMusicPlaylistId;
    savePlayerPreferences({
      musicVolume: next.musicVolume ?? state.musicVolume,
      playerOrder: next.playerOrder ?? state.playerOrder,
      activeMusicPlaylistId: next.activeMusicPlaylistId ?? preferredPlaylistId.current,
    });
    hasLocalPlayerPreferences.current = true;
  }, []);

  useEffect(() => {
    if (hasLocalPlayerPreferences.current) return;
    patch({ musicVolume: preferences.playerDefaultVolume, playerOrder: preferences.playerDefaultOrder });
    setVolume(preferences.playerDefaultVolume);
  }, [patch, preferences.playerDefaultOrder, preferences.playerDefaultVolume]);

  useEffect(() => {
    const reload = () => setReloadToken((value) => value + 1);
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);

  useEffect(() => {
    let alive = true;
    let retryTimer: number | null = null;
    playlistRequest.current += 1;
    sourceGeneration.current += 1;
    sourceRequests.current.clear();
    playAttempt.current += 1;
    failedSources.current.clear();
    setPlaylists([]); setPlaylistCache({}); setPlaybackPlaylistId(""); setVisiblePlaylistId(""); setLoadingPlaylistId(""); setPlaylistError(""); setSources({}); setIndex(0); setLyrics([]);
    patch({ playerStatus: "loading", playerPlayIntent: false, musicIsOk: false, playerError: null, playerCurrentTime: 0, playerDuration: 0 });
    void getMusicCatalog(musicRevision, preferredPlaylistId.current).then((catalog) => {
      if (!catalog.playlists.length || !catalog.playlistId || !catalog.tracks.length) throw new Error("播放列表为空");
      if (!alive) return;
      persistPlayerPreferences({ activeMusicPlaylistId: catalog.playlistId });
      setIndex(0);
      setPlaylists(catalog.playlists);
      setPlaylistCache({ [catalog.playlistId]: catalog.tracks });
      setPlaybackPlaylistId(catalog.playlistId);
      setVisiblePlaylistId(catalog.playlistId);
      patch({ musicIsOk: true, playerStatus: autoplay ? "loading" : "ready", playerPlayIntent: autoplay });
    }).catch((reason: unknown) => {
      if (!alive) return;
      patch({ playerError: reason instanceof Error ? reason.message : "播放器加载失败", playerStatus: "error", playerPlayIntent: false, musicIsOk: false });
      const retryable = !(reason instanceof ApiClientError) || reason.status >= 500;
      if (retryable && navigator.onLine) retryTimer = window.setTimeout(() => setReloadToken((value) => value + 1), 30000);
    });
    return () => {
      alive = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [autoplay, musicConfig.id, musicConfig.server, musicConfig.type, musicRevision, patch, persistPlayerPreferences, reloadToken]);

  useEffect(() => {
    if (!current) return;
    patch({
      playerTitle: current.name,
      playerArtist: current.artist,
      playerLyric: `${current.name} · ${current.artist || "未知歌手"}`,
    });
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.name, artist: current.artist, artwork: current.cover ? [{ src: current.cover }] : [] });
  }, [current, patch]);

  const prepareTrackSource = useCallback(async (track: PlaylistItem) => {
    if (sourceRequests.current.has(track.id)) return;
    const generation = sourceGeneration.current;
    const request = ++sourceRequestSerial.current;
    sourceRequests.current.set(track.id, request);
    try {
      let source: PlaybackSource = { url: track.url, source: "original" };
      if (musicConfig.server === "netease" && /^\d{1,20}$/.test(track.id)) {
        try {
          source = { url: await resolveNeteasePlaybackUrl(track.id), source: "chksz" };
        } catch {
          // 解析服务不可用时使用歌单原始地址。
        }
      }
      if (sourceGeneration.current !== generation) return;
      setSources((currentSources) => ({ ...currentSources, [track.id]: source }));
    } finally {
      if (sourceRequests.current.get(track.id) === request) sourceRequests.current.delete(track.id);
    }
  }, [musicConfig.server]);

  useEffect(() => {
    if (!current || currentSource || !playIntent) return;
    setStatus("loading");
    void prepareTrackSource(current);
  }, [current, currentSource, playIntent, prepareTrackSource, setStatus]);

  useEffect(() => {
    // React 更新 src 后浏览器会自行加载媒体；这里只清空上一音源的进度，
    // 并使旧播放请求失效，避免其异步结果覆盖新音源状态。
    playAttempt.current += 1;
    patch({ playerCurrentTime: 0, playerDuration: 0 });
  }, [patch, playbackUrl]);

  useEffect(() => {
    const controller = new AbortController();
    if (!current) {
      lyricsTrackId.current = null;
      setLyrics([]);
      return () => controller.abort();
    }
    if (lyricsTrackId.current !== current.id) {
      lyricsTrackId.current = null;
      setLyrics([]);
    }
    if ((!actuallyPlaying && !fullscreen) || lyricsTrackId.current === current.id) return () => controller.abort();
    const source = current.lrc.trim();
    const resolve = async () => {
      if (musicConfig.server === "netease" && /^\d{1,20}$/.test(current.id)) {
        try {
          const timedLyrics = await resolveNeteaseLyrics(current.id, controller.signal);
          const wordSynced = parseYrc(timedLyrics.yrc);
          if (wordSynced.length) return wordSynced;
          const standard = parseLrc(timedLyrics.lrc);
          if (standard.length) return standard;
        } catch {
          if (controller.signal.aborted) return [];
        }
      }
      if (!source) return [];
      const text = source.includes("[") ? source : await fetch(source, { signal: controller.signal }).then((response) => response.ok ? response.text() : "");
      return parseLrc(text);
    };
    void resolve().then((nextLyrics) => {
      if (!controller.signal.aborted) {
        lyricsTrackId.current = current.id;
        setLyrics(nextLyrics);
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        lyricsTrackId.current = current.id;
        setLyrics([]);
      }
    });
    return () => controller.abort();
  }, [actuallyPlaying, current, fullscreen, musicConfig.server]);

  useEffect(() => {
    const line = activeLyric >= 0 ? lyrics[activeLyric]?.text : undefined;
    const fallback = `${current?.name || "未知歌曲"} · ${current?.artist || "未知歌手"}`;
    patch({ playerLyric: usableLyric(line) ? line!.replace(/&nbsp;/g, " ") : fallback });
  }, [activeLyric, current?.artist, current?.name, lyrics, patch]);

  const play = useCallback(async () => {
    const media = audio.current;
    if (!media || !ready || !current) return;
    patch({ playerPlayIntent: true });
    if (!playbackUrl) {
      setStatus("loading");
      void prepareTrackSource(current);
      return;
    }
    if (!mediaUsesSource(media, playbackUrl)) {
      setStatus("loading");
      return;
    }
    const attempt = ++playAttempt.current;
    setStatus("loading");
    try {
      await media.play();
    } catch {
      if (playAttempt.current !== attempt || !mediaUsesSource(media, playbackUrl)) return;
      const state = useMainStore.getState();
      setStatus(state.playerHasStarted ? "paused" : "ready");
    }
  }, [current, patch, playbackUrl, prepareTrackSource, ready, setStatus]);
  const pause = useCallback(() => {
    playAttempt.current += 1;
    audio.current?.pause();
    const state = useMainStore.getState();
    setStatus(state.playerHasStarted ? "paused" : "ready");
  }, [setStatus]);
  const toggle = useCallback(() => {
    if (useMainStore.getState().playerPlayIntent) pause();
    else void play();
  }, [pause, play]);
  const showPlaylist = useCallback((playlistId: string) => {
    if (!playlists.some((item) => item.id === playlistId)) return;
    const request = ++playlistRequest.current;
    setVisiblePlaylistId(playlistId);
    setPlaylistError("");
    persistPlayerPreferences({ activeMusicPlaylistId: playlistId });
    if (playlistCache[playlistId]) {
      setLoadingPlaylistId("");
      return;
    }
    setLoadingPlaylistId(playlistId);
    void getMusicCatalog(musicRevision, playlistId).then((catalog) => {
      if (playlistRequest.current !== request) return;
      if (catalog.playlistId !== playlistId || !catalog.tracks.length) throw new Error("该歌单没有可播放内容");
      setPlaylists(catalog.playlists);
      setPlaylistCache((currentCache) => ({ ...currentCache, [playlistId]: catalog.tracks }));
      setLoadingPlaylistId("");
    }).catch((reason: unknown) => {
      if (playlistRequest.current !== request) return;
      setLoadingPlaylistId("");
      setPlaylistError(reason instanceof Error ? reason.message : "歌单加载失败");
    });
  }, [musicRevision, persistPlayerPreferences, playlistCache, playlists]);
  const pickNext = useCallback((direction: -1 | 1) => {
    if (!playlist.length) return 0;
    if (order === "shuffle" && playlist.length > 1) {
      let next = index;
      while (next === index) next = Math.floor(Math.random() * playlist.length);
      return next;
    }
    return (index + direction + playlist.length) % playlist.length;
  }, [index, order, playlist.length]);
  const select = useCallback((nextIndex: number, start = true) => {
    const nextTrack = playlist[nextIndex];
    if (!nextTrack) return;
    if (nextIndex === index) {
      if (audio.current) audio.current.currentTime = 0;
      patch({ playerCurrentTime: 0 });
      if (start) void play();
      return;
    }
    playAttempt.current += 1;
    patch({ playerCurrentTime: 0, playerDuration: 0, playerStatus: "loading", playerPlayIntent: start, playerError: null });
    setIndex(nextIndex);
  }, [index, patch, play, playlist]);
  const change = useCallback((direction: -1 | 1) => select(pickNext(direction)), [pickNext, select]);
  const seek = useCallback((time: number) => {
    if (!audio.current || !Number.isFinite(time)) return;
    audio.current.currentTime = time;
    patch({ playerCurrentTime: time });
  }, [patch]);
  const previewVolume = useCallback((value: number) => {
    const next = Math.min(1, Math.max(0, value));
    pendingVolume.current = next;
    if (muted) setMuted(false);
    if (volumeFrame.current !== null) return;
    volumeFrame.current = requestAnimationFrame(() => {
      if (audio.current) {
        audio.current.muted = false;
        audio.current.volume = pendingVolume.current;
      }
      volumeFrame.current = null;
    });
  }, [muted]);
  const saveVolume = useCallback((value: number) => {
    const next = Math.min(1, Math.max(0, value));
    if (next > 0) previousVolume.current = next;
    setMuted(false);
    setVolume(next);
    if (audio.current) {
      audio.current.muted = false;
      audio.current.volume = next;
    }
    patch({ musicVolume: next });
    persistPlayerPreferences({ musicVolume: next });
  }, [patch, persistPlayerPreferences]);
  const toggleMute = useCallback(() => {
    if (muted || volume === 0) {
      const restoredVolume = volume > 0 ? volume : previousVolume.current || .3;
      setMuted(false);
      if (volume === 0) {
        setVolume(restoredVolume);
        patch({ musicVolume: restoredVolume });
        persistPlayerPreferences({ musicVolume: restoredVolume });
      }
      if (audio.current) {
        audio.current.muted = false;
        audio.current.volume = restoredVolume;
      }
      return;
    }
    setMuted(true);
    if (audio.current) audio.current.muted = true;
  }, [muted, patch, persistPlayerPreferences, volume]);
  const selectFromQueue = useCallback((nextIndex: number) => {
    const nextTrack = visiblePlaylist[nextIndex];
    if (!nextTrack) return;
    if (visiblePlaylistId === playbackPlaylistId) {
      if (nextIndex !== index) select(nextIndex, true);
      return;
    }
    playAttempt.current += 1;
    patch({ playerCurrentTime: 0, playerDuration: 0, playerStatus: "loading", playerPlayIntent: true, playerError: null });
    setPlaybackPlaylistId(visiblePlaylistId);
    setIndex(nextIndex);
  }, [index, patch, playbackPlaylistId, select, visiblePlaylist, visiblePlaylistId]);
  const openPlaylist = useCallback(() => patch({ musicBoxOpenState: true }), [patch]);

  const handleLoadStart = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl) || !useMainStore.getState().playerPlayIntent) return;
    setStatus("loading");
  }, [playbackUrl, setStatus]);
  const handleCanPlay = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl)) return;
    failedSources.current.delete(current ? `${current.id}:${currentSource?.source || "original"}` : "");
    if (useMainStore.getState().playerPlayIntent) {
      if (media.paused) void play();
    }
    else {
      const state = useMainStore.getState();
      setStatus(state.playerHasStarted ? "paused" : "ready");
    }
  }, [current, currentSource?.source, play, playbackUrl, setStatus]);
  const handlePlay = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl)) return;
    patch({ playerPlayIntent: true });
  }, [patch, playbackUrl]);
  const handlePlaying = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl)) return;
    setStatus("playing");
  }, [playbackUrl, setStatus]);
  const handlePause = useCallback(() => {
    const media = audio.current;
    if (media?.currentSrc && playbackUrl && !mediaUsesSource(media, playbackUrl)) return;
    const state = useMainStore.getState();
    if (state.playerStatus === "error" || (state.playerPlayIntent && (state.playerStatus === "loading" || Boolean(media?.error)))) return;
    playAttempt.current += 1;
    setStatus(state.playerHasStarted ? "paused" : "ready");
  }, [playbackUrl, setStatus]);
  const handleWaiting = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl) || !useMainStore.getState().playerPlayIntent) return;
    setStatus("loading");
  }, [playbackUrl, setStatus]);
  const handlePlaybackError = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl)) return;
    const track = playlist[index];
    if (!track || !currentSource || sourceRequests.current.has(track.id)) return;
    const fail = () => {
      playAttempt.current += 1;
      patch({ playerError: "当前歌曲加载失败", playerStatus: "error", playerPlayIntent: false });
    };
    failedSources.current.add(`${track.id}:${currentSource.source}`);
    const selectedSource = sources[track.id];
    const resumeWith = (url: string, source: PlaybackSource["source"]) => {
      const shouldResume = useMainStore.getState().playerPlayIntent || Boolean(audio.current && !audio.current.paused && !audio.current.ended);
      playAttempt.current += 1;
      patch({ playerError: null, playerStatus: "loading", playerPlayIntent: shouldResume });
      setSources((currentSources) => ({ ...currentSources, [track.id]: { url, source } }));
    };
    if (selectedSource?.source === "chksz" && !failedSources.current.has(`${track.id}:original`)) {
      resumeWith(track.url, "original");
      return;
    }
    if (selectedSource?.source === "original" && musicConfig.server === "netease" && /^\d{1,20}$/.test(track.id) && !failedSources.current.has(`${track.id}:chksz`)) {
      const sourceRequest = ++sourceRequestSerial.current;
      sourceRequests.current.set(track.id, sourceRequest);
      const recoveryAttempt = ++playAttempt.current;
      patch({ playerError: null, playerStatus: "loading" });
      void resolveNeteasePlaybackUrl(track.id).then((url) => {
        if (playAttempt.current === recoveryAttempt) resumeWith(url, "chksz");
      }).catch(() => {
        if (playAttempt.current !== recoveryAttempt) return;
        failedSources.current.add(`${track.id}:chksz`);
        fail();
      }).finally(() => {
        if (sourceRequests.current.get(track.id) === sourceRequest) sourceRequests.current.delete(track.id);
      });
      return;
    }
    fail();
  }, [currentSource, index, musicConfig.server, patch, playbackUrl, playlist, sources]);
  const handleEnded = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl)) return;
    if (order === "single") {
      seek(0);
      void play();
      return;
    }
    select(pickNext(1), true);
  }, [order, pickNext, play, playbackUrl, seek, select]);

  useEffect(() => {
    if (!audio.current) return;
    pendingVolume.current = volume;
    if (volume > 0) previousVolume.current = volume;
    audio.current.volume = volume;
    audio.current.muted = muted;
  }, [muted, volume]);

  useEffect(() => () => {
    if (volumeFrame.current !== null) cancelAnimationFrame(volumeFrame.current);
  }, []);

  useEffect(() => {
    const media = navigator.mediaSession;
    if (!media) return;
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = { play, pause, nexttrack: () => change(1), previoustrack: () => change(-1), seekbackward: (details) => seek(Math.max(0, currentTime - (details.seekOffset || 5))), seekforward: (details) => seek(Math.min(duration || Infinity, currentTime + (details.seekOffset || 5))) };
    for (const [action, handler] of Object.entries(handlers)) { try { media.setActionHandler(action as MediaSessionAction, handler || null); } catch { /* 浏览器不支持该动作。 */ } }
    return () => { for (const action of Object.keys(handlers)) { try { media.setActionHandler(action as MediaSessionAction, null); } catch { /* 无需处理。 */ } } };
  }, [change, currentTime, duration, pause, play, seek]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (queueOpen) patch({ musicBoxOpenState: false });
        else if (fullscreen) patch({ playerFullscreen: false });
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!ready || !shortcuts || target?.closest("input, textarea, select, button, a, [contenteditable='true'], [role='textbox'], [role='slider']")) return;
      if (event.code === "Space" && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); toggle(); return; }
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "ArrowUp") { event.preventDefault(); saveVolume(Number(Math.min(1, volume + .05).toFixed(2))); }
      else if (event.code === "ArrowDown") { event.preventDefault(); saveVolume(Number(Math.max(0, volume - .05).toFixed(2))); }
      else if (event.code === "ArrowLeft" && !event.repeat) { event.preventDefault(); change(-1); }
      else if (event.code === "ArrowRight" && !event.repeat) { event.preventDefault(); change(1); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [change, fullscreen, patch, queueOpen, ready, saveVolume, shortcuts, toggle, volume]);

  const handleTimeUpdate = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl)) return;
    const nextTime = Number.isFinite(media.currentTime) ? media.currentTime : 0;
    patch({ playerCurrentTime: nextTime });
  }, [patch, playbackUrl]);

  const handleDurationChange = useCallback(() => {
    const media = audio.current;
    if (!media || !mediaUsesSource(media, playbackUrl) || !Number.isFinite(media.duration) || media.duration <= 0) return;

    // 流媒体头部解析期间 duration 可能有很小的浮点修正。播放器只展示到秒，
    // 统一取整可避免临界值在相邻秒之间跳动，同时仍以实际播放源为准。
    const nextDuration = Math.round(media.duration);
    if (useMainStore.getState().playerDuration !== nextDuration) {
      patch({ playerDuration: nextDuration });
    }
  }, [patch, playbackUrl]);

  const volumeIcon = effectiveVolume === 0 ? <VolumeMute theme="filled" size="23" fill="currentColor" /> : effectiveVolume < .7 ? <VolumeSmall theme="filled" size="23" fill="currentColor" /> : <VolumeNotice theme="filled" size="23" fill="currentColor" />;
  const cycleMode = () => {
    const next = modes[(modes.findIndex((mode) => mode.value === order) + 1) % modes.length]!.value;
    patch({ playerOrder: next });
    persistPlayerPreferences({ playerOrder: next });
  };
  const ModeIcon = currentMode.icon;

  const queue = queueOpen ? <div className={`queue-layer${fullscreen ? " is-fullscreen" : ""}`} onClick={() => patch({ musicBoxOpenState: false })}>
    <aside className="queue-panel" role="dialog" aria-modal="true" aria-label="播放列表" onClick={(event) => event.stopPropagation()}>
      <header><h2>播放列表</h2><button type="button" aria-label="关闭播放列表" onClick={() => patch({ musicBoxOpenState: false })}><Close theme="outline" size="24" fill="currentColor" /></button></header>
      <div className="queue-content"><section className="queue-section">
        <div ref={queuePlaylistPicker} className="queue-playlist-picker">{visiblePlaylistSummary?.cover ? <img src={visiblePlaylistSummary.cover} referrerPolicy="no-referrer" alt="" /> : <span className="queue-playlist-cover"><MusicOne theme="outline" size="20" /></span>}<div className="queue-playlist-field"><span>当前歌单</span><ThemedSelect className="queue-playlist-select" value={visiblePlaylistId} ariaLabel="切换歌单" searchable searchPlaceholder="搜索歌单名称或 ID" menuAnchorRef={queuePlaylistPicker} options={playlists.map((item) => ({ value: item.id, label: item.name, imageUrl: item.cover, description: `${item.trackCount} 首 · ID ${item.id}` }))} onChange={showPlaylist} /></div><span className="queue-count">{visiblePlaylist.length || visiblePlaylistSummary?.trackCount || 0} 首</span></div>
        {loadingPlaylistId === visiblePlaylistId ? <p className="empty-queue">正在加载“{visiblePlaylistSummary?.name || "歌单"}”…</p> : playlistError ? <p className="empty-queue is-error">{playlistError}</p> : visiblePlaylist.length ? <div className="queue-tracks">{visiblePlaylist.map((track, trackIndex) => {
          const isCurrent = visiblePlaylistId === playbackPlaylistId && trackIndex === index;
          return <button key={`${trackIndex}-${track.id}`} type="button" className={`queue-track${isCurrent ? " is-current" : ""}`} aria-current={isCurrent ? "true" : undefined} aria-label={isCurrent ? playing ? `暂停 ${track.name}` : `播放 ${track.name}` : `播放 ${track.name}`} onClick={isCurrent ? toggle : () => selectFromQueue(trackIndex)}><QueueTrackCover track={track} playing={isCurrent && playing} /><span className="queue-track-info"><strong>{track.name}</strong><small>{track.artist || "未知歌手"}</small></span>{isCurrent && playing && <span className="playing-bars" aria-label="正在播放"><i /><i /><i /></span>}</button>;
        })}</div> : <p className="empty-queue">播放列表为空</p>}
      </section></div>
    </aside>
  </div> : null;

  const full = fullscreen ? <section className="fullscreen-player" role="dialog" aria-modal="true" aria-label="全屏音乐播放器"><div className="fullscreen-background" style={backgroundStyle} aria-hidden="true" /><button type="button" className="exit-fullscreen" aria-label="退出全屏播放器" onClick={() => patch({ playerFullscreen: false })}><OffScreen theme="outline" size="26" fill="currentColor" /></button><div className="fullscreen-content"><header className="fullscreen-header"><h1>{displayName}</h1><p><span>歌手：{current?.artist || "未知歌手"}</span><span>来源：{musicServerLabels[musicConfig.server]}</span></p></header><div className="fullscreen-main"><div className="cover-area">{current?.cover ? <img src={current.cover} alt={`${displayName}封面`} /> : <div className="cover-placeholder"><MusicOne theme="outline" size="72" fill="currentColor" /></div>}</div><KaraokeLyrics lyrics={lyrics} audio={audio} artist={current?.artist} /></div></div><footer className="fullscreen-controls"><button type="button" aria-label="上一首" disabled={!ready} onClick={() => change(-1)}><GoStart theme="filled" size="25" fill="currentColor" /></button><button type="button" className="fullscreen-play" aria-label={playing ? "暂停" : "播放"} disabled={!ready} onClick={toggle}><PlaybackToggleIcon playing={playing} size={28} /></button><button type="button" aria-label="下一首" disabled={!ready} onClick={() => change(1)}><GoEnd theme="filled" size="25" fill="currentColor" /></button><PlayerSeekBar className="fullscreen-seek" currentTime={currentTime} duration={duration} showTime onSeek={seek} /><div className="volume-control fullscreen-volume"><button type="button" aria-label={effectiveVolume === 0 ? "恢复音量" : "静音"} onClick={toggleMute}>{volumeIcon}</button><div className="volume-popover"><VolumeSlider value={volume} onPreview={previewVolume} onCommit={saveVolume} /></div></div><button type="button" aria-label={`播放模式：${currentMode.label}`} title={`播放模式：${currentMode.label}`} onClick={cycleMode}><ModeIcon theme="outline" size="23" fill="currentColor" /></button><button type="button" aria-label="打开播放列表" onClick={openPlaylist}><MusicList theme="outline" size="24" fill="currentColor" /></button></footer></section> : null;

  return <><section className="music" aria-label="音乐播放器"><audio ref={audio} data-music-engine src={playbackUrl} preload="metadata" onLoadStart={handleLoadStart} onLoadedMetadata={handleDurationChange} onCanPlay={handleCanPlay} onTimeUpdate={handleTimeUpdate} onDurationChange={handleDurationChange} onPlay={handlePlay} onPlaying={handlePlaying} onPause={handlePause} onWaiting={handleWaiting} onEnded={handleEnded} onError={handlePlaybackError} /><button type="button" className={`footer-player-button${footerShow ? " is-active" : ""}`} aria-pressed={footerShow} aria-label={footerShow ? "隐藏底栏歌词和进度" : "显示底栏歌词和进度"} onClick={() => patch({ footerPlayerShow: !footerShow })}><TextMessage theme="outline" size="20" strokeWidth={4} fill="currentColor" /></button><button type="button" className="fullscreen-button" aria-label="打开全屏播放器" onClick={() => patch({ playerFullscreen: true })}><FullScreen theme="filled" size="20" strokeWidth={5} fill="currentColor" /></button>{current ? <CompactPlayerSurface onOpen={openPlaylist} onToggle={toggle} onChange={change} onSeek={seek} onToggleMute={toggleMute} onPreviewVolume={previewVolume} onSaveVolume={saveVolume} displayName={displayName} artist={current.artist} currentTime={currentTime} duration={duration} volume={volume} effectiveVolume={effectiveVolume} volumeIcon={volumeIcon} playing={playing} ready={ready} hideProgress={footerActive} /> : <div className="player-loading" aria-live="polite">{error || "播放器加载中…"}</div>}</section>{typeof document !== "undefined" && createPortal(<>{full}{queue}</>, document.body)}</>;
}
