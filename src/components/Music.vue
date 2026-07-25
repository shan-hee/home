<template>
  <!-- 紧凑音乐卡片 -->
  <section class="music" aria-label="音乐播放器">
    <button
      type="button"
      class="footer-player-button"
      :class="{ 'is-active': store.footerPlayerShow }"
      :aria-pressed="store.footerPlayerShow"
      :aria-label="store.footerPlayerShow ? '隐藏底栏歌词和进度' : '显示底栏歌词和进度'"
      :title="store.footerPlayerShow ? '隐藏底栏歌词和进度' : '显示底栏歌词和进度'"
      @click="store.footerPlayerShow = !store.footerPlayerShow"
    >
      <TextMessage
        theme="outline"
        size="20"
        stroke-width="4"
        fill="currentColor"
      />
    </button>
    <button
      type="button"
      class="fullscreen-button"
      aria-label="打开全屏播放器"
      title="全屏播放器"
      @click="fullscreenOpen = true"
    >
      <FullScreen theme="filled" size="20" stroke-width="5" fill="currentColor" />
    </button>

    <div class="compact-controls">
      <button
        type="button"
        aria-label="打开播放列表"
        title="播放列表"
        @click="store.musicBoxOpenState = true"
      >
        <MusicList theme="filled" size="24" stroke-width="5" fill="currentColor" />
      </button>
      <button
        type="button"
        aria-label="上一首"
        :disabled="!store.musicIsOk"
        @click="changeMusicIndex(0)"
      >
        <GoStart theme="filled" size="27" stroke-width="5" fill="currentColor" />
      </button>
      <button
        type="button"
        class="play-button"
        :aria-label="isPlaying ? '暂停' : '播放'"
        :disabled="!store.musicIsOk"
        @click="changePlayState"
      >
        <Pause
          v-if="isPlaying"
          theme="filled"
          size="34"
          stroke-width="5"
          fill="currentColor"
        />
        <PlayOne
          v-else
          theme="filled"
          size="34"
          stroke-width="5"
          fill="currentColor"
        />
      </button>
      <button
        type="button"
        aria-label="下一首"
        :disabled="!store.musicIsOk"
        @click="changeMusicIndex(1)"
      >
        <GoEnd theme="filled" size="27" stroke-width="5" fill="currentColor" />
      </button>
      <div class="volume-control">
        <button
          type="button"
          :aria-label="volumeNum === 0 ? '恢复音量' : '静音'"
          title="音量"
          @click="toggleMute"
        >
          <VolumeMute
            v-if="volumeNum === 0"
            theme="filled"
            size="23"
            stroke-width="5"
            fill="currentColor"
          />
          <VolumeSmall
            v-else-if="volumeNum < 0.7"
            theme="filled"
            size="23"
            stroke-width="5"
            fill="currentColor"
          />
          <VolumeNotice
            v-else
            theme="filled"
            size="23"
            stroke-width="5"
            fill="currentColor"
          />
        </button>
        <div class="volume-popover" aria-label="音量调节">
          <VolumeSlider
            :model-value="volumeNum"
            @preview="previewVolume"
            @commit="saveVolume"
          />
        </div>
      </div>
    </div>

    <div class="compact-meta">
      <span class="track-name">{{ displayTrackName }}</span>
      <span v-if="currentTrack?.artist" class="track-artist">{{ currentTrack.artist }}</span>
    </div>

    <Transition name="compact-seek-slide">
      <PlayerSeekBar
        v-if="!footerPlayerActive"
        class="compact-seek"
        :current-time="store.playerCurrentTime"
        :duration="store.playerDuration"
        :loading="playerLoading"
        @seek="seekTo"
      />
    </Transition>
  </section>

  <!-- 隐藏的播放引擎，所有自定义界面共用这一实例 -->
  <div class="audio-engine" aria-hidden="true">
    <Player
      ref="playerRef"
      :volume="initialVolume"
      @playlist-loaded="handlePlaylistLoaded"
      @track-changed="handleTrackChanged"
    />
  </div>

  <Teleport to="body">
    <!-- 全屏播放器 -->
    <Transition name="fullscreen-fade">
      <section
        v-if="fullscreenOpen"
        class="fullscreen-player"
        role="dialog"
        aria-modal="true"
        aria-label="全屏音乐播放器"
      >
        <div class="fullscreen-background" :style="fullscreenBackgroundStyle" aria-hidden="true" />
        <button
          type="button"
          class="exit-fullscreen"
          aria-label="退出全屏播放器"
          title="退出全屏"
          @click="fullscreenOpen = false"
        >
          <OffScreen theme="outline" size="26" fill="currentColor" />
        </button>

        <div class="fullscreen-content">
          <header class="fullscreen-header">
            <h1>{{ displayTrackName }}</h1>
            <p>
              <span>专辑：{{ currentTrack?.album || "暂无" }}</span>
              <span>歌手：{{ currentTrack?.artist || "未知歌手" }}</span>
              <span>来源：{{ playerData.server }}</span>
            </p>
            <div class="content-tabs" aria-label="歌曲内容">
              <button type="button" class="is-active">歌词</button>
              <button type="button" disabled>百科</button>
              <button type="button" disabled>相似推荐</button>
            </div>
          </header>

          <div class="fullscreen-main">
            <div class="cover-area">
              <img
                v-if="currentTrack?.cover"
                :src="currentTrack.cover"
                :alt="`${displayTrackName}封面`"
              />
              <div v-else class="cover-placeholder" aria-label="暂无歌曲封面">
                <MusicOne theme="outline" size="72" fill="currentColor" />
              </div>
            </div>

            <div ref="lyricsPanel" class="lyrics-panel" aria-label="歌词">
              <template v-if="fullLyrics.length">
                <p
                  v-for="(line, index) in fullLyrics"
                  :key="`${line[0]}-${index}`"
                  class="lyric-line"
                  :class="{ 'is-active': activeLyricIndex === index }"
                >
                  {{ line[1] }}
                </p>
              </template>
              <div v-else class="lyrics-placeholder">
                <strong>{{ currentTrack?.artist || "未知歌手" }}</strong>
                <span>歌词数据将在播放后显示</span>
              </div>
            </div>
          </div>
        </div>

        <footer class="fullscreen-controls">
          <button
            type="button"
            aria-label="上一首"
            :disabled="!store.musicIsOk"
            @click="changeMusicIndex(0)"
          >
            <GoStart theme="filled" size="25" fill="currentColor" />
          </button>
          <button
            type="button"
            class="fullscreen-play"
            :aria-label="isPlaying ? '暂停' : '播放'"
            :disabled="!store.musicIsOk"
            @click="changePlayState"
          >
            <Pause v-if="isPlaying" theme="filled" size="28" fill="currentColor" />
            <PlayOne v-else theme="filled" size="28" fill="currentColor" />
          </button>
          <button
            type="button"
            aria-label="下一首"
            :disabled="!store.musicIsOk"
            @click="changeMusicIndex(1)"
          >
            <GoEnd theme="filled" size="25" fill="currentColor" />
          </button>

          <PlayerSeekBar
            class="fullscreen-seek"
            :current-time="store.playerCurrentTime"
            :duration="store.playerDuration"
            :loading="playerLoading"
            show-time
            @seek="seekTo"
          />

          <div class="volume-control fullscreen-volume">
            <button
              type="button"
              :aria-label="volumeNum === 0 ? '恢复音量' : '静音'"
              @click="toggleMute"
            >
              <VolumeMute v-if="volumeNum === 0" theme="outline" size="22" fill="currentColor" />
              <VolumeSmall
                v-else-if="volumeNum < 0.7"
                theme="outline"
                size="22"
                fill="currentColor"
              />
              <VolumeNotice v-else theme="outline" size="22" fill="currentColor" />
            </button>
            <div class="volume-popover" aria-label="音量调节">
              <VolumeSlider
                :model-value="volumeNum"
                @preview="previewVolume"
                @commit="saveVolume"
              />
            </div>
          </div>

          <button
            type="button"
            :aria-label="`播放模式：${currentPlaybackMode.label}`"
            :title="`播放模式：${currentPlaybackMode.label}`"
            @click="cyclePlaybackMode"
          >
            <component
              :is="currentPlaybackMode.icon"
              theme="outline"
              size="23"
              fill="currentColor"
            />
          </button>
          <button
            type="button"
            aria-label="打开播放列表"
            title="播放列表"
            @click="store.musicBoxOpenState = true"
          >
            <MusicList theme="outline" size="24" fill="currentColor" />
          </button>
        </footer>
      </section>
    </Transition>

    <!-- 共用播放队列侧栏 -->
    <Transition name="queue-slide">
      <div
        v-if="store.musicBoxOpenState"
        class="queue-layer"
        @click="store.musicBoxOpenState = false"
      >
        <aside
          class="queue-panel"
          role="dialog"
          aria-modal="true"
          aria-label="播放列表"
          @click.stop
        >
          <header>
            <h2>队列</h2>
            <button
              type="button"
              aria-label="关闭播放列表"
              @click="store.musicBoxOpenState = false"
            >
              <Close theme="outline" size="24" fill="currentColor" />
            </button>
          </header>

          <div class="queue-content">
            <section v-if="currentTrack" class="queue-section">
              <h3>当前播放</h3>
              <button
                type="button"
                class="queue-track is-current"
                @click="selectTrack(currentIndex)"
              >
                <img
                  v-if="currentTrack.cover"
                  :src="currentTrack.cover"
                  :alt="`${currentTrack.name}封面`"
                />
                <span v-else class="queue-cover-placeholder"
                  ><MusicOne theme="outline" size="24"
                /></span>
                <span class="queue-track-info">
                  <strong>{{ currentTrack.name }}</strong>
                  <small>{{ currentTrack.artist || "未知歌手" }}</small>
                </span>
                <span v-if="isPlaying" class="playing-bars" aria-label="正在播放"
                  ><i /><i /><i
                /></span>
              </button>
            </section>

            <section class="queue-section">
              <h3>播放队列</h3>
              <div v-if="queuedTracks.length" class="queue-tracks">
                <button
                  v-for="item in queuedTracks"
                  :key="`${item.index}-${item.track.url}`"
                  type="button"
                  class="queue-track"
                  @click="selectTrack(item.index)"
                >
                  <img
                    v-if="item.track.cover"
                    :src="item.track.cover"
                    :alt="`${item.track.name}封面`"
                  />
                  <span v-else class="queue-cover-placeholder"
                    ><MusicOne theme="outline" size="24"
                  /></span>
                  <span class="queue-track-info">
                    <strong>{{ item.track.name }}</strong>
                    <small>{{ item.track.artist || "未知歌手" }}</small>
                  </span>
                </button>
              </div>
              <p v-else class="empty-queue">暂无其他歌曲</p>
            </section>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Component, CSSProperties } from "vue";
import {
  Close,
  FullScreen,
  GoEnd,
  GoStart,
  LoopOnce,
  MusicList,
  MusicOne,
  OffScreen,
  Pause,
  PlayCycle,
  PlayOne,
  Shuffle,
  TextMessage,
  VolumeMute,
  VolumeNotice,
  VolumeSmall,
} from "@icon-park/vue-next";
import type { PlaylistItem } from "@/api";
import Player from "@/components/Player.vue";
import PlayerSeekBar from "@/components/PlayerSeekBar.vue";
import VolumeSlider from "@/components/VolumeSlider.vue";
import { mainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import type { MainState } from "@/typings/store";

type LyricLine = [time: number, text: string];

interface PlaybackMode {
  value: MainState["playerOrder"];
  label: string;
  icon: Component;
}

const store = mainStore();
const siteContent = useSiteContentStore();
const playerRef = ref<InstanceType<typeof Player> | null>(null);
const playlist = ref<PlaylistItem[]>([]);
const currentIndex = ref(0);
const fullscreenOpen = ref(false);
const lyricsPanel = ref<HTMLElement | null>(null);
const initialVolume = store.musicVolume ?? 0.3;
const volumeNum = ref(initialVolume);
const previousVolume = ref(volumeNum.value > 0 ? volumeNum.value : 0.3);
let volumeUpdateFrame: number | null = null;
let pendingVolume = volumeNum.value;

const playerData = computed(() => siteContent.sections.music);

const playbackModes: PlaybackMode[] = [
  { value: "list", label: "列表循环", icon: PlayCycle },
  { value: "single", label: "单曲循环", icon: LoopOnce },
  { value: "shuffle", label: "随机播放", icon: Shuffle },
];

const currentTrack = computed(() => playlist.value[currentIndex.value] ?? null);
const displayTrackName = computed(
  () => currentTrack.value?.name || store.playerTitle || store.playerError || "播放器准备中",
);
const isPlaying = computed(() => store.playerStatus === "playing");
const footerPlayerActive = computed(() => store.footerPlayerShow && isPlaying.value);
const playerLoading = computed(() => !store.playerCanplay && store.playerStatus !== "error");
const queuedTracks = computed(() =>
  playlist.value
    .map((track, index) => ({ track, index }))
    .filter((item) => item.index !== currentIndex.value),
);

const currentPlaybackMode = computed(
  () => playbackModes.find((mode) => mode.value === store.playerOrder) ?? playbackModes[0]!,
);

const fullscreenBackgroundStyle = computed<CSSProperties>(() =>
  currentTrack.value?.cover
    ? { backgroundImage: `url(${JSON.stringify(currentTrack.value.cover)})` }
    : {},
);

const lineLyrics = computed<LyricLine[]>(() => {
  void store.playerCurrentTime;
  const lyrics = playerRef.value?.getCurrentLyrics() as LyricLine[] | undefined;
  if (lyrics?.length) {
    return lyrics.filter(
      (line) => Array.isArray(line) && Number.isFinite(line[0]) && line[1]?.trim(),
    );
  }
  return [];
});

const fullLyrics = computed(() => lineLyrics.value.filter((line) => line[1].trim().length > 0));
const activeLyricIndex = computed(() => {
  let activeIndex = -1;
  for (let index = 0; index < fullLyrics.value.length; index++) {
    if (fullLyrics.value[index][0] <= store.playerCurrentTime + 0.2) activeIndex = index;
    else break;
  }
  return activeIndex;
});

const handlePlaylistLoaded = async (tracks: PlaylistItem[]) => {
  playlist.value = tracks;
  if (currentIndex.value >= tracks.length) currentIndex.value = 0;
  await nextTick();
  playerRef.value?.changeVolume(volumeNum.value);
};

const handleTrackChanged = (index: number) => {
  currentIndex.value = index;
};

const changePlayState = () => {
  playerRef.value?.playToggle();
};

const changeMusicIndex = (type: 0 | 1) => {
  playerRef.value?.changeSong(type);
};

const selectTrack = (index: number) => {
  playerRef.value?.selectSong(index);
};

const seekTo = (time: number) => {
  playerRef.value?.seekTo(time);
};

const toggleMute = () => {
  let nextVolume: number;
  if (volumeNum.value > 0) {
    previousVolume.value = volumeNum.value;
    nextVolume = 0;
  } else {
    nextVolume = previousVolume.value || 0.3;
  }
  saveVolume(nextVolume);
};

const saveVolume = (value: number) => {
  const nextVolume = Math.min(1, Math.max(0, value));
  if (volumeNum.value !== nextVolume) volumeNum.value = nextVolume;
  if (store.musicVolume !== nextVolume) store.musicVolume = nextVolume;
};

const cyclePlaybackMode = () => {
  const currentModeIndex = playbackModes.findIndex((mode) => mode.value === store.playerOrder);
  const nextMode = playbackModes[(currentModeIndex + 1) % playbackModes.length] ?? playbackModes[0];
  if (nextMode) store.playerOrder = nextMode.value;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, button, a, [contenteditable='true'], [role='textbox'], [role='slider']",
    ),
  );
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.code === "Escape") {
    if (store.musicBoxOpenState) {
      store.musicBoxOpenState = false;
      return;
    }
    if (fullscreenOpen.value) {
      fullscreenOpen.value = false;
      return;
    }
  }
  if (!store.musicIsOk || !store.playerKeyboardShortcuts || isEditableTarget(event.target)) return;

  if (event.code === "Space" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    changePlayState();
    return;
  }
  if (!event.ctrlKey || event.metaKey || event.altKey) return;

  switch (event.code) {
    case "ArrowUp":
      event.preventDefault();
      saveVolume(Math.min(1, Number((volumeNum.value + 0.05).toFixed(2))));
      break;
    case "ArrowDown":
      event.preventDefault();
      saveVolume(Math.max(0, Number((volumeNum.value - 0.05).toFixed(2))));
      break;
    case "ArrowLeft":
      if (!event.repeat) {
        event.preventDefault();
        changeMusicIndex(0);
      }
      break;
    case "ArrowRight":
      if (!event.repeat) {
        event.preventDefault();
        changeMusicIndex(1);
      }
      break;
  }
};

const toggleKeyListener = (add: boolean) => {
  if (add) window.addEventListener("keydown", handleKeydown);
  else window.removeEventListener("keydown", handleKeydown);
};

const handleFocus = () => toggleKeyListener(true);
const handleBlur = () => toggleKeyListener(false);
const handleVisibilityChange = () => toggleKeyListener(document.visibilityState === "visible");

const previewVolume = (value: number) => {
  pendingVolume = value;
  if (volumeUpdateFrame !== null) return;
  volumeUpdateFrame = requestAnimationFrame(() => {
    playerRef.value?.changeVolume(pendingVolume);
    volumeUpdateFrame = null;
  });
};

watch(volumeNum, (value) => {
  previewVolume(value);
});

watch(
  () => store.musicVolume,
  (value) => {
    if (value !== volumeNum.value) volumeNum.value = value;
  },
);

watch([activeLyricIndex, fullscreenOpen], async ([index, isFullscreenOpen]) => {
  if (!isFullscreenOpen || index < 0) return;
  await nextTick();
  lyricsPanel.value
    ?.querySelector<HTMLElement>(".lyric-line.is-active")
    ?.scrollIntoView({ block: "center", behavior: "smooth" });
});

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("blur", handleBlur);
  if (document.visibilityState === "visible") toggleKeyListener(true);
});

onUnmounted(() => {
  if (volumeUpdateFrame !== null) cancelAnimationFrame(volumeUpdateFrame);
  toggleKeyListener(false);
  window.removeEventListener("focus", handleFocus);
  window.removeEventListener("blur", handleBlur);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<style lang="scss" scoped>
.music {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 14px 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--player-control-color);
  background: var(--card-background-color);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  animation: fade 0.5s;
}

button {
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;

  &:hover {
    opacity: 0.72;
  }

  &:focus-visible {
    outline: 2px solid rgba(from var(--player-control-color) r g b / 0.55);
    outline-offset: 3px;
  }

  &:active {
    transform: scale(0.92);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
}

.footer-player-button,
.fullscreen-button {
  position: absolute;
  top: 9px;
  z-index: 2;
  width: 28px;
  height: 28px;
  opacity: 0.72;
}

.footer-player-button {
  left: 10px;
  opacity: 0.48;

  &.is-active {
    opacity: 0.92;
  }
}

.fullscreen-button {
  right: 10px;
}

.compact-controls {
  width: 100%;
  min-height: 52px;
  padding-top: 7px;
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  gap: 4px;

  > button,
  .volume-control > button {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
  }

  .play-button {
    width: 42px;
    height: 42px;
    flex-basis: 42px;
  }
}

.volume-control {
  position: relative;
  display: grid;
  place-items: center;

  &:hover,
  &:focus-within {
    .volume-popover {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
  }
}

.volume-popover {
  position: absolute;
  left: 50%;
  bottom: 100%;
  z-index: 10;
  width: 42px;
  height: 126px;
  padding: 10px 5px 7px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  color: var(--text-color);
  background: transparent;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-50%);
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;

}

.compact-meta {
  width: 100%;
  min-width: 0;
  margin: 5px 0 1px;
  display: flex;
  justify-content: center;
  gap: 5px;
  overflow: hidden;
  font-size: 0.9rem;
  white-space: nowrap;

  .track-name,
  .track-artist {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-name {
    flex: 0 1 auto;
    font-weight: 600;
  }

  .track-artist {
    flex: 0 2 auto;
    opacity: 0.66;

    &::before {
      content: "· ";
    }
  }
}

.compact-seek {
  max-height: 22px;
  margin-top: 2px;
  overflow: hidden;
  transform-origin: center top;
}

.compact-seek-slide-enter-active,
.compact-seek-slide-leave-active {
  transition:
    max-height 0.28s ease,
    margin-top 0.28s ease,
    opacity 0.2s ease,
    transform 0.28s ease;
}

.compact-seek-slide-enter-from,
.compact-seek-slide-leave-to {
  max-height: 0;
  margin-top: 0;
  opacity: 0;
  transform: translateY(-3px) scaleY(0.75);
}

.audio-engine {
  position: fixed;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.fullscreen-player {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  color: rgba(245, 245, 245, 0.94);
  background: #17242b;
}

.fullscreen-background {
  position: absolute;
  inset: -40px;
  background-position: center;
  background-size: cover;
  filter: blur(42px) saturate(0.7);
  opacity: 0.34;
  transform: scale(1.08);

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, rgba(12, 24, 31, 0.78), rgba(31, 45, 53, 0.68));
  }
}

.exit-fullscreen {
  position: absolute;
  top: 22px;
  right: 24px;
  z-index: 3;
  width: 38px;
  height: 38px;
}

.fullscreen-content {
  position: relative;
  z-index: 1;
  width: min(1180px, calc(100% - 80px));
  height: calc(100% - 104px);
  margin: 0 auto;
  padding: 20px 0 26px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.fullscreen-header {
  width: 52%;
  min-width: 0;
  margin: 0 0 28px auto;

  h1 {
    overflow: hidden;
    font-size: clamp(1.45rem, 2.2vw, 2rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    color: rgba(245, 245, 245, 0.58);
    font-size: 0.82rem;
  }
}

.content-tabs {
  width: fit-content;
  margin-top: 22px;
  padding: 3px;
  display: flex;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);

  button {
    min-width: 52px;
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    color: rgba(245, 245, 245, 0.58);
    font-size: 0.78rem;

    &.is-active {
      color: rgba(245, 245, 245, 0.94);
      background: rgba(255, 255, 255, 0.13);
    }
  }
}

.fullscreen-main {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 46%) minmax(300px, 54%);
  align-items: center;
  gap: clamp(50px, 8vw, 110px);
}

.cover-area {
  width: min(100%, 470px);
  aspect-ratio: 1;
  justify-self: end;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.24);

  img,
  .cover-placeholder {
    width: 100%;
    height: 100%;
  }

  img {
    display: block;
    object-fit: cover;
  }

  .cover-placeholder {
    display: grid;
    place-items: center;
    color: rgba(245, 245, 245, 0.4);
  }
}

.lyrics-panel {
  height: min(52vh, 520px);
  padding: 44% 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  -webkit-mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent);
  mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent);
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.lyric-line {
  margin: 0 0 19px;
  color: rgba(245, 245, 245, 0.26);
  font-size: clamp(1rem, 1.5vw, 1.28rem);
  line-height: 1.5;
  transition:
    color 0.28s ease,
    font-size 0.28s ease,
    opacity 0.28s ease;

  &.is-active {
    color: rgba(245, 245, 245, 0.98);
    font-size: clamp(1.12rem, 1.7vw, 1.45rem);
    font-weight: 650;
  }
}

.lyrics-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  color: rgba(245, 245, 245, 0.38);

  strong {
    color: rgba(245, 245, 245, 0.85);
    font-size: 1.3rem;
  }
}

.fullscreen-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  min-height: 78px;
  padding: 12px clamp(24px, 4vw, 64px);
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.5vw, 22px);
  background: rgba(8, 10, 12, 0.22);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);

  > button {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
  }

  .fullscreen-play {
    width: 40px;
    height: 40px;
    flex-basis: 40px;
  }
}

.fullscreen-seek {
  flex: 1 1 auto;
  min-width: 160px;
}

.fullscreen-volume {
  width: 34px;
  flex: 0 0 34px;

  button {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
  }
}

.queue-layer {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.16);
}

.queue-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(420px, 100%);
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  color: rgba(245, 245, 245, 0.94);
  background: rgba(13, 13, 15, 0.97);
  box-shadow: -20px 0 70px rgba(0, 0, 0, 0.3);

  > header {
    height: 64px;
    padding: 0 17px;
    display: flex;
    align-items: center;
    justify-content: space-between;

    h2 {
      font-size: 1.12rem;
    }

    button {
      width: 34px;
      height: 34px;
    }
  }
}

.queue-content {
  min-height: 0;
  padding: 8px 16px 30px;
  overflow-y: auto;
  scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
  scrollbar-width: thin;
}

.queue-section {
  margin-bottom: 30px;

  h3 {
    margin-bottom: 12px;
    font-size: 0.98rem;
  }
}

.queue-tracks {
  display: grid;
  gap: 4px;
}

.queue-track {
  width: 100%;
  min-width: 0;
  min-height: 62px;
  padding: 6px 8px 6px 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  border-radius: 7px;
  text-align: left;

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.06);
    opacity: 1;
  }

  &.is-current strong {
    color: #16d66b;
  }

  img,
  .queue-cover-placeholder {
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    border-radius: 5px;
  }

  img {
    object-fit: cover;
  }

  .queue-cover-placeholder {
    display: grid;
    place-items: center;
    color: rgba(245, 245, 245, 0.45);
    background: rgba(255, 255, 255, 0.06);
  }
}

.queue-track-info {
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: rgba(245, 245, 245, 0.95);
    font-size: 0.95rem;
    font-weight: 560;
  }

  small {
    color: rgba(245, 245, 245, 0.58);
    font-size: 0.78rem;
  }
}

.playing-bars {
  height: 20px;
  display: flex;
  align-items: flex-end;
  gap: 2px;

  i {
    width: 2px;
    height: 60%;
    border-radius: 2px;
    background: #16d66b;
    animation: playing-bar 0.8s ease-in-out infinite alternate;

    &:nth-child(2) {
      animation-delay: -0.3s;
    }

    &:nth-child(3) {
      animation-delay: -0.55s;
    }
  }
}

.empty-queue {
  color: rgba(245, 245, 245, 0.45);
  font-size: 0.86rem;
}

@keyframes playing-bar {
  from {
    height: 25%;
  }
  to {
    height: 100%;
  }
}

.fullscreen-fade-enter-active,
.fullscreen-fade-leave-active {
  transition: opacity 0.3s ease;
}

.fullscreen-fade-enter-from,
.fullscreen-fade-leave-to {
  opacity: 0;
}

.queue-slide-enter-active,
.queue-slide-leave-active {
  transition: background-color 0.28s ease;

  .queue-panel {
    transition: transform 0.28s ease;
  }
}

.queue-slide-enter-from,
.queue-slide-leave-to {
  background-color: transparent;

  .queue-panel {
    transform: translateX(100%);
  }
}

@media (max-width: 900px) {
  .fullscreen-content {
    width: min(720px, calc(100% - 42px));
    height: calc(100% - 98px);
    padding-top: 58px;
  }

  .fullscreen-header {
    width: 100%;
    margin-bottom: 18px;
  }

  .fullscreen-main {
    grid-template-columns: minmax(180px, 40%) minmax(240px, 60%);
    gap: 34px;
  }

  .fullscreen-controls {
    min-height: 72px;
    padding-inline: 20px;
  }
}

@media (max-width: 620px) {
  .fullscreen-content {
    width: calc(100% - 32px);
    height: calc(100% - 128px);
    padding-top: 62px;
  }

  .fullscreen-header {
    h1 {
      font-size: 1.35rem;
    }

    p {
      max-height: 40px;
      overflow: hidden;
    }
  }

  .content-tabs {
    margin-top: 12px;
  }

  .fullscreen-main {
    grid-template-columns: 1fr;
    align-content: start;
    gap: 18px;
  }

  .cover-area {
    width: min(48vw, 190px);
    justify-self: center;
  }

  .lyrics-panel {
    width: 100%;
    height: 32vh;
    padding: 30% 0;
    text-align: center;
  }

  .lyric-line {
    margin-bottom: 14px;
  }

  .fullscreen-controls {
    min-height: 120px;
    padding: 10px 16px 16px;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 14px;
  }

  .fullscreen-seek {
    order: -1;
    width: 100%;
    flex-basis: 100%;
  }

  .fullscreen-volume {
    width: 30px;
  }
}

@media (prefers-reduced-motion: reduce) {
  button,
  .volume-popover,
  .lyric-line,
  .fullscreen-fade-enter-active,
  .fullscreen-fade-leave-active,
  .compact-seek-slide-enter-active,
  .compact-seek-slide-leave-active,
  .queue-slide-enter-active,
  .queue-slide-leave-active,
  .queue-slide-enter-active .queue-panel,
  .queue-slide-leave-active .queue-panel {
    transition: none;
  }

  .playing-bars i {
    animation: none;
  }
}
</style>
