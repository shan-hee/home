import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Reload } from "@icon-park/react";
import { useMainStore } from "@/store";
import "@/components/ProgressBar.scss";

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, "0")}`;
};

export default function ProgressBar() {
  const currentTime = useMainStore((state) => state.playerCurrentTime);
  const rawDuration = useMainStore((state) => state.playerDuration);
  const canPlay = useMainStore((state) => state.playerCanplay);
  const status = useMainStore((state) => state.playerStatus);
  const patch = useMainStore((state) => state.patch);
  const track = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(0);
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
  const actual = duration ? Math.min(duration, Math.max(0, currentTime)) : 0;
  const displayed = dragging ? preview : actual;
  const progress = duration ? displayed / duration * 100 : 0;
  const ariaText = useMemo(() => `${formatTime(displayed)} / ${formatTime(duration)}`, [displayed, duration]);
  const fromClientX = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || !duration) return preview;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration;
  };
  const commit = (value: number) => {
    const next = Math.min(duration, Math.max(0, value));
    const audio = document.querySelector<HTMLAudioElement>("audio[data-music-engine]");
    if (audio) audio.currentTime = next;
    patch({ playerCurrentTime: next });
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!duration || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); pointer.current = event.pointerId; setDragging(true); setPreview(fromClientX(event.clientX));
    track.current?.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || pointer.current !== event.pointerId) return;
    event.preventDefault(); setPreview(fromClientX(event.clientX));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, shouldCommit: boolean) => {
    if (!dragging || pointer.current !== event.pointerId) return;
    if (shouldCommit) commit(fromClientX(event.clientX)); else setPreview(actual);
    if (track.current?.hasPointerCapture(event.pointerId)) track.current.releasePointerCapture(event.pointerId);
    pointer.current = null; setDragging(false);
  };
  const keydown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!duration) return;
    const values: Record<string, number> = { ArrowLeft: actual - 5, ArrowDown: actual - 5, ArrowRight: actual + 5, ArrowUp: actual + 5, Home: 0, End: duration };
    if (!(event.key in values)) return;
    event.preventDefault(); commit(values[event.key]!);
  };
  return (
    <div ref={track} className={`progress-bar${dragging ? " dragging" : ""}`} role="slider" tabIndex={0}
      aria-label="播放进度" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(displayed)} aria-valuetext={ariaText}
      onPointerDown={down} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)} onKeyDown={keydown}>
      <div className="track-line">
        <div className="progress" style={{ width: `${progress}%` }} />
        <span className="progress-thumb" style={{ left: `${progress}%` }} aria-hidden="true" />
        {!canPlay && status !== "error" && <Reload size={20} className="reload-circle" style={{ left: `${Math.min(99, Math.max(1, progress))}%` }} aria-hidden="true" />}
      </div>
    </div>
  );
}
