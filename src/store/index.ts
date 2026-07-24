import { defineStore } from "pinia";
import type { MainState } from "@/typings/store";
import { nextTick } from "vue";
import { removeStorageKeys, SETTINGS_RESET_EVENT, STORAGE_KEYS } from "@/utils/storageKeys";

export const storeState: MainState = {
  // 这些变量，非有能力的开发者请只操作【开关】项来实现个性化的默认设置，其余变量勿动！
  imgLoadStatus: false, // 【状态】壁纸加载状态
  innerWidth: null as number | null, // 【状态】当前窗口宽度
  coverType: 0 as number, // 【开关】壁纸种类
  sBGCount: null as string | null, // 【状态】使用内置壁纸时用于临时指定壁纸的接口
  /* 0 不切换，1 等待 15 秒，2 等待 30 秒，3 等待 45 秒。 */
  autoBGSwitchInterval : 2 as number, // 【开关】自动切换壁纸设置
  wallpaperLocalId: null as number | null, // 【开关】默认本地壁纸 ID
  wallpaperMaxId: 0, // 【状态】当前设备本地壁纸数量
  effectsMode: "auto", // 【开关】季节特效模式
  selectedEffects: [] as Array<"snow" | "firefly" | "lantern">, // 【开关】手动季节特效
  msgNameShow: false, // 【开关】信息区域显示自定义名而非原本的 URL
  siteStartShow: true, // 【开关】建站日期显示
  musicClick: true, // 【开关】音乐链接是否跳转
  musicBoxOpenState: false, // 【状态】音乐盒子开启状态
  musicIsOk: false, // 【状态】音乐是否加载完成
  musicVolume: 0.3 as number, // 【开关】音乐音量
  musicOpenState: false, // 【状态】音乐面板开启状态
  backgroundShow: false, // 【状态】壁纸展示状态
  boxOpenState: false, // 【状态】盒子开启状态
  mobileOpenState: false, // 【状态】移动端开启状态
  mobileFuncState: false, // 【状态】移动端功能区开启状态
  setOpenState: false, // 【状态】设置页面开启状态
  setV: false, // 【状态】开发者模式
  playerStatus: "idle", // 【状态】播放器状态
  playerHasStarted: false, // 【状态】当前会话是否已经开始播放
  playerError: null as string | null, // 【状态】播放器错误
  playerCanplay: false, // 【状态】当前音乐是否完成加载
  playerTitle: null as string | null, // 【缓存】当前播放歌曲名
  playerArtist: null as string | null, // 【缓存】当前播放歌手名
  playerAlbum: null as string | null, // 【缓存】当前播放专辑名
  playerLrc: [[true, 1, 0, 0, ""]], // 【缓存】当前播放歌词
  playerLrcShow: true, // 【开关】是否显示底栏歌词
  footerBlur: true, // 【开关】底栏模糊
  footerProgressBar: true, // 【开关】是否显示底栏进度条
  playerAutoplay: true, // 【开关】是否自动播放
  playerOrder: "shuffle", // 【开关】播放顺序 "list", "single", "shuffle"
  playerKeyboardShortcuts: true, // 【开关】全局播放器快捷键
  playerTrLrc: false, // 【开关】逐行歌词调用翻译歌词开关
  playerDWRCShow: true, // 【开关】逐字歌词解析总开关
  playerDWRCShowPro: true, // 【开关】逐字效果增强开关
  playerRMMetadata: false, // 【开关】移除歌词中的元数据
  playerCurrentTime: 0, // 【缓存】当前歌曲已播放时间
  playerDuration: 0, // 【缓存】当前歌曲总时长
  dwrcIndex: -1 as number | null, // 【缓存】逐字歌词进度存储
  dwrcTemp: [], // 【缓存】逐字歌词
  dwrcEnable: true, // 【状态】调用逐字歌词
  dwrcLoading: false, // 【状态】逐字歌词加载
  lyricSeekVersion: 0, // 【状态】歌词跳转版本，用于重置动画
  showFirefly: false, // 【状态】萤火虫特效
  showSnowfall: false, // 【状态】雪花特效
  showLantern: false, // 【状态】灯笼特效
  theme: "system", // 【开关】主题，"system"/"time"/"bg"/"light"/"dark"。
};

export const mainStore = defineStore("main", {
  state: (): MainState => (
    // 主要状态，使用这个方法是为了添加重置功能..烦诶，pinia 你还得努力啊，你不努力那...那..那就不努力叭..哼唧（）
    JSON.parse(
      JSON.stringify(storeState)
    )
  ),
  getters: {
    // 获取歌词
    getPlayerLrc(state) {
      return state.playerLrc;
    },
    // 获取歌曲信息
    getPlayerData(state) {
      return {
        name: state.playerTitle,
        artist: state.playerArtist,
        album: state.playerAlbum,
      };
    },
    // 获取页面宽度
    getInnerWidth(state) {
      return state.innerWidth;
    },
  },
  actions: {
    // 更改当前页面宽度
    setInnerWidth(value: number) {
      this.innerWidth = value;
      if (value >= 720) {
        this.mobileOpenState = false;
        this.mobileFuncState = false;
      }
    },
    // 更改播放器状态
    setPlayerStatus(value: MainState["playerStatus"]) {
      this.playerStatus = value;
      if (value === "playing") {
        this.playerHasStarted = true;
        this.playerError = null;
      }
      if (value === "error") {
        this.playerCanplay = false;
      }
    },
    // 更改音乐加载状态
    setPlayerCanplay(value: boolean) {
      this.playerCanplay = value;
    },
    // 更改歌词
    setPlayerLrc(value: MainState["playerLrc"]) {
      this.playerLrc = value;
    },
    // 更改歌曲数据
    setPlayerData(title: string, artist: string, album: string | null = null) {
      this.playerTitle = title;
      this.playerArtist = artist;
      this.playerAlbum = album;
    },
    // 更改壁纸加载状态
    setImgLoadStatus(value: boolean) {
      this.imgLoadStatus = value;
    },
    // 使用内置壁纸时用于临时指定壁纸的接口
    setSBGCount(value: string | number) {
      const wallpaperId = Number(value);
      if (this.coverType !== 0 || !Number.isInteger(wallpaperId) || wallpaperId < 1 || wallpaperId > this.wallpaperMaxId) {
        return false;
      }
      this.sBGCount = String(wallpaperId);
      return true;
    },
    setWallpaperLocalId(value: string | number | null) {
      if (value === null || value === "") {
        this.wallpaperLocalId = null;
        return true;
      }
      const wallpaperId = Number(value);
      if (!Number.isInteger(wallpaperId) || wallpaperId < 1 || wallpaperId > this.wallpaperMaxId) {
        return false;
      }
      this.wallpaperLocalId = wallpaperId;
      return true;
    },
    // 重置所有设置
    async resetStore() {
      const persistedSettings = [
        "coverType", "wallpaperLocalId", "autoBGSwitchInterval", "musicVolume",
        "siteStartShow", "musicClick", "playerLrcShow", "footerBlur",
        "footerProgressBar", "playerAutoplay", "playerOrder", "playerKeyboardShortcuts",
        "playerTrLrc", "playerDWRCShow", "playerDWRCShowPro", "playerRMMetadata", "effectsMode",
        "selectedEffects", "theme", "setV", "msgNameShow",
      ] as const satisfies ReadonlyArray<keyof MainState>;
      const defaults = Object.fromEntries(
        persistedSettings.map((key) => [key, structuredClone(storeState[key])]),
      ) as Partial<MainState>;
      this.$patch(defaults);
      await nextTick();
      try {
        removeStorageKeys(localStorage, [
          STORAGE_KEYS.pinia,
          STORAGE_KEYS.weatherLocation,
          STORAGE_KEYS.weatherCache,
        ]);
        removeStorageKeys(sessionStorage, [STORAGE_KEYS.pinia]);
        window.dispatchEvent(new Event(SETTINGS_RESET_EVENT));
      } catch (error) {
        console.error("清理本项目设置失败：", error);
        throw error;
      }
    },
  },
  persist: [
    // 未存在这里的变量，刷新页面就会恢复默认值，主要用于状态
    {
      storage: localStorage,
      pick: [
        // 持久性存储，这里的变量永久存储于浏览器，用于存储用户的自定义设置
        'coverType',
        'wallpaperLocalId',
        'autoBGSwitchInterval',
        'musicVolume',
        'siteStartShow',
        'musicClick',
        'playerLrcShow',
        'footerBlur',
        'footerProgressBar',
        'playerAutoplay',
        'playerOrder',
        'playerKeyboardShortcuts',
        'playerTrLrc',
        'playerDWRCShow',
        'playerDWRCShowPro',
        'playerRMMetadata',
        'effectsMode',
        'selectedEffects',
        'theme',
      ],
    },
    {
      storage: sessionStorage,
      pick: [
        // 会话性存储，这里的变量在重新打开页面时恢复默认值，多个窗口不互通，用于存储一些特殊的仅本次生效的设置
        'setV',
        'msgNameShow'
      ],
    },
  ],
});
