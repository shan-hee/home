<template>
  <div class="volume-slider">
    <div
      ref="track"
      class="volume-track"
      role="slider"
      tabindex="0"
      aria-label="音量"
      aria-orientation="vertical"
      aria-valuemin="0"
      aria-valuemax="100"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @keydown="handleKeydown"
    >
      <div class="volume-runway">
        <div class="volume-fill" />
        <span class="volume-thumb" aria-hidden="true" />
      </div>
    </div>
    <span ref="percentText" class="volume-percent">{{ initialPercent }}%</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  preview: [value: number];
  commit: [value: number];
}>();

const normalizeVolume = (value: number) => Math.min(1, Math.max(0, value));
const track = ref<HTMLElement | null>(null);
const percentText = ref<HTMLElement | null>(null);
const initialPercent = Math.round(normalizeVolume(props.modelValue) * 100);
let currentVolume = normalizeVolume(props.modelValue);
let activePointerId: number | null = null;
let trackTop = 0;
let trackHeight = 0;

const renderVolume = (value: number) => {
  currentVolume = normalizeVolume(value);
  const percent = Math.round(currentVolume * 100);
  track.value?.style.setProperty("--volume-progress", `${currentVolume * 100}%`);
  track.value?.setAttribute("aria-valuenow", String(percent));
  track.value?.setAttribute("aria-valuetext", `${percent}%`);
  if (percentText.value) percentText.value.textContent = `${percent}%`;
};

const previewVolume = (value: number) => {
  renderVolume(value);
  emit("preview", currentVolume);
};

const updateFromClientY = (clientY: number) => {
  if (trackHeight <= 0) return;
  previewVolume((trackTop + trackHeight - clientY) / trackHeight);
};

const handlePointerDown = (event: PointerEvent) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  const rect = track.value?.getBoundingClientRect();
  if (!rect || rect.height <= 0) return;
  trackTop = rect.top;
  trackHeight = rect.height;
  activePointerId = event.pointerId;
  track.value?.focus({ preventScroll: true });
  track.value?.classList.add("dragging");
  track.value?.setPointerCapture(event.pointerId);
  updateFromClientY(event.clientY);
};

const handlePointerMove = (event: PointerEvent) => {
  if (activePointerId !== event.pointerId) return;
  event.preventDefault();
  updateFromClientY(event.clientY);
};

const finishPointer = (event: PointerEvent, commit: boolean) => {
  if (activePointerId !== event.pointerId) return;
  if (commit) {
    updateFromClientY(event.clientY);
    emit("commit", currentVolume);
  } else {
    renderVolume(props.modelValue);
    emit("preview", currentVolume);
  }
  if (track.value?.hasPointerCapture(event.pointerId)) {
    track.value.releasePointerCapture(event.pointerId);
  }
  track.value?.classList.remove("dragging");
  activePointerId = null;
  trackHeight = 0;
};

const handlePointerUp = (event: PointerEvent) => finishPointer(event, true);
const handlePointerCancel = (event: PointerEvent) => finishPointer(event, false);

const handleKeydown = (event: KeyboardEvent) => {
  let nextVolume: number | null = null;
  switch (event.key) {
    case "ArrowUp":
    case "ArrowRight":
      nextVolume = currentVolume + 0.05;
      break;
    case "ArrowDown":
    case "ArrowLeft":
      nextVolume = currentVolume - 0.05;
      break;
    case "Home":
      nextVolume = 0;
      break;
    case "End":
      nextVolume = 1;
      break;
  }
  if (nextVolume === null) return;
  event.preventDefault();
  previewVolume(nextVolume);
  emit("commit", currentVolume);
};

watch(
  () => props.modelValue,
  (value) => {
    if (activePointerId === null) renderVolume(value);
  },
);

onMounted(() => renderVolume(currentVolume));
</script>

<style lang="scss" scoped>
.volume-slider {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}

.volume-track {
  --volume-progress: 0%;
  position: relative;
  width: 32px;
  height: 88px;
  flex: 0 0 88px;
  cursor: pointer;
  touch-action: none;
  user-select: none;

  &:focus-visible {
    outline: none;

    .volume-runway {
      box-shadow: 0 0 0 2px rgba(from var(--player-slider-main-color) r g b / 0.28);
    }
  }
}

.volume-runway {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 4px;
  border-radius: 999px;
  background: var(--player-slider-runway-color);
  transform: translateX(-50%);
}

.volume-fill {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--volume-progress);
  border-radius: inherit;
  background: var(--player-slider-main-color);
}

.volume-thumb {
  position: absolute;
  bottom: var(--volume-progress);
  left: 50%;
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  background: var(--player-slider-main-color);
  box-shadow: none;
  transform: translate(-50%, 50%);
  pointer-events: none;
}

.volume-percent {
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .volume-runway {
    transition: none;
  }
}
</style>
