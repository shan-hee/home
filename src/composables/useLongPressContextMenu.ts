import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

const LONG_PRESS_DELAY = 500;
const MOVE_TOLERANCE = 8;

export default function useLongPressContextMenu(onOpen: (clientX: number, clientY: number) => void, disabled = false) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);

  const cancel = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (disabled || event.pointerType === "mouse" || event.button !== 0) return;
    cancel();
    startRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      suppressClickRef.current = true;
      onOpen(startRef.current.x, startRef.current.y);
    }, LONG_PRESS_DELAY);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (Math.hypot(event.clientX - startRef.current.x, event.clientY - startRef.current.y) > MOVE_TOLERANCE) cancel();
  };

  const onClickCapture = (event: ReactMouseEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel, onClickCapture };
}
