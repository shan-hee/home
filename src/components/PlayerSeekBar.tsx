import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import "@/components/PlayerSeekBar.scss";

interface Props {
  currentTime: number;
  duration: number;
  showTime?: boolean;
  label?: string;
  className?: string;
  onSeek: (time: number) => void;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, "0")}`;
};

export default function PlayerSeekBar({ currentTime, duration, showTime = false, label = "播放进度", className = "", onSeek }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(0);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeTime = safeDuration ? Math.min(safeDuration, Math.max(0, currentTime)) : 0;
  const displayed = dragging ? preview : safeTime;
  const progress = safeDuration ? displayed / safeDuration * 100 : 0;
  const ariaText = useMemo(() => `${formatTime(displayed)} / ${formatTime(safeDuration)}`, [displayed, safeDuration]);
  const fromX = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || !safeDuration) return preview;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * safeDuration;
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!safeDuration || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); pointer.current = event.pointerId; setDragging(true); setPreview(fromX(event.clientX));
    track.current?.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || pointer.current !== event.pointerId) return;
    event.preventDefault(); setPreview(fromX(event.clientX));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!dragging || pointer.current !== event.pointerId) return;
    const next = fromX(event.clientX);
    if (commit) onSeek(next); else setPreview(safeTime);
    if (track.current?.hasPointerCapture(event.pointerId)) track.current.releasePointerCapture(event.pointerId);
    pointer.current = null; setDragging(false);
  };
  const keydown = (event: KeyboardEvent<HTMLDivElement>) => {
    const values: Record<string, number> = { ArrowLeft: safeTime - 5, ArrowDown: safeTime - 5, ArrowRight: safeTime + 5, ArrowUp: safeTime + 5, Home: 0, End: safeDuration };
    if (!safeDuration || !(event.key in values)) return;
    event.preventDefault(); onSeek(Math.min(safeDuration, Math.max(0, values[event.key]!)));
  };
  return <div className={`player-seek${showTime ? " with-time" : ""}${className ? ` ${className}` : ""}`}>
    {showTime && <span className="time current-time">{formatTime(displayed)}</span>}
    <div ref={track} className={`seek-track${dragging ? " dragging" : ""}${safeDuration ? "" : " disabled"}`} role="slider" tabIndex={safeDuration ? 0 : -1} aria-label={label} aria-disabled={!safeDuration} aria-valuemin={0} aria-valuemax={safeDuration} aria-valuenow={Math.round(displayed)} aria-valuetext={ariaText} onPointerDown={down} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)} onKeyDown={keydown}>
      <div className="seek-runway"><div className="seek-progress" style={{ width: `${progress}%` }} /><span className="seek-thumb" style={{ left: `${progress}%` }} aria-hidden="true" /></div>
    </div>
    {showTime && <span className="time duration-time">{formatTime(safeDuration)}</span>}
  </div>;
}
