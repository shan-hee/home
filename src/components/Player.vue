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
import type { PlayerLyricItem, WordLyricLine, WordLyricToken } from "@/typings/store";
import APlayer from "@worstone/vue-aplayer";
import { decodeDWQYRC } from "@/utils/decodeDWQYRC";

const store = mainStore();
const nowLineIndex = ref(-1);
let lyricAnimationFrame: number | null = null;
let lyricRequestController: AbortController | null = null;
let lyricRequestSequence = 0;

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
  setVolume: (volume: number, triggerEvent: boolean) => void;
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

const parseWordLyrics = (source: string): WordLyricLine[] => {
  const decoded = decodeDWQYRC(source, store.playerRMMetadata) as WordLyricLine[];
  let previousLineStart = -1;
  const valid = decoded.every(([lineStart, lineDuration, words]) => {
    if (
      !Number.isFinite(lineStart) ||
      !Number.isFinite(lineDuration) ||
      lineStart < previousLineStart ||
      lineDuration < 0
    ) {
      return false;
    }
    previousLineStart = lineStart;
    return (
      words.length > 0 &&
      words.every(([[wordStart, wordDuration], text]) => {
        const plainText = text.replace(/&nbsp;/g, " ").trim();
        return (
          Number.isFinite(wordStart) &&
          Number.isFinite(wordDuration) &&
          wordStart >= 0 &&
          wordDuration >= 0 &&
          wordStart <= lineStart + lineDuration + 1000 &&
          plainText.length > 0
        );
      })
    );
  });
  if (!valid) {
    throw new Error("逐字歌词时间轴无效");
  }
  return decoded;
};

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
  // 歌曲服务器 ( netease-网易云, tencent-qq音乐 )
  songServer: {
    type: String,
    default: "netease", //'netease' | 'tencent'
  },
  // 播放类型 ( song-歌曲, playlist-播放列表, album-专辑, search-搜索, artist-艺术家 )
  songType: {
    type: String,
    default: "playlist",
  },
  // id
  songId: {
    type: String,
    default: "7452421335",
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
    const result = await getPlayerList(
      props.songServer,
      props.songType,
      props.songId,
      store.playerTrLrc,
    );
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
  startLyricSync();
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
  stopLyricSync();
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
  player.value.setVolume(volume, false);
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
  store.lyricSeekVersion++;
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
  store.lyricSeekVersion++;
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
    store.lyricSeekVersion++;
  }
  updatePositionState();
};

// 加载音频错误
const loadMusicError = () => {
  stopLyricSync();
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

// 音频时间更新事件
const fetchDWRC = async (dwrcUrl: string, targetIndex: number) => {
  lyricRequestController?.abort();
  const controller = new AbortController();
  lyricRequestController = controller;
  const sequence = ++lyricRequestSequence;
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(dwrcUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`逐字歌词接口返回 ${response.status}`);
    const lyrics = parseWordLyrics(await response.text());
    if (sequence !== lyricRequestSequence || targetIndex !== playIndex.value) return;
    store.dwrcIndex = targetIndex;
    store.dwrcTemp = lyrics;
    store.dwrcEnable = true;
  } catch {
    if (sequence !== lyricRequestSequence) return;
    store.dwrcIndex = null;
    store.dwrcTemp = [];
    store.dwrcEnable = false;
  } finally {
    window.clearTimeout(timeoutId);
    if (sequence === lyricRequestSequence) store.dwrcLoading = false;
  }
};

function onLoadStart() {
  // 逐字获取模块
  if (!player.value) return;
  playIndex.value = player.value.aplayer.index;
  emit("trackChanged", playIndex.value);
  const currentTrack = playList.value[playIndex.value];
  if (currentTrack) {
    store.setPlayerData(currentTrack.name, currentTrack.artist, currentTrack.album);
    store.setPlayerLrc([[true, 1, playIndex.value, 0, getTrackFallback()]]);
  }
  store.playerCurrentTime = 0;
  store.playerDuration = 0;
  store.setPlayerCanplay(false);
  nowLineIndex.value = -1;
  try {
    if (player.value == null || player.value.aplayer == null) {
      return;
    }
    if (store.playerDWRCShow != true) {
      store.dwrcEnable = false;
      store.dwrcTemp = [];
      store.dwrcLoading = false;
      return;
    }
    if (store.dwrcIndex == playIndex.value) {
      return;
    }
    store.dwrcTemp = [];
    store.dwrcEnable = false;
    const lyricUrl = player.value.aplayer.audio[player.value.aplayer.index]?.lrc;
    if (!lyricUrl) {
      store.dwrcEnable = false;
      store.dwrcTemp = [];
      store.dwrcLoading = false;
      return;
    }
    const dwrcUrl = `${lyricUrl}${lyricUrl.includes("?") ? "&" : "?"}dwrc=true`;
    store.dwrcLoading = true;
    void fetchDWRC(dwrcUrl, playIndex.value);
  } catch (error) {
    store.dwrcEnable = false;
    store.dwrcTemp = [];
    store.dwrcLoading = false;
    console.error(error);
  }
}

const onTimeUp = () => {
  if (!player.value) return;
  const lastTime = store.playerCurrentTime;
  const newTime = player.value.audioStatus.playedTime;
  if (lastTime && Math.abs(newTime - lastTime) > 1) {
    store.lyricSeekVersion++;
    nowLineIndex.value = -1;
  }
  store.playerCurrentTime = newTime;
  store.playerDuration = player.value.audioStatus.duration;
  if (lyricAnimationFrame === null) syncDWRCLrc();
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

const setLyricsIfChanged = (nextLyrics: typeof store.playerLrc) => {
  const currentLyrics = store.playerLrc;
  const unchanged =
    currentLyrics.length === nextLyrics.length &&
    currentLyrics.every(
      (item, index) =>
        item.length === nextLyrics[index].length &&
        item.every((value, valueIndex) => value === nextLyrics[index][valueIndex]),
    );
  if (!unchanged) store.setPlayerLrc(nextLyrics);
};

function syncDWRCLrc() {
  try {
    if (!player.value || !player.value.aplayer) return;
    const isLineByLine = !store.dwrcEnable || store.dwrcTemp.length === 0 || store.dwrcLoading;
    const now = player.value.audioStatus.playedTime * 1000;
    const lineSwitchNow = now + 200; // 提前 100ms 用于行切换
    if (isLineByLine) {
      const lyrics = player.value.aplayer.lyrics[playIndex.value];
      const playerLyricIndex = player.value.aplayer.lyricIndex;
      const rawLyric = lyrics?.[playerLyricIndex]?.[1];
      if (!isUsableLineLyric(rawLyric)) {
        const lrc = getTrackFallback();
        if (store.playerLrc.length !== 1 || store.playerLrc[0][4] !== lrc) {
          store.setPlayerLrc([[true, 1, 0, 0, lrc]]);
        }
      } else {
        const lrc = rawLyric;
        if (
          store.playerLrc.length !== 1 ||
          store.playerLrc[0][4] !== lrc ||
          store.playerLrc[0][2] !== playerLyricIndex
        ) {
          store.setPlayerLrc([[true, 1, playerLyricIndex, 0, lrc]]);
        }
      }
    } else {
      const dwrc = store.dwrcTemp;
      if (nowLineIndex.value === -1) {
        let foundIndex = -1;
        for (let i = 0; i < dwrc.length; i++) {
          if (dwrc[i][0] <= lineSwitchNow) {
            // now -> lineSwitchNow
            foundIndex = i;
          } else {
            break;
          }
        }
        nowLineIndex.value = foundIndex;
      } else {
        if (
          nowLineIndex.value + 1 < dwrc.length &&
          lineSwitchNow >= dwrc[nowLineIndex.value + 1][0]
        ) {
          // now -> lineSwitchNow
          nowLineIndex.value++;
        }
      }
      const currentLine = nowLineIndex.value !== -1 ? dwrc[nowLineIndex.value] : null;
      let dwrcLyric: typeof store.playerLrc;
      if (currentLine) {
        const fadeOutDuration = 300;
        dwrcLyric = currentLine[2].map<PlayerLyricItem>((it: WordLyricToken) => {
          const [[start, duration], word, line, row] = it;
          const isDuringFadeOut =
            now > start + duration && now <= start + duration + fadeOutDuration;
          const isCurrent = (now >= start && now <= start + duration) || isDuringFadeOut;
          const isSungLyrics = start + duration < now && !isDuringFadeOut;
          const remainingState = isCurrent ? 1 : isSungLyrics ? -1 : duration;
          return [isCurrent, isSungLyrics, line, row, word, duration, remainingState];
        });
      } else {
        dwrcLyric = [[true, 1, 0, 0, getTrackFallback()]];
      }
      setLyricsIfChanged(dwrcLyric);
    }
  } catch (error) {
    console.error("Error in syncDWRCLrc:", error);
  }
}

const runLyricSync = () => {
  if (store.playerStatus !== "playing" || document.hidden) {
    lyricAnimationFrame = null;
    return;
  }
  syncDWRCLrc();
  lyricAnimationFrame = requestAnimationFrame(runLyricSync);
};

const startLyricSync = () => {
  if (lyricAnimationFrame !== null || document.hidden) return;
  lyricAnimationFrame = requestAnimationFrame(runLyricSync);
};

const stopLyricSync = () => {
  if (lyricAnimationFrame === null) return;
  cancelAnimationFrame(lyricAnimationFrame);
  lyricAnimationFrame = null;
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    stopLyricSync();
  } else if (store.playerStatus === "playing") {
    startLyricSync();
  }
};

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  void loadPlaylist();
});

onBeforeUnmount(() => {
  lyricRequestSequence += 1;
  lyricRequestController?.abort();
  stopLyricSync();
  document.removeEventListener("visibilitychange", handleVisibilityChange);
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
