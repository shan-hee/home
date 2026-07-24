<template>
  <!-- 音乐控制面板 -->
  <div
    class="music"
    @mouseenter="volumeShow = true"
    @mouseleave="volumeShow = false"
    v-show="store.musicOpenState"
  >
    <div class="btns">
      <span @click="store.musicBoxOpenState = true">音乐列表</span>
      <span @click="store.musicOpenState = false">回到一言</span>
    </div>
    <div class="control">
      <button type="button" aria-label="上一首" :disabled="!store.musicIsOk" @click="changeMusicIndex(0)">
        <go-start theme="filled" size="30" fill="var(--player-control-color)" />
      </button>
      <Transition name="fade" mode="out-in">
        <button type="button" :key="store.playerStatus" class="state"
          :aria-label="store.playerStatus === 'playing' ? '暂停' : '播放'" :disabled="!store.musicIsOk"
          @click="changePlayState">
          <play-one theme="filled" size="50" fill="var(--player-control-color)"
            v-show="store.playerStatus !== 'playing'" />
          <pause theme="filled" size="50" fill="var(--player-control-color)"
            v-show="store.playerStatus === 'playing'" />
        </button>
      </Transition>
      <button type="button" aria-label="下一首" :disabled="!store.musicIsOk" @click="changeMusicIndex(1)">
        <go-end theme="filled" size="30" fill="var(--player-control-color)" />
      </button>
    </div>
    <div class="menu">
      <div class="name" v-show="!volumeShow">
        <span>{{
          store.getPlayerData.name
            ? store.getPlayerData.name + " - " + store.getPlayerData.artist
            : store.playerError || "播放器准备中"
        }}</span>
      </div>
      <div class="volume" v-show="volumeShow">
        <div class="icon">
          <volume-mute theme="filled" size="24" fill="var(--player-control-color)" v-if="volumeNum == 0" />
          <volume-small
            theme="filled"
            size="24"
            fill="var(--player-control-color)"
            v-else-if="volumeNum > 0 && volumeNum < 0.7"
          />
          <volume-notice theme="filled" size="24" fill="var(--player-control-color)" v-else />
        </div>
        <el-slider v-model="volumeNum" :show-tooltip="false" :min="0" :max="1" :step="0.01" />
      </div>
    </div>
  </div>
  <!-- 音乐列表弹窗 -->
  <Transition name="fade" mode="out-in">
    <div class="music-list" v-show="musicListShow" @click="store.musicBoxOpenState = false">
      <Transition name="zoom">
        <div class="list" v-show="musicListShow" @click.stop>
          <close-one
            class="close"
            theme="filled"
            size="28"
            fill="var(--close-icon-color)"
            @click="store.musicBoxOpenState = false"
          />
          <Player
            ref="playerRef"
            :songServer="playerData.server"
            :songType="playerData.type"
            :songId="playerData.id"
            :volume="volumeNum"
          />
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {
  GoStart,
  PlayOne,
  Pause,
  GoEnd,
  CloseOne,
  VolumeMute,
  VolumeSmall,
  VolumeNotice,
} from "@icon-park/vue-next";
import Player from "@/components/Player.vue";
import { mainStore } from "@/store";
const store = mainStore();

// 音量条数据
const volumeShow = ref(false);
const volumeNum = ref(store.musicVolume ?? 0.7);

// 播放列表数据
const musicListShow = ref(false);
const playerRef = ref<InstanceType<typeof Player> | null>(null);
const playerData = reactive({
  server: envConfig.VITE_SONG_SERVER,
  type: envConfig.VITE_SONG_TYPE,
  id: envConfig.VITE_SONG_ID,
});

// 开启播放列表
const openMusicList = () => {
  musicListShow.value = true;
  playerRef.value?.toggleList();
};

// 关闭播放列表
const closeMusicList = () => {
  musicListShow.value = false;
  playerRef.value?.toggleList();
};

// 音乐播放暂停
const changePlayState = () => {
  playerRef.value?.playToggle();
};

// 音乐上下曲
const changeMusicIndex = (type: 0 | 1) => {
  playerRef.value?.changeSong(type);
};

// 键盘事件处理逻辑
const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
};

const handleKeydown = (event: KeyboardEvent) => {
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
      volumeNum.value = Math.min(1, Number((volumeNum.value + 0.05).toFixed(2)));
      return;
    case "ArrowDown":
      event.preventDefault();
      volumeNum.value = Math.max(0, Number((volumeNum.value - 0.05).toFixed(2)));
      return;
    case "ArrowLeft":
      if (event.repeat) return;
      event.preventDefault();
      changeMusicIndex(0);
      return;
    case "ArrowRight":
      if (event.repeat) return;
      event.preventDefault();
      changeMusicIndex(1);
      return;
  }
};

// 动态注册/移除监听器
const toggleKeyListener = (add: boolean) => {
  if (add) {
    window.addEventListener("keydown", handleKeydown);
  } else {
    window.removeEventListener("keydown", handleKeydown);
  }
};

// 页面焦点检测
const handleFocus = () => toggleKeyListener(true);
const handleBlur = () => toggleKeyListener(false);
const handleVisibilityChange = () => {
  toggleKeyListener(document.visibilityState === "visible");
};

onMounted(() => {
  // 检测页面是否在窗口前端
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // 检测窗口焦点
  window.addEventListener("focus", handleFocus);
  window.addEventListener("blur", handleBlur);

  // 初始化：若页面在前端，则监听
  if (document.visibilityState === "visible") {
    toggleKeyListener(true);
  }
});

onUnmounted(() => {
  // 清理所有监听器
  toggleKeyListener(false);
  window.removeEventListener("focus", handleFocus);
  window.removeEventListener("blur", handleBlur);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});

// 监听音量变化
watch(
  () => volumeNum.value,
  (value) => {
    store.musicVolume = value;
    playerRef.value?.changeVolume(store.musicVolume);
  },
);

watch(
  () => store.musicBoxOpenState,
  (value) => {
    if (value) {
      openMusicList();
    } else {
      closeMusicList();
    };
  },
);
</script>

<style lang="scss" scoped>
.music {
  width: 100%;
  height: 100%;
  background: var(--card-background-color);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border-radius: 6px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  animation: fade 0.5s;
  .btns {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    span {
      background: var(--music-smcard-background-color);
      padding: 2px 8px;
      border-radius: 6px;
      margin: 0px 6px;
      text-overflow: ellipsis;
      overflow-x: hidden;
      white-space: nowrap;
      &:hover {
        background: var(--music-smcard-background-hover-color);
      }
    }
  }
  .control {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-evenly;
    width: 100%;

    button {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      border-radius: 6px;
      color: inherit;
      background: transparent;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--player-slider-main-color);
        outline-offset: 3px;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
    }

    .state {
      transition: opacity 0.1s;
      .i-icon {
        width: 50px;
        height: 50px;
        display: block;
      }
    }
    .i-icon {
      width: 36px;
      height: 36px;
      display: flex;
      border-radius: 6px;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transform: scale(1);
      &:hover {
        background: var(--player-control-hover-bg-color);
      }
      &:active {
        transform: scale(0.95);
      }
    }
  }
  .menu {
    height: 26px;
    width: 100%;
    line-height: 26px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    .name {
      width: 100%;
      text-align: center;
      text-overflow: ellipsis;
      overflow-x: hidden;
      white-space: nowrap;
      animation: fade 0.3s;
    }
    .volume {
      width: 100%;
      padding: 0 12px;
      display: flex;
      align-items: center;
      flex-direction: row;
      animation: fade 0.3s;
      .icon {
        margin-right: 12px;
        span {
          width: 24px;
          height: 24px;
          display: block;
        }
      }
      :deep(*) {
        transition: none;
      }
      :deep(.el-slider__button) {
        transition: 0.3s;
      }
      .el-slider {
        margin-right: 12px;
        --el-slider-main-bg-color: var(--player-slider-main-color);
        --el-slider-runway-bg-color: var(--player-slider-runway-color);
        --el-slider-button-size: 16px;
      }
    }
  }
}
.music-list {
  position: fixed;
  top: 0;
  left: 0;
  margin: auto;
  width: 100%;
  height: 100%;
  background-color: var(--music-player-background-color);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  z-index: 1;
  color: var(--text-color);
  .list {
    color: var(--text-color);
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    top: calc(50% - 300px);
    left: calc(50% - 320px);
    width: 640px;
    height: 600px;
    background-color: var(--music-card-background-color);
    border-radius: 6px;
    z-index: 999;
    @media (max-width: 720px) {
      left: calc(50% - 45%);
      width: 90%;
    }
    .close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      display: block;
      &:hover {
        transform: scale(1.2);
      }
      &:active {
        transform: scale(0.95);
      }
    }
  }
}

// 弹窗动画
.zoom-enter-active {
  animation: zoom 0.4s ease-in-out;
}
.zoom-leave-active {
  animation: zoom 0.3s ease-in-out reverse;
}
@keyframes zoom {
  0% {
    opacity: 0;
    transform: scale(0) translateY(-600px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
