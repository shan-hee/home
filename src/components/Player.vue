<template>
  <APlayer
    v-if="playList[0]"
    ref="player"
    :audio="playList"
    :autoplay="store.playerAutoplay"
    :theme="theme"
    :autoSwitch="false"
    :loop="aplayerLoop"
    :order="aplayerOrder"
    :volume="volume"
    :showLrc="true"
    :listFolded="listFolded"
    :listMaxHeight="listMaxHeight"
    :noticeSwitch="false"
    @play="onPlay"
    @pause="onPause"
    @Loadstart="onLoadStart"
    @timeupdate="onTimeUp"
    @error="loadMusicError"
    @canplay="onCanplay"
    @waiting="onWaiting"
  />
</template>

<script setup lang="ts">
import { MusicOne, PlayWrong } from "@icon-park/vue-next";
import { getPlayerList } from "@/api";
import type { PlaylistItem } from "@/api";
import { mainStore } from "@/store";
import APlayer from "@worstone/vue-aplayer";

const store = mainStore();

type APlayerOrder = "list" | "random";
type APlayerLoop = "all" | "one" | "none";

interface APlayerController {
  index: number;
  order: APlayerOrder;
  loop: APlayerLoop;
  audio: PlaylistItem[];
  lyrics: Array<Array<[number, string]>>;
  lyricIndex: number;
}

type PlayerInstance = {
  aplayer: APlayerController;
  audioRef: HTMLAudioElement;
  audioStatus: {
    duration: number;
    playedTime: number;
  };
  toggle: () => void;
  seek: (time: number) => void;
  skipBack: () => void;
  skipForward: () => void;
  switchList: (index: number) => void;
  play: () => void;
  pause: () => void;
};

const emit = defineEmits<{
  playlistLoaded: [tracks: PlaylistItem[]];
  trackChanged: [index: number];
}>();

// 获取播放器 DOM
const player = ref<PlayerInstance | null>(null);

// 歌曲播放列表
const playList = ref<PlaylistItem[]>([]);

// 歌曲播放项
const playIndex = ref(0);

// 配置项
const props = defineProps({
  // 主题色
  theme: {
    type: String,
    default: "#efefef",
  },
  // 默认音量
  volume: {
    type: Number,
    default: 0.7,
    validator: (value: number) => {
      return value >= 0 && value <= 1;
    },
  },
  // 列表是否默认折叠
  listFolded: {
    type: Boolean,
    default: false,
  },
  // 列表最大高度
  listMaxHeight: {
    type: Number,
    default: 420,
  },
});

const listHeight = computed(() => {
  return props.listMaxHeight + "px";
});

const aplayerOrder = computed<APlayerOrder>(() => {
  return store.playerOrder === "shuffle" ? "random" : "list";
});

const aplayerLoop = computed<APlayerLoop>(() => {
  return store.playerOrder === "single" ? "one" : "all";
});

// 监听播放顺序
watch(
  () => store.playerOrder,
  () => {
    if (!player.value) return;
    player.value.aplayer.order = aplayerOrder.value;
    player.value.aplayer.loop = aplayerLoop.value;
  },
);

// 初始化播放器
const setupMediaSession = () => {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: "Loading..." });
  navigator.mediaSession.setActionHandler("play", () => player.value?.play());
  navigator.mediaSession.setActionHandler("pause", () => player.value?.pause());
  navigator.mediaSession.setActionHandler("nexttrack", () => changeSong(1));
  navigator.mediaSession.setActionHandler("previoustrack", () => changeSong(0));
  navigator.mediaSession.setActionHandler("seekbackward", () => seekbackward(5));
  navigator.mediaSession.setActionHandler("seekforward", () => seekforward(5));
};

const loadPlaylist = async () => {
  store.setPlayerStatus("loading");
  store.musicIsOk = false;
  try {
    const result = await getPlayerList();
    if (result.length === 0) {
      throw new Error("播放列表为空");
    }
    playList.value = result;
    emit("playlistLoaded", [...result]);
    store.musicIsOk = true;
    store.playerError = null;
    store.setPlayerStatus("ready");
    setupMediaSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "播放器加载失败";
    console.error("播放器加载失败：", error);
    store.playerError = message;
    store.setPlayerStatus("error");
    ElMessage({
      message: "播放器加载失败，主页其它功能仍可使用",
      grouping: true,
      icon: h(PlayWrong, {
        theme: "filled",
        fill: "var(--music-aplayer-message-icon-color)",
      }),
    });
  }
};

// 播放
const onPlay = () => {
  if (!player.value) return;
  playIndex.value = player.value.aplayer.index;
  emit("trackChanged", playIndex.value);
  const currentTrack = playList.value[playIndex.value];
  if (!currentTrack) {
    return;
  }
  store.setPlayerStatus("playing");
  // 储存播放器信息
  store.setPlayerData(currentTrack.name, currentTrack.artist, currentTrack.album);
  ElMessage({
    message: store.getPlayerData.name + " - " + store.getPlayerData.artist,
    grouping: true,
    icon: h(MusicOne, {
      theme: "filled",
      fill: "var(--music-aplayer-list-icon-color)",
    }),
  });

  if ("mediaSession" in navigator) {
    // 更新 Media Session 元数据
    navigator.mediaSession.metadata = new MediaMetadata({
      title: store.getPlayerData.name || "",
      artist: store.getPlayerData.artist || "",
      album: store.getPlayerData.album || "",
      artwork: [
        {
          src: playList.value[playIndex.value].cover, // 使用当前播放项的封面图像
          sizes: "512x512",
          type: "image/jpeg",
        },
      ],
    });
    updatePositionState();
  }
};

// 开始播放处理
const onCanplay = () => {
  store.setPlayerCanplay(true);
  if (!store.playerHasStarted && store.playerStatus !== "error") {
    store.setPlayerStatus("ready");
  }
  updatePositionState();
};

const onWaiting = () => {
  store.setPlayerCanplay(false);
};

// 暂停
const onPause = () => {
  if (store.playerStatus === "error") return;
  store.setPlayerStatus(store.playerHasStarted ? "paused" : "ready");
};

// 切换播放暂停事件
const playToggle = () => {
  if (!player.value || !store.musicIsOk) return;
  player.value.toggle();
  updatePositionState();
};

// 切换音量事件
const changeVolume = (value: number) => {
  if (!player.value) return;
  const volume = Math.min(1, Math.max(0, value));
  player.value.audioRef.volume = volume;
};

// 切换上下曲
const changeSong = (type: 0 | 1) => {
  if (!player.value || !store.musicIsOk) return;
  type === 0 ? player.value.skipBack() : player.value.skipForward();
  store.playerCurrentTime = 0;
  store.playerDuration = 0;
  store.setPlayerCanplay(false);
  store.setPlayerStatus("loading");
  nextTick(() => {
    player.value?.play();
  });
};

const selectSong = (index: number) => {
  if (!player.value || !store.musicIsOk || !playList.value[index]) return;
  player.value.switchList(index);
  playIndex.value = index;
  emit("trackChanged", index);
  store.playerCurrentTime = 0;
  store.playerDuration = 0;
  store.setPlayerCanplay(false);
  store.setPlayerStatus("loading");
  nextTick(() => {
    player.value?.play();
  });
};

const seekTo = (time: number) => {
  if (!player.value || !Number.isFinite(time)) return;
  player.value.seek(time);
  store.playerCurrentTime = time;
  updatePositionState();
};

const getCurrentLyrics = () => {
  return player.value?.aplayer.lyrics[playIndex.value] ?? [];
};

// 快退
const seekbackward = (value: number) => {
  if (!player.value) return;
  const currentTime = player.value.audioStatus.playedTime;
  player.value.seek(Math.max(0, currentTime - value));
  updatePositionState();
};

// 快进
const seekforward = (value: number) => {
  if (!player.value) return;
  const duration = player.value.audioStatus.duration;
  const nextTime = player.value.audioStatus.playedTime + value;
  if (Number.isFinite(duration) && nextTime >= duration) {
    changeSong(1);
  } else {
    player.value.seek(nextTime);
  }
  updatePositionState();
};

// 加载音频错误
const loadMusicError = () => {
  store.playerError = "当前歌曲加载失败";
  store.setPlayerStatus("error");
  let notice = "";
  if (playList.value.length > 1) {
    notice = "播放歌曲出现错误，播放器将在 2s 后进行下一首";
  } else {
    notice = "播放歌曲出现错误";
  }
  ElMessage({
    message: notice,
    grouping: true,
    icon: h(PlayWrong, {
      theme: "filled",
      fill: "var(--music-aplayer-message-icon-color)",
      duration: 2000,
    }),
  });
  const currentTrack = player.value?.aplayer.audio[player.value.aplayer.index];
  console.error("播放歌曲失败：", currentTrack?.name || "未知歌曲");
};

function onLoadStart() {
  if (!player.value) return;
  playIndex.value = player.value.aplayer.index;
  emit("trackChanged", playIndex.value);
  const currentTrack = playList.value[playIndex.value];
  if (currentTrack) {
    store.setPlayerData(currentTrack.name, currentTrack.artist, currentTrack.album);
    store.setPlayerLyric(getTrackFallback());
  }
  store.playerCurrentTime = 0;
  store.playerDuration = 0;
  store.setPlayerCanplay(false);
}

const onTimeUp = () => {
  if (!player.value) return;
  const currentTime = player.value.audioRef.currentTime;
  const duration = player.value.audioRef.duration;
  store.playerCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
  store.playerDuration = Number.isFinite(duration) ? duration : 0;
  syncLineLyric(store.playerCurrentTime);
};

function updatePositionState() {
  if (!player.value || !("mediaSession" in navigator)) return;
  const duration = player.value.audioStatus.duration;
  const position = player.value.audioStatus.playedTime;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
  navigator.mediaSession.setPositionState({
    duration,
    position: Math.min(duration, Math.max(0, position)),
  });
}

const getTrackFallback = () => {
  const name = store.getPlayerData.name || "未知歌曲";
  const artist = store.getPlayerData.artist || "未知歌手";
  return `${name} · ${artist}`;
};

const isUsableLineLyric = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  return !["loading", "not available", "歌词加载中..."].includes(value.trim().toLowerCase());
};

const syncLineLyric = (currentTime: number) => {
  if (!player.value) return;
  const lyrics = player.value.aplayer.lyrics[playIndex.value] ?? [];
  let activeIndex = -1;
  let low = 0;
  let high = lyrics.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lyrics[middle][0] <= currentTime + 0.2) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  const rawLyric = activeIndex >= 0 ? lyrics[activeIndex]?.[1] : undefined;
  const nextLyric = isUsableLineLyric(rawLyric)
    ? rawLyric.replace(/&nbsp;/g, " ")
    : getTrackFallback();
  if (nextLyric !== store.playerLyric) store.setPlayerLyric(nextLyric);
};

onMounted(() => {
  void loadPlaylist();
});

onBeforeUnmount(() => {
  if ("mediaSession" in navigator) {
    for (const action of [
      "play",
      "pause",
      "nexttrack",
      "previoustrack",
      "seekbackward",
      "seekforward",
    ] as MediaSessionAction[]) {
      navigator.mediaSession.setActionHandler(action, null);
    }
  }
});

// 暴露子组件方法
defineExpose({
  playToggle,
  changeVolume,
  changeSong,
  selectSong,
  seekTo,
  getCurrentLyrics,
});
</script>

<style lang="scss" scoped>
.aplayer {
  width: 80%;
  border-radius: 6px;
  font-family: "MiSans VF", sans-serif !important;

  :deep(.aplayer-body) {
    background-color: transparent;

    .aplayer-pic {
      display: none;
    }

    .aplayer-info {
      margin-left: 0;
      background-color: var(--music-player-list-bgc);
      border-color: transparent !important;

      .aplayer-music {
        flex-grow: initial;
        margin-bottom: 2px;
        overflow: initial;

        .aplayer-title {
          font-size: 1rem;
          margin-right: 6px;
        }

        .aplayer-author {
          color: var(--text-color);
        }
      }

      .aplayer-lrc {
        text-align: left;
        margin: 7px 0 6px 6px;
        height: 44px;
        -webkit-mask: linear-gradient(
          #fff 15%,
          #fff 85%,
          hsla(0deg, 0%, 100%, 0.6) 90%,
          hsla(0deg, 0%, 100%, 0)
        );
        mask: linear-gradient(
          #fff 15%,
          #fff 85%,
          hsla(0deg, 0%, 100%, 0.6) 90%,
          hsla(0deg, 0%, 100%, 0)
        );

        &::before,
        &::after {
          display: none;
        }

        p {
          color: var(--text-color);
        }

        .aplayer-lrc-current {
          font-size: 0.95rem;
          margin-bottom: 4px !important;
        }
      }

      .aplayer-controller {
        display: none;
      }
    }
  }

  :deep(.aplayer-list) {
    margin-top: 6px;
    height: v-bind(listHeight);
    background-color: transparent;

    ol {
      &::-webkit-scrollbar-track {
        background-color: transparent;
      }

      li {
        border-color: transparent;

        &.aplayer-list-light {
          background: var(--music-player-list-bgc);
          border-radius: 6px;
        }

        &:hover {
          background: var(--music-player-list-hover-bgc) !important;
          border-radius: 6px !important;
        }

        .aplayer-list-index,
        .aplayer-list-author {
          color: var(--text-color);
        }
      }
    }
  }
}
</style>
