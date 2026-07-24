<template>
  <div
    v-if="store.footerProgressBar"
    ref="track"
    class="progress-bar"
    :class="{ dragging: isDragging }"
    role="slider"
    tabindex="0"
    aria-label="播放进度"
    aria-valuemin="0"
    :aria-valuemax="duration"
    :aria-valuenow="Math.round(displayedTime)"
    :aria-valuetext="ariaValueText"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
    @keydown="handleKeydown"
  >
    <div class="track-line">
      <div class="progress" :style="{ width: `${displayedProgress}%` }" />
      <span class="progress-thumb" :style="{ left: `${displayedProgress}%` }" aria-hidden="true" />
      <Icon v-if="showLoading" size="20" class="reload-circle"
        :style="{ left: `${loadingPosition}%` }" aria-hidden="true">
        <ReloadCircle />
      </Icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@vicons/utils";
import { ReloadCircle } from "@vicons/ionicons5";
import { mainStore } from "@/store";

const store = mainStore();
const track = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const activePointerId = ref<number | null>(null);
const previewTime = ref(0);

const duration = computed(() => {
  return Number.isFinite(store.playerDuration) && store.playerDuration > 0
    ? store.playerDuration
    : 0;
});

const actualTime = computed(() => {
  if (!duration.value) return 0;
  return Math.min(duration.value, Math.max(0, store.playerCurrentTime));
});

const displayedTime = computed(() => isDragging.value ? previewTime.value : actualTime.value);
const displayedProgress = computed(() => duration.value ? (displayedTime.value / duration.value) * 100 : 0);
const loadingPosition = computed(() => Math.min(99, Math.max(1, displayedProgress.value)));
const showLoading = computed(() => !store.playerCanplay && store.playerStatus !== "error");

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const ariaValueText = computed(() => `${formatTime(displayedTime.value)} / ${formatTime(duration.value)}`);

const setPreviewFromClientX = (clientX: number) => {
  if (!track.value || !duration.value) return;
  const rect = track.value.getBoundingClientRect();
  if (rect.width <= 0) return;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  previewTime.value = ratio * duration.value;
};

const commitTime = (time: number) => {
  if (!duration.value) return;
  const nextTime = Math.min(duration.value, Math.max(0, time));
  const audio = document.querySelector("audio");
  if (audio) audio.currentTime = nextTime;
  store.playerCurrentTime = nextTime;
  store.lyricSeekVersion++;
};

const handlePointerDown = (event: PointerEvent) => {
  if (!duration.value || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  activePointerId.value = event.pointerId;
  isDragging.value = true;
  setPreviewFromClientX(event.clientX);
  track.value?.setPointerCapture(event.pointerId);
};

const handlePointerMove = (event: PointerEvent) => {
  if (!isDragging.value || activePointerId.value !== event.pointerId) return;
  event.preventDefault();
  setPreviewFromClientX(event.clientX);
};

const finishPointer = (event: PointerEvent, commit: boolean) => {
  if (!isDragging.value || activePointerId.value !== event.pointerId) return;
  if (commit) {
    setPreviewFromClientX(event.clientX);
    commitTime(previewTime.value);
  } else {
    previewTime.value = actualTime.value;
  }
  if (track.value?.hasPointerCapture(event.pointerId)) {
    track.value.releasePointerCapture(event.pointerId);
  }
  activePointerId.value = null;
  isDragging.value = false;
};

const handlePointerUp = (event: PointerEvent) => finishPointer(event, true);
const handlePointerCancel = (event: PointerEvent) => finishPointer(event, false);

const handleKeydown = (event: KeyboardEvent) => {
  if (!duration.value) return;
  let nextTime: number | null = null;
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      nextTime = actualTime.value - 5;
      break;
    case "ArrowRight":
    case "ArrowUp":
      nextTime = actualTime.value + 5;
      break;
    case "Home":
      nextTime = 0;
      break;
    case "End":
      nextTime = duration.value;
      break;
  }
  if (nextTime === null) return;
  event.preventDefault();
  commitTime(nextTime);
};
</script>

<style lang="scss" scoped>
.progress-bar {
  position: absolute;
  top: -11px;
  left: 0;
  width: 100%;
  height: 24px;
  z-index: 99;
  cursor: pointer;
  touch-action: none;
  user-select: none;

  .track-line {
    position: absolute;
    top: 11px;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: rgb(240 240 240);
  }

  .progress {
    height: 100%;
    background-color: rgb(138 43 226);
    transition: width 0.15s linear;
  }

  .progress-thumb {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    border: 2px solid rgb(255 255 255 / 90%);
    border-radius: 50%;
    background-color: rgb(138 43 226);
    box-shadow: 0 1px 5px rgb(0 0 0 / 35%);
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.75);
    transition: opacity 0.15s ease, transform 0.15s ease;
    pointer-events: none;
  }

  .reload-circle {
    position: absolute;
    top: 50%;
    color: black;
    transform: translate(-50%, -50%);
    animation: spin 1s linear infinite;
  }

  &:hover .progress-thumb,
  &:focus-visible .progress-thumb,
  &.dragging .progress-thumb {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  &:focus-visible {
    outline: 2px solid rgb(138 43 226 / 70%);
    outline-offset: -2px;
  }

  &.dragging .progress {
    transition: none;
  }
}

@keyframes spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar .progress,
  .progress-bar .progress-thumb {
    transition: none;
  }
}
</style>
