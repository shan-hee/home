import { mainStore } from "@/store";

interface Firefly {
  x: number;
  y: number;
  opacity: number;
  speedX: number;
  speedY: number;
  radius: number;
  phase: number;
}

let animationFrameId: number | null = null;
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let viewportWidth = 0;
let viewportHeight = 0;
const fireflies: Firefly[] = [];

const resizeCanvas = () => {
  if (!canvas || !context) return;
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewportWidth * ratio);
  canvas.height = Math.round(viewportHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

const createFireflies = () => {
  const count = window.matchMedia("(max-width: 720px)").matches ? 20 : 42;
  fireflies.length = 0;
  for (let index = 0; index < count; index++) {
    fireflies.push({
      x: Math.random() * viewportWidth,
      y: Math.random() * viewportHeight,
      opacity: Math.random() * 0.6 + 0.2,
      speedX: Math.random() * 0.7 - 0.35,
      speedY: Math.random() * 0.7 - 0.35,
      radius: Math.random() * 1.7 + 0.8,
      phase: Math.random() * Math.PI * 2,
    });
  }
};

const render = () => {
  if (!context) return;
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  for (const firefly of fireflies) {
    firefly.x += firefly.speedX;
    firefly.y += firefly.speedY;
    firefly.phase += 0.025;
    if (firefly.x > viewportWidth) firefly.x = 0;
    if (firefly.x < 0) firefly.x = viewportWidth;
    if (firefly.y > viewportHeight) firefly.y = 0;
    if (firefly.y < 0) firefly.y = viewportHeight;
    context.beginPath();
    context.globalAlpha = firefly.opacity * (0.65 + Math.sin(firefly.phase) * 0.35);
    context.fillStyle = "#fff36b";
    context.shadowColor = "#fff36b";
    context.shadowBlur = 8;
    context.arc(firefly.x, firefly.y, firefly.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  animationFrameId = requestAnimationFrame(render);
};

const initFirefly = () => {
  const store = mainStore();
  if (canvas) {
    store.showFirefly = true;
    return;
  }
  canvas = document.createElement("canvas");
  canvas.id = "fireflyCanvas";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "0",
  });
  document.body.appendChild(canvas);
  context = canvas.getContext("2d");
  if (!context) {
    canvas.remove();
    canvas = null;
    return;
  }
  store.showFirefly = true;
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  createFireflies();
  render();
};

const closeFirefly = () => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  window.removeEventListener("resize", resizeCanvas);
  canvas?.remove();
  canvas = null;
  context = null;
  fireflies.length = 0;
  mainStore().showFirefly = false;
};

export { initFirefly, closeFirefly };
