import { PointerSensor } from "@dnd-kit/core";
import type { PointerSensorOptions, PointerSensorProps } from "@dnd-kit/core";

const CLICK_GUARD_TIMEOUT = 100;

export const NAVIGATION_SAFE_POINTER_SENSOR_OPTIONS = {
  activationConstraint: { distance: 8 },
} satisfies PointerSensorOptions;

export default class NavigationSafePointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    let armed = false;
    let releaseTimer: number | null = null;

    const clearReleaseTimer = () => {
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      releaseTimer = null;
    };

    const disarm = () => {
      clearReleaseTimer();
      if (!armed) return;
      armed = false;
      document.removeEventListener("click", preventDraggedLinkClick, true);
    };

    const preventDraggedLinkClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      disarm();
    };

    const arm = () => {
      clearReleaseTimer();
      if (armed) return;
      armed = true;
      document.addEventListener("click", preventDraggedLinkClick, true);
    };

    const release = () => {
      clearReleaseTimer();
      releaseTimer = window.setTimeout(disarm, CLICK_GUARD_TIMEOUT);
    };

    super({
      ...props,
      onStart(coordinates) {
        arm();
        props.onStart(coordinates);
      },
      onEnd() {
        release();
        props.onEnd();
      },
      onCancel() {
        release();
        props.onCancel();
      },
    });
  }
}
