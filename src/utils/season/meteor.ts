import { mainStore } from "@/store";

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  phase: number;
  twinkleSpeed: number;
  driftSpeed: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  tailLength: number;
  width: number;
  age: number;
  duration: number;
}

const mobileQuery = window.matchMedia("(max-width: 720px)");
const stars: Star[] = [];
const meteors: Meteor[] = [];

let animationFrameId: number | null = null;
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let viewportWidth = 0;
let viewportHeight = 0;
let lastFrameTime = 0;
let nextMeteorAt = 0;

const randomBetween = (minimum: number, maximum: number) => (
  Math.random() * (maximum - minimum) + minimum
);

const createStars = () => {
  const count = mobileQuery.matches
    ? Math.min(80, Math.max(45, Math.round(viewportWidth * 0.12)))
    : Math.min(240, Math.max(100, Math.round(viewportWidth * 0.12)));

  stars.length = 0;
  for (let index = 0; index < count; index += 1) {
    stars.push({
      x: Math.random() * viewportWidth,
      y: Math.random() * viewportHeight,
      radius: randomBetween(0.6, index % 30 === 0 ? 2.2 : 1.5),
      opacity: randomBetween(0.22, 0.75),
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: randomBetween(0.8, 1.8),
      driftSpeed: randomBetween(1.5, 5),
      color: index % 30 === 0 ? "180, 184, 240" : "226, 225, 142",
    });
  }
};

const resizeCanvas = () => {
  if (!canvas || !context) return;

  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewportWidth * ratio);
  canvas.height = Math.round(viewportHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  createStars();
};

const scheduleNextMeteor = (timestamp: number) => {
  const delay = mobileQuery.matches
    ? randomBetween(3500, 7500)
    : randomBetween(1800, 5200);
  nextMeteorAt = timestamp + delay;
};

const createMeteor = () => {
  const angle = randomBetween(-0.9, -0.55);
  const speed = mobileQuery.matches
    ? randomBetween(360, 520)
    : randomBetween(460, 720);

  meteors.push({
    x: randomBetween(-viewportWidth * 0.08, viewportWidth * 0.62),
    y: randomBetween(viewportHeight * 0.3, viewportHeight * 0.95),
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    tailLength: randomBetween(80, mobileQuery.matches ? 135 : 190),
    width: randomBetween(1, 2),
    age: 0,
    duration: randomBetween(1.1, 1.9),
  });
};

const drawStars = (deltaSeconds: number) => {
  if (!context) return;

  for (const star of stars) {
    star.x += star.driftSpeed * deltaSeconds;
    star.y -= star.driftSpeed * 0.35 * deltaSeconds;
    star.phase += star.twinkleSpeed * deltaSeconds;

    if (star.x > viewportWidth + star.radius) star.x = -star.radius;
    if (star.y < -star.radius) star.y = viewportHeight + star.radius;

    const alpha = star.opacity * (0.7 + Math.sin(star.phase) * 0.3);
    context.beginPath();
    context.fillStyle = `rgba(${star.color}, ${alpha})`;
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
};

const drawMeteors = (deltaSeconds: number) => {
  if (!context) return;

  for (let index = meteors.length - 1; index >= 0; index -= 1) {
    const meteor = meteors[index];
    meteor.age += deltaSeconds;
    meteor.x += meteor.velocityX * deltaSeconds;
    meteor.y += meteor.velocityY * deltaSeconds;

    const progress = meteor.age / meteor.duration;
    if (
      progress >= 1 ||
      meteor.x > viewportWidth + meteor.tailLength ||
      meteor.y < -meteor.tailLength
    ) {
      meteors.splice(index, 1);
      continue;
    }

    const speed = Math.hypot(meteor.velocityX, meteor.velocityY);
    const tailX = meteor.x - (meteor.velocityX / speed) * meteor.tailLength;
    const tailY = meteor.y - (meteor.velocityY / speed) * meteor.tailLength;
    const opacity = Math.sin(progress * Math.PI) * 0.9;
    const gradient = context.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
    gradient.addColorStop(0, `rgba(240, 241, 255, ${opacity})`);
    gradient.addColorStop(0.2, `rgba(226, 225, 224, ${opacity * 0.65})`);
    gradient.addColorStop(1, "rgba(226, 225, 224, 0)");

    context.save();
    context.beginPath();
    context.moveTo(meteor.x, meteor.y);
    context.lineTo(tailX, tailY);
    context.lineWidth = meteor.width;
    context.lineCap = "round";
    context.strokeStyle = gradient;
    context.shadowColor = "rgba(226, 225, 224, 0.7)";
    context.shadowBlur = 6;
    context.stroke();
    context.beginPath();
    context.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    context.arc(meteor.x, meteor.y, meteor.width * 1.15, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
};

const render = (timestamp: number) => {
  if (!context) return;

  const deltaSeconds = lastFrameTime === 0
    ? 0
    : Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;
  context.clearRect(0, 0, viewportWidth, viewportHeight);

  drawStars(deltaSeconds);
  const meteorLimit = mobileQuery.matches ? 1 : 3;
  if (timestamp >= nextMeteorAt && meteors.length < meteorLimit) {
    createMeteor();
    scheduleNextMeteor(timestamp);
  }
  drawMeteors(deltaSeconds);

  animationFrameId = requestAnimationFrame(render);
};

const initMeteor = () => {
  const store = mainStore();
  if (canvas) {
    store.showMeteor = true;
    return;
  }

  canvas = document.createElement("canvas");
  canvas.id = "meteorCanvas";
  canvas.setAttribute("aria-hidden", "true");
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

  store.showMeteor = true;
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  lastFrameTime = 0;
  nextMeteorAt = performance.now() + randomBetween(400, 1400);
  animationFrameId = requestAnimationFrame(render);
};

const closeMeteor = () => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  window.removeEventListener("resize", resizeCanvas);
  canvas?.remove();
  canvas = null;
  context = null;
  lastFrameTime = 0;
  nextMeteorAt = 0;
  stars.length = 0;
  meteors.length = 0;
  mainStore().showMeteor = false;
};

export { initMeteor, closeMeteor };
