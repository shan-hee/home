import { useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import "@/components/VolumeSlider.scss";

interface Props { value: number; onPreview: (value: number) => void; onCommit: (value: number) => void }
const normalize = (value: number) => Math.min(1, Math.max(0, value));

export default function VolumeSlider({ value, onPreview, onCommit }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const percentText = useRef<HTMLSpanElement>(null);
  const current = useRef(normalize(value));
  const pointer = useRef<number | null>(null);
  const geometry = useRef({ top: 0, height: 0 });
  const render = (nextValue: number) => {
    current.current = normalize(nextValue);
    const percent = Math.round(current.current * 100);
    track.current?.style.setProperty("--volume-progress", `${current.current * 100}%`);
    track.current?.setAttribute("aria-valuenow", String(percent));
    track.current?.setAttribute("aria-valuetext", `${percent}%`);
    if (percentText.current) percentText.current.textContent = `${percent}%`;
  };
  const preview = (next: number) => { render(next); onPreview(current.current); };
  const fromY = (clientY: number) => {
    if (geometry.current.height <= 0) return;
    preview((geometry.current.top + geometry.current.height - clientY) / geometry.current.height);
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return;
    event.preventDefault(); geometry.current = { top: rect.top, height: rect.height }; pointer.current = event.pointerId;
    track.current?.focus({ preventScroll: true }); track.current?.classList.add("dragging"); track.current?.setPointerCapture(event.pointerId); fromY(event.clientY);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => { if (pointer.current === event.pointerId) { event.preventDefault(); fromY(event.clientY); } };
  const finish = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (pointer.current !== event.pointerId) return;
    if (commit) { fromY(event.clientY); onCommit(current.current); } else { render(value); onPreview(value); }
    if (track.current?.hasPointerCapture(event.pointerId)) track.current.releasePointerCapture(event.pointerId);
    track.current?.classList.remove("dragging"); pointer.current = null; geometry.current.height = 0;
  };
  const keydown = (event: KeyboardEvent<HTMLDivElement>) => {
    const values: Record<string, number> = { ArrowUp: current.current + .05, ArrowRight: current.current + .05, ArrowDown: current.current - .05, ArrowLeft: current.current - .05, Home: 0, End: 1 };
    if (!(event.key in values)) return;
    event.preventDefault(); preview(values[event.key]!); onCommit(current.current);
  };
  useEffect(() => { if (pointer.current === null) render(value); }, [value]);
  return <div className="volume-slider"><div ref={track} className="volume-track" role="slider" tabIndex={0} aria-label="音量" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} onPointerDown={down} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)} onKeyDown={keydown}><div className="volume-runway"><div className="volume-fill" /><span className="volume-thumb" aria-hidden="true" /></div></div><span ref={percentText} className="volume-percent">{Math.round(normalize(value) * 100)}%</span></div>;
}
