import { Close, FullScreen, GoEnd, GoStart, LoopOnce, MusicList, MusicOne, OffScreen, Pause, PlayCycle, PlayOne, Shuffle, TextMessage, VolumeMute, VolumeNotice, VolumeSmall } from "@icon-park/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getPlayerList } from "@/api";
import type { PlaylistItem } from "@/api";
import PlayerSeekBar from "@/components/PlayerSeekBar";
import VolumeSlider from "@/components/VolumeSlider";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import type { MainState } from "@/typings/store";
import "@/components/Music.scss";

type LyricLine = [number, string];
const modes: Array<{ value: MainState["playerOrder"]; label: string; icon: typeof PlayCycle }> = [
  { value: "list", label: "列表循环", icon: PlayCycle },
  { value: "single", label: "单曲循环", icon: LoopOnce },
  { value: "shuffle", label: "随机播放", icon: Shuffle },
];

const parseLrc = (source: string): LyricLine[] => {
  const result: LyricLine[] = [];
  for (const line of source.split(/\r?\n/)) {
    const text = line.replace(/\[(\d{1,3}):([\d.]+)\]/g, "").trim();
    for (const match of line.matchAll(/\[(\d{1,3}):([\d.]+)\]/g)) {
      result.push([Number(match[1]) * 60 + Number(match[2]), text]);
    }
  }
  return result.sort((a, b) => a[0] - b[0]);
};

const usableLyric = (value: string | undefined) => Boolean(value?.trim()) && !["loading", "not available", "歌词加载中..."].includes(value!.trim().toLowerCase());

export default function Music() {
  const audio = useRef<HTMLAudioElement>(null);
  const lyricsPanel = useRef<HTMLDivElement>(null);
  const shouldPlay = useRef(false);
  const previousVolume = useRef(useMainStore.getState().musicVolume || .3);
  const volumeFrame = useRef<number | null>(null);
  const pendingVolume = useRef(0.3);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [index, setIndex] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [volume, setVolume] = useState(() => useMainStore.getState().musicVolume ?? 0.3);
  const musicConfig = useSiteContentStore((state) => state.snapshot.sections.music);
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
  const storeVolume = useMainStore((state) => state.musicVolume);
  const shortcuts = preferences.playerKeyboardShortcuts;
  const autoplay = preferences.playerAutoplay;
  const patch = useMainStore((state) => state.patch);
  const setStatus = useMainStore((state) => state.setPlayerStatus);
  const setCanPlay = useMainStore((state) => state.setPlayerCanplay);
  const setPlayerData = useMainStore((state) => state.setPlayerData);
  const setLyric = useMainStore((state) => state.setPlayerLyric);
  const current = playlist[index] ?? null;
  const playing = status === "playing";
  const loading = !canPlay && status !== "error";
  const displayName = current?.name || useMainStore.getState().playerTitle || error || "播放器准备中";
  const currentMode = modes.find((mode) => mode.value === order) ?? modes[0]!;
  const queued = useMemo(() => playlist.map((track, trackIndex) => ({ track, index: trackIndex })).filter((item) => item.index !== index), [index, playlist]);
  const activeLyric = useMemo(() => {
    let active = -1;
    for (let lineIndex = 0; lineIndex < lyrics.length; lineIndex += 1) {
      if (lyrics[lineIndex]![0] <= currentTime + .2) active = lineIndex; else break;
    }
    return active;
  }, [currentTime, lyrics]);
  const backgroundStyle = useMemo<CSSProperties>(() => current?.cover ? { backgroundImage: `url(${JSON.stringify(current.cover)})` } : {}, [current?.cover]);

  useEffect(() => {
    patch({ musicVolume: preferences.playerDefaultVolume, playerOrder: preferences.playerDefaultOrder });
    setVolume(preferences.playerDefaultVolume);
  }, [patch, preferences.playerDefaultOrder, preferences.playerDefaultVolume]);

  const applyMetadata = useCallback((track: PlaylistItem) => {
    setPlayerData(track.name, track.artist, track.album);
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.name, artist: track.artist, album: track.album, artwork: track.cover ? [{ src: track.cover }] : [] });
  }, [setPlayerData]);

  const play = useCallback(async () => {
    if (!audio.current || !ready) return;
    try { await audio.current.play(); } catch { setStatus("paused"); }
  }, [ready, setStatus]);
  const pause = useCallback(() => audio.current?.pause(), []);
  const toggle = useCallback(() => { if (audio.current?.paused) void play(); else pause(); }, [pause, play]);

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
    if (!playlist[nextIndex]) return;
    if (nextIndex === index && audio.current) {
      audio.current.currentTime = 0;
      patch({ playerCurrentTime: 0, musicBoxOpenState: false });
      if (start) void audio.current.play();
      return;
    }
    shouldPlay.current = start;
    patch({ playerCurrentTime: 0, playerDuration: 0, playerCanplay: false, playerStatus: "loading", playerError: null });
    setIndex(nextIndex);
    patch({ musicBoxOpenState: false });
  }, [index, patch, playlist]);
  const change = useCallback((direction: -1 | 1) => select(pickNext(direction)), [pickNext, select]);
  const seek = useCallback((time: number) => {
    if (!audio.current || !Number.isFinite(time)) return;
    audio.current.currentTime = time; patch({ playerCurrentTime: time });
  }, [patch]);

  useEffect(() => {
    let alive = true;
    patch({ playerStatus: "loading", musicIsOk: false, playerError: null });
    void getPlayerList().then((tracks) => {
      if (!alive) return;
      if (!tracks.length) throw new Error("播放列表为空");
      setPlaylist(tracks); setIndex(0); patch({ musicIsOk: true, playerStatus: "ready" });
      shouldPlay.current = autoplay;
    }).catch((reason: unknown) => {
      if (!alive) return;
      patch({ playerError: reason instanceof Error ? reason.message : "播放器加载失败", playerStatus: "error", musicIsOk: false });
    });
    return () => { alive = false; };
  }, [autoplay, musicConfig.id, musicConfig.server, musicConfig.type, patch]);

  useEffect(() => {
    if (!current) return;
    applyMetadata(current); setLyric(`${current.name} · ${current.artist || "未知歌手"}`);
    audio.current?.load();
  }, [applyMetadata, current, setLyric]);

  useEffect(() => {
    const controller = new AbortController();
    if (!current?.lrc) { setLyrics([]); return () => controller.abort(); }
    const source = current.lrc.trim();
    const resolve = async () => source.includes("[") ? source : fetch(source, { signal: controller.signal }).then((response) => response.ok ? response.text() : "");
    void resolve().then((text) => { if (!controller.signal.aborted) setLyrics(parseLrc(text)); }).catch(() => { if (!controller.signal.aborted) setLyrics([]); });
    return () => controller.abort();
  }, [current?.lrc]);

  useEffect(() => {
    const line = activeLyric >= 0 ? lyrics[activeLyric]?.[1] : undefined;
    const fallback = `${current?.name || "未知歌曲"} · ${current?.artist || "未知歌手"}`;
    setLyric(usableLyric(line) ? line!.replace(/&nbsp;/g, " ") : fallback);
  }, [activeLyric, current?.artist, current?.name, lyrics, setLyric]);

  useEffect(() => {
    if (!fullscreen || activeLyric < 0) return;
    lyricsPanel.current?.querySelector<HTMLElement>(".lyric-line.is-active")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLyric, fullscreen]);

  useEffect(() => { if (storeVolume !== volume) { setVolume(storeVolume); if (audio.current) audio.current.volume = storeVolume; } }, [storeVolume, volume]);
  useEffect(() => { pendingVolume.current = volume; if (audio.current) audio.current.volume = volume; }, [volume]);

  const previewVolume = (value: number) => {
    pendingVolume.current = Math.min(1, Math.max(0, value));
    if (volumeFrame.current !== null) return;
    volumeFrame.current = requestAnimationFrame(() => { if (audio.current) audio.current.volume = pendingVolume.current; volumeFrame.current = null; });
  };
  const saveVolume = (value: number) => { const next = Math.min(1, Math.max(0, value)); setVolume(next); patch({ musicVolume: next }); };
  const toggleMute = () => {
    if (volume > 0) { previousVolume.current = volume; saveVolume(0); }
    else saveVolume(previousVolume.current || .3);
  };

  useEffect(() => {
    const media = navigator.mediaSession;
    if (!media) return;
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = { play, pause, nexttrack: () => change(1), previoustrack: () => change(-1), seekbackward: (details) => seek(Math.max(0, (audio.current?.currentTime || 0) - (details.seekOffset || 5))), seekforward: (details) => seek(Math.min(audio.current?.duration || Infinity, (audio.current?.currentTime || 0) + (details.seekOffset || 5))) };
    for (const [action, handler] of Object.entries(handlers)) { try { media.setActionHandler(action as MediaSessionAction, handler || null); } catch { /* 浏览器不支持该动作。 */ } }
    return () => { for (const action of Object.keys(handlers)) { try { media.setActionHandler(action as MediaSessionAction, null); } catch { /* 无需处理。 */ } } };
  }, [change, pause, play, seek]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (queueOpen) patch({ musicBoxOpenState: false }); else if (fullscreen) setFullscreen(false); return; }
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
  }, [change, fullscreen, patch, queueOpen, ready, shortcuts, toggle, volume]);

  useEffect(() => () => { if (volumeFrame.current !== null) cancelAnimationFrame(volumeFrame.current); }, []);

  const volumeIcon = volume === 0 ? <VolumeMute theme="filled" size="23" fill="currentColor" /> : volume < .7 ? <VolumeSmall theme="filled" size="23" fill="currentColor" /> : <VolumeNotice theme="filled" size="23" fill="currentColor" />;
  const footerActive = footerShow && playing;
  const cycleMode = () => patch({ playerOrder: modes[(modes.findIndex((mode) => mode.value === order) + 1) % modes.length]!.value });
  const ModeIcon = currentMode.icon;

  const queue = queueOpen ? <div className="queue-layer" onClick={() => patch({ musicBoxOpenState: false })}><aside className="queue-panel" role="dialog" aria-modal="true" aria-label="播放列表" onClick={(event) => event.stopPropagation()}><header><h2>队列</h2><button type="button" aria-label="关闭播放列表" onClick={() => patch({ musicBoxOpenState: false })}><Close theme="outline" size="24" fill="currentColor" /></button></header><div className="queue-content">{current && <section className="queue-section"><h3>当前播放</h3><button type="button" className="queue-track is-current" onClick={() => select(index)}>{current.cover ? <img src={current.cover} alt={`${current.name}封面`} /> : <span className="queue-cover-placeholder"><MusicOne theme="outline" size="24" /></span>}<span className="queue-track-info"><strong>{current.name}</strong><small>{current.artist || "未知歌手"}</small></span>{playing && <span className="playing-bars" aria-label="正在播放"><i /><i /><i /></span>}</button></section>}<section className="queue-section"><h3>播放队列</h3>{queued.length ? <div className="queue-tracks">{queued.map((item) => <button key={`${item.index}-${item.track.url}`} type="button" className="queue-track" onClick={() => select(item.index)}>{item.track.cover ? <img src={item.track.cover} alt={`${item.track.name}封面`} /> : <span className="queue-cover-placeholder"><MusicOne theme="outline" size="24" /></span>}<span className="queue-track-info"><strong>{item.track.name}</strong><small>{item.track.artist || "未知歌手"}</small></span></button>)}</div> : <p className="empty-queue">暂无其他歌曲</p>}</section></div></aside></div> : null;

  const full = fullscreen ? <section className="fullscreen-player" role="dialog" aria-modal="true" aria-label="全屏音乐播放器"><div className="fullscreen-background" style={backgroundStyle} aria-hidden="true" /><button type="button" className="exit-fullscreen" aria-label="退出全屏播放器" onClick={() => setFullscreen(false)}><OffScreen theme="outline" size="26" fill="currentColor" /></button><div className="fullscreen-content"><header className="fullscreen-header"><h1>{displayName}</h1><p><span>专辑：{current?.album || "暂无"}</span><span>歌手：{current?.artist || "未知歌手"}</span><span>来源：{musicConfig.server}</span></p><div className="content-tabs" aria-label="歌曲内容"><button type="button" className="is-active">歌词</button><button type="button" disabled>百科</button><button type="button" disabled>相似推荐</button></div></header><div className="fullscreen-main"><div className="cover-area">{current?.cover ? <img src={current.cover} alt={`${displayName}封面`} /> : <div className="cover-placeholder"><MusicOne theme="outline" size="72" fill="currentColor" /></div>}</div><div ref={lyricsPanel} className="lyrics-panel" aria-label="歌词">{lyrics.length ? lyrics.map((line, lineIndex) => <p key={`${line[0]}-${lineIndex}`} className={`lyric-line${activeLyric === lineIndex ? " is-active" : ""}`}>{line[1]}</p>) : <div className="lyrics-placeholder"><strong>{current?.artist || "未知歌手"}</strong><span>歌词数据将在播放后显示</span></div>}</div></div></div><footer className="fullscreen-controls"><button type="button" aria-label="上一首" disabled={!ready} onClick={() => change(-1)}><GoStart theme="filled" size="25" fill="currentColor" /></button><button type="button" className="fullscreen-play" aria-label={playing ? "暂停" : "播放"} disabled={!ready} onClick={toggle}>{playing ? <Pause theme="filled" size="28" fill="currentColor" /> : <PlayOne theme="filled" size="28" fill="currentColor" />}</button><button type="button" aria-label="下一首" disabled={!ready} onClick={() => change(1)}><GoEnd theme="filled" size="25" fill="currentColor" /></button><PlayerSeekBar className="fullscreen-seek" currentTime={currentTime} duration={duration} loading={loading} showTime onSeek={seek} /><div className="volume-control fullscreen-volume"><button type="button" aria-label={volume === 0 ? "恢复音量" : "静音"} onClick={toggleMute}>{volumeIcon}</button><div className="volume-popover"><VolumeSlider value={volume} onPreview={previewVolume} onCommit={saveVolume} /></div></div><button type="button" aria-label={`播放模式：${currentMode.label}`} title={`播放模式：${currentMode.label}`} onClick={cycleMode}><ModeIcon theme="outline" size="23" fill="currentColor" /></button><button type="button" aria-label="打开播放列表" onClick={() => patch({ musicBoxOpenState: true })}><MusicList theme="outline" size="24" fill="currentColor" /></button></footer></section> : null;

  return <><section className="music" aria-label="音乐播放器"><button type="button" className={`footer-player-button${footerShow ? " is-active" : ""}`} aria-pressed={footerShow} aria-label={footerShow ? "隐藏底栏歌词和进度" : "显示底栏歌词和进度"} onClick={() => patch({ footerPlayerShow: !footerShow })}><TextMessage theme="outline" size="20" strokeWidth={4} fill="currentColor" /></button><button type="button" className="fullscreen-button" aria-label="打开全屏播放器" onClick={() => setFullscreen(true)}><FullScreen theme="filled" size="20" strokeWidth={5} fill="currentColor" /></button><div className="compact-controls"><button type="button" aria-label="打开播放列表" onClick={() => patch({ musicBoxOpenState: true })}><MusicList theme="filled" size="24" strokeWidth={5} fill="currentColor" /></button><button type="button" aria-label="上一首" disabled={!ready} onClick={() => change(-1)}><GoStart theme="filled" size="27" strokeWidth={5} fill="currentColor" /></button><button type="button" className="play-button" aria-label={playing ? "暂停" : "播放"} disabled={!ready} onClick={toggle}>{playing ? <Pause theme="filled" size="34" strokeWidth={5} fill="currentColor" /> : <PlayOne theme="filled" size="34" strokeWidth={5} fill="currentColor" />}</button><button type="button" aria-label="下一首" disabled={!ready} onClick={() => change(1)}><GoEnd theme="filled" size="27" strokeWidth={5} fill="currentColor" /></button><div className="volume-control"><button type="button" aria-label={volume === 0 ? "恢复音量" : "静音"} onClick={toggleMute}>{volumeIcon}</button><div className="volume-popover" aria-label="音量调节"><VolumeSlider value={volume} onPreview={previewVolume} onCommit={saveVolume} /></div></div></div><div className="compact-meta"><span className="track-name">{displayName}</span>{current?.artist && <span className="track-artist">{current.artist}</span>}</div><div className={`compact-seek-shell${footerActive ? " is-hidden" : ""}`}><PlayerSeekBar className="compact-seek" currentTime={currentTime} duration={duration} loading={loading} onSeek={seek} /></div><audio ref={audio} data-music-engine preload="metadata" src={current?.url} onLoadStart={() => { setCanPlay(false); if (current) applyMetadata(current); }} onCanPlay={() => { setCanPlay(true); if (shouldPlay.current) { shouldPlay.current = false; void play(); } else if (!useMainStore.getState().playerHasStarted) setStatus("ready"); }} onPlay={() => setStatus("playing")} onPause={() => { if (useMainStore.getState().playerStatus !== "error") setStatus(useMainStore.getState().playerHasStarted ? "paused" : "ready"); }} onWaiting={() => setCanPlay(false)} onTimeUpdate={(event) => { const element = event.currentTarget; patch({ playerCurrentTime: Number.isFinite(element.currentTime) ? element.currentTime : 0, playerDuration: Number.isFinite(element.duration) ? element.duration : 0 }); }} onLoadedMetadata={(event) => patch({ playerDuration: Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0 })} onEnded={() => { if (order === "single" && audio.current) { audio.current.currentTime = 0; void play(); } else change(1); }} onError={() => patch({ playerError: "当前歌曲加载失败", playerStatus: "error", playerCanplay: false })} /></section>{typeof document !== "undefined" && createPortal(<>{full}{queue}</>, document.body)}</>;
}
