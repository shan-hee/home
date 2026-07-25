import { useMainStore } from "@/store";

interface Snowflake {
  x: number;
  y: number;
  opacity: number;
  speedX: number;
  speedY: number;
  radius: number;
  angle: number;
}

let animationFrameId: number | null = null;
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let viewportWidth = 0;
let viewportHeight = 0;
const snowflakes: Snowflake[] = [];

const resizeCanvas = () => {
  if (!canvas || !context) return;
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewportWidth * ratio);
  canvas.height = Math.round(viewportHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

const createSnowflakes = () => {
  const count = window.matchMedia("(max-width: 720px)").matches ? 28 : 60;
  snowflakes.length = 0;
  for (let index = 0; index < count; index++) {
    snowflakes.push({
      x: Math.random() * viewportWidth,
      y: Math.random() * viewportHeight,
      opacity: Math.random() * 0.45 + 0.25,
      speedX: Math.random() * 0.3 + 0.1,
      speedY: Math.random() * 1.2 + 0.35,
      radius: Math.random() * 2 + 1,
      angle: Math.random() * Math.PI * 2,
    });
  }
};

const render = () => {
  if (!context) return;
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  for (const flake of snowflakes) {
    flake.angle += 0.02;
    flake.x += flake.speedX + Math.sin(flake.angle) * 0.3;
    flake.y += flake.speedY;
    if (flake.y > viewportHeight || flake.x > viewportWidth + 20 || flake.x < -20) {
      flake.x = Math.random() * viewportWidth;
      flake.y = -flake.radius;
    }
    context.beginPath();
    context.globalAlpha = flake.opacity;
    context.fillStyle = "white";
    context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  animationFrameId = requestAnimationFrame(render);
};

const initSnowfall = () => {
  const store = useMainStore.getState();
  if (canvas) {
    store.patch({ showSnowfall: true });
    return;
  }
  canvas = document.createElement("canvas");
  canvas.id = "snowCanvas";
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
  store.patch({ showSnowfall: true });
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  createSnowflakes();
  render();
};

const closeSnowfall = () => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  window.removeEventListener("resize", resizeCanvas);
  canvas?.remove();
  canvas = null;
  context = null;
  snowflakes.length = 0;
  useMainStore.getState().patch({ showSnowfall: false });
};

export { initSnowfall, closeSnowfall };
