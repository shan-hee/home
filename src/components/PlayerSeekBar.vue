<template>
  <div class="player-seek" :class="{ 'with-time': showTime }">
    <span v-if="showTime" class="time current-time">{{ formatTime(displayedTime) }}</span>
    <div
      ref="track"
      class="seek-track"
      :class="{ dragging: isDragging, disabled: !safeDuration }"
      role="slider"
      :tabindex="safeDuration ? 0 : -1"
      :aria-label="label"
      :aria-disabled="!safeDuration"
      aria-valuemin="0"
      :aria-valuemax="safeDuration"
      :aria-valuenow="Math.round(displayedTime)"
      :aria-valuetext="`${formatTime(displayedTime)} / ${formatTime(safeDuration)}`"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @keydown="handleKeydown"
    >
      <div class="seek-runway">
        <div class="seek-progress" :style="{ width: `${displayedProgress}%` }" />
        <span class="seek-thumb" :style="{ left: `${displayedProgress}%` }" aria-hidden="true" />
        <span
          v-if="loading"
          class="seek-loading"
          :style="{ left: `${loadingPosition}%` }"
          aria-hidden="true"
        />
      </div>
    </div>
    <span v-if="showTime" class="time duration-time">{{ formatTime(safeDuration) }}</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    currentTime: number;
    duration: number;
    loading?: boolean;
    showTime?: boolean;
    label?: string;
  }>(),
  {
    loading: false,
    showTime: false,
    label: "播放进度",
  },
);

const emit = defineEmits<{
  seek: [time: number];
}>();

const track = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const activePointerId = ref<number | null>(null);
const previewTime = ref(0);

const safeDuration = computed(() =>
  Number.isFinite(props.duration) && props.duration > 0 ? props.duration : 0,
);

const safeCurrentTime = computed(() =>
  safeDuration.value ? Math.min(safeDuration.value, Math.max(0, props.currentTime)) : 0,
);

const displayedTime = computed(() =>
  isDragging.value ? previewTime.value : safeCurrentTime.value,
);
const displayedProgress = computed(() =>
  safeDuration.value ? (displayedTime.value / safeDuration.value) * 100 : 0,
);
const loadingPosition = computed(() => Math.min(99, Math.max(1, displayedProgress.value)));

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const setPreviewFromClientX = (clientX: number) => {
  if (!track.value || !safeDuration.value) return;
  const rect = track.value.getBoundingClientRect();
  if (rect.width <= 0) return;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  previewTime.value = ratio * safeDuration.value;
};

const commitTime = (time: number) => {
  if (!safeDuration.value) return;
  emit("seek", Math.min(safeDuration.value, Math.max(0, time)));
};

const handlePointerDown = (event: PointerEvent) => {
  if (!safeDuration.value || (event.pointerType === "mouse" && event.button !== 0)) return;
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
    previewTime.value = safeCurrentTime.value;
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
  if (!safeDuration.value) return;
  let nextTime: number | null = null;
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      nextTime = safeCurrentTime.value - 5;
      break;
    case "ArrowRight":
    case "ArrowUp":
      nextTime = safeCurrentTime.value + 5;
      break;
    case "Home":
      nextTime = 0;
      break;
    case "End":
      nextTime = safeDuration.value;
      break;
  }
  if (nextTime === null) return;
  event.preventDefault();
  commitTime(nextTime);
};
</script>

<style lang="scss" scoped>
.player-seek {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;

  .time {
    flex: 0 0 auto;
    min-width: 38px;
    color: rgba(from var(--text-color) r g b / 0.7);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .duration-time {
    text-align: right;
  }
}

.seek-track {
  position: relative;
  width: 100%;
  height: 22px;
  flex: 1 1 auto;
  cursor: pointer;
  touch-action: none;
  user-select: none;

  &.disabled {
    cursor: default;
    opacity: 0.55;
  }

  &:focus-visible {
    outline: none;

    .seek-runway {
      box-shadow: 0 0 0 2px rgba(from var(--player-slider-main-color) r g b / 0.28);
    }
  }
}

.seek-runway {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 4px;
  overflow: visible;
  border-radius: 999px;
  background: var(--player-slider-runway-color);
  transform: translateY(-50%);
}

.seek-progress {
  height: 100%;
  border-radius: inherit;
  background: var(--player-slider-main-color);
  transition: width 0.15s linear;
}

.seek-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  background: var(--player-slider-main-color);
  box-shadow: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.75);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  pointer-events: none;
}

.seek-loading {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  border: 2px solid rgba(from var(--text-color) r g b / 0.35);
  border-top-color: var(--text-color);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: seek-loading-spin 0.8s linear infinite;
}

.seek-track:hover .seek-thumb,
.seek-track:focus-visible .seek-thumb,
.seek-track.dragging .seek-thumb {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.seek-track.dragging .seek-progress {
  transition: none;
}

@keyframes seek-loading-spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .seek-progress,
  .seek-thumb {
    transition: none;
  }

  .seek-loading {
    animation: none;
  }
}
</style>
