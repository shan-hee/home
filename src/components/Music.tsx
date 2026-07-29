import { Close, FullScreen, GoEnd, GoStart, LoopOnce, MusicList, MusicOne, OffScreen, Pause, PlayCycle, PlayOne, Shuffle, TextMessage, VolumeMute, VolumeNotice, VolumeSmall } from "@icon-park/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { getPlayerList, resolveNeteaseLyrics, resolveNeteasePlaybackUrl } from "@/api";
import type { PlaylistItem } from "@/api";
import PlayerSeekBar from "@/components/PlayerSeekBar";
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

function QueueTrackCover({ track, playing = false }: { track: PlaylistItem; playing?: boolean }) {
  return <span className="queue-track-cover" aria-hidden="true">{track.cover ? <img src={track.cover} alt="" /> : <span className="queue-cover-placeholder"><MusicOne theme="outline" size="24" /></span>}<span className="queue-track-action">{playing ? <Pause theme="filled" size="22" fill="currentColor" /> : <PlayOne theme="filled" size="22" fill="currentColor" />}</span></span>;
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
  loading: boolean;
  hideProgress: boolean;
}

function CompactPlayerSurface({ onOpen, onToggle, onChange, onSeek, onToggleMute, onPreviewVolume, onSaveVolume, displayName, artist, currentTime, duration, volume, effectiveVolume, volumeIcon, playing, ready, loading, hideProgress }: CompactPlayerSurfaceProps) {
  return <div className="compact-player">
    <div className="compact-controls">
      <button type="button" aria-label="打开播放列表" onClick={onOpen}><MusicList theme="filled" size="24" strokeWidth={5} fill="currentColor" /></button>
      <button type="button" aria-label="上一首" disabled={!ready} onClick={() => onChange(-1)}><GoStart theme="filled" size="27" strokeWidth={5} fill="currentColor" /></button>
      <button type="button" className="compact-play" aria-label={playing ? "暂停" : "播放"} disabled={!ready} onClick={onToggle}>{playing ? <Pause theme="filled" size="34" strokeWidth={5} fill="currentColor" /> : <PlayOne theme="filled" size="34" strokeWidth={5} fill="currentColor" />}</button>
      <button type="button" aria-label="下一首" disabled={!ready} onClick={() => onChange(1)}><GoEnd theme="filled" size="27" strokeWidth={5} fill="currentColor" /></button>
      <div className="volume-control compact-volume"><button type="button" aria-label={effectiveVolume === 0 ? "恢复音量" : "静音"} onClick={onToggleMute}>{volumeIcon}</button><div className="volume-popover"><VolumeSlider value={volume} onPreview={onPreviewVolume} onCommit={onSaveVolume} /></div></div>
    </div>
    <div className="compact-meta"><span className="track-name">{displayName}</span>{artist && <span className="track-artist">{artist}</span>}</div>
    <div className={`compact-seek-shell${hideProgress ? " is-hidden" : ""}`}><PlayerSeekBar className="compact-seek" currentTime={currentTime} duration={duration} loading={loading} onSeek={onSeek} /></div>
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

function KaraokeLyricLine({ line, active, currentTime, lineIndex }: { line: LyricLine; active: boolean; currentTime: number; lineIndex: number }) {
  const wordSynced = line.words.some((word) => word.duration > 0);
  const className = `lyric-line${active ? " is-active" : ""}${wordSynced ? " is-word-synced" : ""}`;

  return <p className={className} data-line-index={lineIndex}>{wordSynced ? line.words.map((word, wordIndex) => {
    const progress = progressBetween(currentTime, word.startTime, word.duration) * 100;
    const style = { "--word-progress": `${progress}%` } as CSSProperties;
    return <span key={`${word.startTime}-${wordIndex}`} className="lyric-word" style={style}><span className="lyric-word-base">{word.text}</span><span className="lyric-word-highlight" aria-hidden="true">{word.text}</span></span>;
  }) : line.text}</p>;
}

const usableLyric = (value: string | undefined) => Boolean(value?.trim()) && !["loading", "not available", "歌词加载中..."].includes(value!.trim().toLowerCase());

export default function Music() {
  const audio = useRef<HTMLAudioElement>(null);
  const lyricsPanel = useRef<HTMLDivElement>(null);
  const resolvingTrack = useRef<string | null>(null);
  const lyricsTrackId = useRef<string | null>(null);
  const shouldPlay = useRef(false);
  const failedSources = useRef(new Set<string>());
  const previousVolume = useRef(useMainStore.getState().musicVolume || .3);
  const volumeFrame = useRef<number | null>(null);
  const pendingVolume = useRef(useMainStore.getState().musicVolume || .3);
  const hasLocalPlayerPreferences = useRef<boolean | null>(null);
  if (hasLocalPlayerPreferences.current === null) hasLocalPlayerPreferences.current = loadPlayerPreferences() !== null;

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [sources, setSources] = useState<Record<string, PlaybackSource>>({});
  const [index, setIndex] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [volume, setVolume] = useState(() => useMainStore.getState().musicVolume ?? 0.3);
  const [muted, setMuted] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const musicConfig = useSiteContentStore((state) => state.snapshot.sections.music);
  const musicRevision = useSiteContentStore((state) => state.snapshot.sectionRevisions.music);
  const preferences = useSiteContentStore((state) => state.snapshot.sections.preferences);
  const status = useMainStore((state) => state.playerStatus);
  const currentTime = useMainStore((state) => state.playerCurrentTime);
  const duration = useMainStore((state) => state.playerDuration);
  const canPlay = useMainStore((state) => state.playerCanplay);
  const ready = useMainStore((state) => state.musicIsOk);
  const error = useMainStore((state) => state.playerError);
  const footerShow = useMainStore((state) => state.footerPlayerShow);
  const queueOpen = useMainStore((state) => state.musicBoxOpenState);
  const order = useMainStore((state) => state.playerOrder);
  const shortcuts = preferences.playerKeyboardShortcuts;
  const autoplay = preferences.playerAutoplay;
  const patch = useMainStore((state) => state.patch);
  const setStatus = useMainStore((state) => state.setPlayerStatus);
  const current = playlist[index] ?? null;
  const currentSource = current ? sources[current.id] : undefined;
  const playbackUrl = currentSource?.url;
  const playing = status === "playing";
  const loading = status === "loading";
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

  const persistPlayerPreferences = useCallback((next: Partial<Pick<MainState, "musicVolume" | "playerOrder">>) => {
    const state = useMainStore.getState();
    savePlayerPreferences({
      musicVolume: next.musicVolume ?? state.musicVolume,
      playerOrder: next.playerOrder ?? state.playerOrder,
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
    shouldPlay.current = false;
    failedSources.current.clear();
    setPlaylist([]); setSources({}); setIndex(0); setLyrics([]);
    patch({ playerStatus: "loading", musicIsOk: false, playerError: null, playerCurrentTime: 0, playerDuration: 0 });
    void getPlayerList(musicRevision).then((tracks) => {
      if (!tracks.length) throw new Error("播放列表为空");
      if (!alive) return;
      shouldPlay.current = autoplay;
      setIndex(0);
      setPlaylist(tracks);
      patch({ musicIsOk: true, playerStatus: "ready" });
    }).catch((reason: unknown) => {
      if (!alive) return;
      patch({ playerError: reason instanceof Error ? reason.message : "播放器加载失败", playerStatus: "error", musicIsOk: false });
      const retryable = !(reason instanceof ApiClientError) || reason.status >= 500;
      if (retryable && navigator.onLine) retryTimer = window.setTimeout(() => setReloadToken((value) => value + 1), 30000);
    });
    return () => {
      alive = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [autoplay, musicConfig.id, musicConfig.server, musicConfig.type, musicRevision, patch, reloadToken]);

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
    if (resolvingTrack.current === track.id) return;
    resolvingTrack.current = track.id;
    let source: PlaybackSource = { url: track.url, source: "original" };
    if (musicConfig.server === "netease" && /^\d{1,20}$/.test(track.id)) {
      try {
        source = { url: await resolveNeteasePlaybackUrl(track.id), source: "chksz" };
      } catch {
        // 解析服务不可用时使用歌单原始地址。
      }
    }
    setSources((currentSources) => ({ ...currentSources, [track.id]: source }));
    if (resolvingTrack.current === track.id) resolvingTrack.current = null;
  }, [musicConfig.server]);

  useEffect(() => {
    if (!current || currentSource || !shouldPlay.current) return;
    void prepareTrackSource(current);
  }, [current, currentSource, prepareTrackSource]);

  useEffect(() => {
    if (!playbackUrl || !audio.current) return;
    audio.current.load();
  }, [playbackUrl]);

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
    if ((!playing && !fullscreen) || lyricsTrackId.current === current.id) return () => controller.abort();
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
  }, [current, fullscreen, musicConfig.server, playing]);

  useEffect(() => {
    const line = activeLyric >= 0 ? lyrics[activeLyric]?.text : undefined;
    const fallback = `${current?.name || "未知歌曲"} · ${current?.artist || "未知歌手"}`;
    patch({ playerLyric: usableLyric(line) ? line!.replace(/&nbsp;/g, " ") : fallback });
  }, [activeLyric, current?.artist, current?.name, lyrics, patch]);

  useEffect(() => {
    if (!fullscreen || activeLyric < 0) return;

    const panel = lyricsPanel.current;
    const activeLine = panel?.querySelector<HTMLElement>(".lyric-line.is-active");
    if (!panel || !activeLine) return;

    const panelRect = panel.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const targetTop = panel.scrollTop
      + lineRect.top
      - panelRect.top
      - (panel.clientHeight - lineRect.height) / 2;

    panel.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  }, [activeLyric, fullscreen]);

  const play = useCallback(async () => {
    const media = audio.current;
    if (!media || !ready || !current) return;
    shouldPlay.current = true;
    if (!playbackUrl) {
      setStatus("loading");
      void prepareTrackSource(current);
      return;
    }
    try {
      await media.play();
    } catch {
      shouldPlay.current = false;
      setStatus("paused");
    }
  }, [current, playbackUrl, prepareTrackSource, ready, setStatus]);
  const pause = useCallback(() => {
    shouldPlay.current = false;
    audio.current?.pause();
  }, []);
  const toggle = useCallback(() => {
    if (audio.current?.paused) void play();
    else pause();
  }, [pause, play]);
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
    shouldPlay.current = start;
    patch({ playerCurrentTime: 0, playerDuration: 0, playerCanplay: false, playerStatus: "loading", playerError: null });
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
    const nextTrack = playlist[nextIndex];
    if (!nextTrack || nextIndex === index) return;
    select(nextIndex, true);
  }, [index, playlist, select]);
  const openPlaylist = useCallback(() => patch({ musicBoxOpenState: true }), [patch]);

  const handleLoadStart = useCallback(() => {
    patch({ playerCanplay: false });
    if (useMainStore.getState().musicIsOk) setStatus("loading");
  }, [patch, setStatus]);
  const handleCanPlay = useCallback(() => {
    patch({ playerCanplay: true });
    failedSources.current.delete(current ? `${current.id}:${currentSource?.source || "original"}` : "");
    if (shouldPlay.current) void play();
    else {
      const state = useMainStore.getState();
      setStatus(state.playerHasStarted ? "paused" : "ready");
    }
  }, [current, currentSource?.source, patch, play, setStatus]);
  const handlePlay = useCallback(() => {
    shouldPlay.current = true;
    setStatus("playing");
  }, [setStatus]);
  const handlePlaying = useCallback(() => {
    shouldPlay.current = true;
    patch({ playerCanplay: true });
    setStatus("playing");
  }, [patch, setStatus]);
  const handlePause = useCallback(() => {
    const state = useMainStore.getState();
    if (state.playerStatus === "error" || (state.playerStatus === "loading" && shouldPlay.current)) return;
    setStatus(state.playerHasStarted ? "paused" : "ready");
  }, [setStatus]);
  const handleWaiting = useCallback(() => {
    patch({ playerCanplay: false });
    setStatus("loading");
  }, [patch, setStatus]);
  const handlePlaybackError = useCallback(() => {
    const track = playlist[index];
    if (!track || !currentSource || resolvingTrack.current === track.id) return;
    failedSources.current.add(`${track.id}:${currentSource.source}`);
    const selectedSource = sources[track.id];
    const resumeWith = (url: string, source: PlaybackSource["source"]) => {
      const shouldResume = shouldPlay.current || Boolean(audio.current && !audio.current.paused && !audio.current.ended);
      shouldPlay.current = shouldResume;
      patch({ playerError: null, playerStatus: "loading", playerCanplay: false });
      setSources((currentSources) => ({ ...currentSources, [track.id]: { url, source } }));
    };
    if (selectedSource?.source === "chksz" && !failedSources.current.has(`${track.id}:original`)) {
      resumeWith(track.url, "original");
      return;
    }
    if (selectedSource?.source === "original" && musicConfig.server === "netease" && /^\d{1,20}$/.test(track.id) && !failedSources.current.has(`${track.id}:chksz`)) {
      resolvingTrack.current = track.id;
      patch({ playerError: null, playerStatus: "loading", playerCanplay: false });
      void resolveNeteasePlaybackUrl(track.id).then((url) => resumeWith(url, "chksz")).catch(() => {
        failedSources.current.add(`${track.id}:chksz`);
        patch({ playerError: "当前歌曲加载失败", playerStatus: "error", playerCanplay: false });
      }).finally(() => { resolvingTrack.current = null; });
      return;
    }
    patch({ playerError: "当前歌曲加载失败", playerStatus: "error", playerCanplay: false });
  }, [currentSource, index, musicConfig.server, patch, playlist, sources]);
  const handleEnded = useCallback(() => {
    if (order === "single") {
      seek(0);
      void play();
      return;
    }
    select(pickNext(1), true);
  }, [order, pickNext, play, seek, select]);

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
        else if (fullscreen) setFullscreen(false);
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
    if (!media) return;
    const previousTime = useMainStore.getState().playerCurrentTime;
    const nextTime = Number.isFinite(media.currentTime) ? media.currentTime : 0;
    const playbackAdvanced = !media.paused && !media.ended && nextTime > previousTime;
    patch({
      playerCurrentTime: nextTime,
      playerDuration: Number.isFinite(media.duration) ? media.duration : 0,
      ...(playbackAdvanced ? { playerCanplay: true, playerStatus: "playing" as const } : {}),
    });
  }, [patch]);
  const handleLoadedMetadata = useCallback(() => {
    const media = audio.current;
    if (media) patch({ playerDuration: Number.isFinite(media.duration) ? media.duration : 0 });
  }, [patch]);

  const volumeIcon = effectiveVolume === 0 ? <VolumeMute theme="filled" size="23" fill="currentColor" /> : effectiveVolume < .7 ? <VolumeSmall theme="filled" size="23" fill="currentColor" /> : <VolumeNotice theme="filled" size="23" fill="currentColor" />;
  const cycleMode = () => {
    const next = modes[(modes.findIndex((mode) => mode.value === order) + 1) % modes.length]!.value;
    patch({ playerOrder: next });
    persistPlayerPreferences({ playerOrder: next });
  };
  const ModeIcon = currentMode.icon;

  const queue = queueOpen ? <div className="queue-layer" onClick={() => patch({ musicBoxOpenState: false })}>
    <aside className="queue-panel" role="dialog" aria-modal="true" aria-label="播放列表" onClick={(event) => event.stopPropagation()}>
      <header><h2>播放列表</h2><button type="button" aria-label="关闭播放列表" onClick={() => patch({ musicBoxOpenState: false })}><Close theme="outline" size="24" fill="currentColor" /></button></header>
      <div className="queue-content"><section className="queue-section">
        <h3>全部歌曲 <span className="queue-count">{playlist.length} 首</span></h3>
        {playlist.length ? <div className="queue-tracks">{playlist.map((track, trackIndex) => {
          const isCurrent = trackIndex === index;
          return <button key={`${trackIndex}-${track.id}`} type="button" className={`queue-track${isCurrent ? " is-current" : ""}`} aria-current={isCurrent ? "true" : undefined} aria-label={isCurrent ? playing ? `暂停 ${track.name}` : `播放 ${track.name}` : `播放 ${track.name}`} onClick={isCurrent ? toggle : () => selectFromQueue(trackIndex)}><QueueTrackCover track={track} playing={isCurrent && playing} /><span className="queue-track-info"><strong>{track.name}</strong><small>{track.artist || "未知歌手"}</small></span>{isCurrent && playing && <span className="playing-bars" aria-label="正在播放"><i /><i /><i /></span>}</button>;
        })}</div> : <p className="empty-queue">播放列表为空</p>}
      </section></div>
    </aside>
  </div> : null;

  const full = fullscreen ? <section className="fullscreen-player" role="dialog" aria-modal="true" aria-label="全屏音乐播放器"><div className="fullscreen-background" style={backgroundStyle} aria-hidden="true" /><button type="button" className="exit-fullscreen" aria-label="退出全屏播放器" onClick={() => setFullscreen(false)}><OffScreen theme="outline" size="26" fill="currentColor" /></button><div className="fullscreen-content"><header className="fullscreen-header"><h1>{displayName}</h1><p><span>歌手：{current?.artist || "未知歌手"}</span><span>来源：{musicServerLabels[musicConfig.server]}</span></p></header><div className="fullscreen-main"><div className="cover-area">{current?.cover ? <img src={current.cover} alt={`${displayName}封面`} /> : <div className="cover-placeholder"><MusicOne theme="outline" size="72" fill="currentColor" /></div>}</div><div ref={lyricsPanel} className="lyrics-panel" aria-label="歌词">{lyrics.length ? lyrics.map((line, lineIndex) => <KaraokeLyricLine key={`${line.startTime}-${lineIndex}`} line={line} lineIndex={lineIndex} active={activeLyric === lineIndex} currentTime={currentTime} />) : <div className="lyrics-placeholder"><strong>{current?.artist || "未知歌手"}</strong><span>歌词数据将在播放后显示</span></div>}</div></div></div><footer className="fullscreen-controls"><button type="button" aria-label="上一首" disabled={!ready} onClick={() => change(-1)}><GoStart theme="filled" size="25" fill="currentColor" /></button><button type="button" className="fullscreen-play" aria-label={playing ? "暂停" : "播放"} disabled={!ready} onClick={toggle}>{playing ? <Pause theme="filled" size="28" fill="currentColor" /> : <PlayOne theme="filled" size="28" fill="currentColor" />}</button><button type="button" aria-label="下一首" disabled={!ready} onClick={() => change(1)}><GoEnd theme="filled" size="25" fill="currentColor" /></button><PlayerSeekBar className="fullscreen-seek" currentTime={currentTime} duration={duration} loading={loading} showTime onSeek={seek} /><div className="volume-control fullscreen-volume"><button type="button" aria-label={effectiveVolume === 0 ? "恢复音量" : "静音"} onClick={toggleMute}>{volumeIcon}</button><div className="volume-popover"><VolumeSlider value={volume} onPreview={previewVolume} onCommit={saveVolume} /></div></div><button type="button" aria-label={`播放模式：${currentMode.label}`} title={`播放模式：${currentMode.label}`} onClick={cycleMode}><ModeIcon theme="outline" size="23" fill="currentColor" /></button><button type="button" aria-label="打开播放列表" onClick={openPlaylist}><MusicList theme="outline" size="24" fill="currentColor" /></button></footer></section> : null;

  return <><section className="music" aria-label="音乐播放器"><audio ref={audio} data-music-engine src={playbackUrl} preload="metadata" onLoadStart={handleLoadStart} onLoadedMetadata={handleLoadedMetadata} onCanPlay={handleCanPlay} onTimeUpdate={handleTimeUpdate} onDurationChange={handleTimeUpdate} onPlay={handlePlay} onPlaying={handlePlaying} onPause={handlePause} onWaiting={handleWaiting} onEnded={handleEnded} onError={handlePlaybackError} /><button type="button" className={`footer-player-button${footerShow ? " is-active" : ""}`} aria-pressed={footerShow} aria-label={footerShow ? "隐藏底栏歌词和进度" : "显示底栏歌词和进度"} onClick={() => patch({ footerPlayerShow: !footerShow })}><TextMessage theme="outline" size="20" strokeWidth={4} fill="currentColor" /></button><button type="button" className="fullscreen-button" aria-label="打开全屏播放器" onClick={() => setFullscreen(true)}><FullScreen theme="filled" size="20" strokeWidth={5} fill="currentColor" /></button>{current ? <CompactPlayerSurface onOpen={openPlaylist} onToggle={toggle} onChange={change} onSeek={seek} onToggleMute={toggleMute} onPreviewVolume={previewVolume} onSaveVolume={saveVolume} displayName={displayName} artist={current.artist} currentTime={currentTime} duration={duration} volume={volume} effectiveVolume={effectiveVolume} volumeIcon={volumeIcon} playing={playing} ready={ready} loading={loading} hideProgress={footerActive} /> : <div className="player-loading" aria-live="polite">{error || "播放器加载中…"}</div>}</section>{typeof document !== "undefined" && createPortal(<>{full}{queue}</>, document.body)}</>;
}
