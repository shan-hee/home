const POINTER_MEDIA_QUERY = "(pointer: fine)";
const MOTION_MEDIA_QUERY = "(prefers-reduced-motion: no-preference)";
const CURSOR_OFFSET = 9;
const FOLLOW_SPEED = 0.35;
const STOP_THRESHOLD = 0.1;

class CursorController {
  private readonly pointerMedia = window.matchMedia(POINTER_MEDIA_QUERY);
  private readonly motionMedia = window.matchMedia(MOTION_MEDIA_QUERY);
  private cursor: HTMLDivElement | null = null;
  private frameId: number | null = null;
  private currentX = 0;
  private currentY = 0;
  private targetX = 0;
  private targetY = 0;
  private hasPosition = false;

  constructor() {
    this.pointerMedia.addEventListener("change", this.handleMediaChange);
    this.motionMedia.addEventListener("change", this.handleMediaChange);
    this.syncEnabledState();
  }

  destroy() {
    this.pointerMedia.removeEventListener("change", this.handleMediaChange);
    this.motionMedia.removeEventListener("change", this.handleMediaChange);
    this.disable();
  }

  private readonly handleMediaChange = () => {
    this.syncEnabledState();
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !this.cursor) return;

    this.targetX = event.clientX - CURSOR_OFFSET;
    this.targetY = event.clientY - CURSOR_OFFSET;
    this.cursor.classList.remove("hidden");

    if (!this.hasPosition) {
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      this.hasPosition = true;
      this.updatePosition();
      return;
    }

    this.scheduleFrame();
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      this.cursor?.classList.add("active");
    }
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      this.cursor?.classList.remove("active");
    }
  };

  private readonly hide = () => {
    this.cursor?.classList.add("hidden");
    this.cursor?.classList.remove("active");
  };

  private readonly render = () => {
    this.frameId = null;

    const distanceX = this.targetX - this.currentX;
    const distanceY = this.targetY - this.currentY;

    if (Math.abs(distanceX) <= STOP_THRESHOLD && Math.abs(distanceY) <= STOP_THRESHOLD) {
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      this.updatePosition();
      return;
    }

    this.currentX += distanceX * FOLLOW_SPEED;
    this.currentY += distanceY * FOLLOW_SPEED;
    this.updatePosition();
    this.scheduleFrame();
  };

  private syncEnabledState() {
    if (this.pointerMedia.matches && this.motionMedia.matches) {
      this.enable();
    } else {
      this.disable();
    }
  }

  private enable() {
    if (this.cursor) return;

    document.getElementById("cursor")?.remove();

    this.cursor = document.createElement("div");
    this.cursor.id = "cursor";
    this.cursor.classList.add("hidden");
    this.cursor.setAttribute("aria-hidden", "true");
    document.body.append(this.cursor);
    document.documentElement.classList.add("has-custom-cursor");

    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    window.addEventListener("pointerup", this.handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", this.handlePointerUp, { passive: true });
    window.addEventListener("blur", this.hide);
    document.documentElement.addEventListener("pointerleave", this.hide);
  }

  private disable() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    window.removeEventListener("blur", this.hide);
    document.documentElement.removeEventListener("pointerleave", this.hide);

    this.cursor?.remove();
    this.cursor = null;
    this.hasPosition = false;
    document.documentElement.classList.remove("has-custom-cursor");
  }

  private scheduleFrame() {
    if (this.frameId === null) {
      this.frameId = requestAnimationFrame(this.render);
    }
  }

  private updatePosition() {
    if (!this.cursor) return;
    this.cursor.style.transform = `translate3d(${this.currentX}px, ${this.currentY}px, 0)`;
  }
}

let mainCursor: CursorController | null = null;

const cursorInit = () => {
  mainCursor?.destroy();

  const controller = new CursorController();
  mainCursor = controller;

  return () => {
    if (mainCursor === controller) {
      mainCursor = null;
    }
    controller.destroy();
  };
};

export default cursorInit;
