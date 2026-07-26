import { useEffect } from "react";

const DRAGGING_CLASS = "is-sort-dragging";

export default function useDragCursorLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    document.documentElement.classList.add(DRAGGING_CLASS);
    return () => document.documentElement.classList.remove(DRAGGING_CLASS);
  }, [active]);
}
