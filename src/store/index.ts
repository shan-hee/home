import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MainState } from "@/typings/store";
import { validateMainPatch } from "@/store/plugins/validation";
import { removeStorageKeys, SETTINGS_RESET_EVENT, STORAGE_KEYS } from "@/utils/storageKeys";

export const storeState: MainState = {
  imgLoadStatus: false,
  innerWidth: null,
  coverType: 0,
  sBGCount: null,
  autoBGSwitchInterval: 2,
  wallpaperLocalId: null,
  wallpaperMaxId: 0,
  effectsMode: "auto",
  selectedEffects: [],
  msgNameShow: false,
  siteStartShow: true,
  musicBoxOpenState: false,
  musicIsOk: false,
  musicVolume: 0.3,
  boxOpenState: false,
  mobileOpenState: false,
  mobileFuncState: false,
  setV: false,
  playerStatus: "idle",
  playerHasStarted: false,
  playerError: null,
  playerCanplay: false,
  playerTitle: null,
  playerArtist: null,
  playerAlbum: null,
  playerLyric: "",
  footerPlayerShow: false,
  footerBlur: true,
  playerAutoplay: false,
  playerOrder: "shuffle",
  playerKeyboardShortcuts: true,
  weatherLocation: null,
  playerCurrentTime: 0,
  playerDuration: 0,
  showFirefly: false,
  showSnowfall: false,
  showLantern: false,
  showMeteor: false,
  theme: "system",
};

export interface MainActions {
  patch: (patch: Partial<MainState>) => void;
  setSetting: <Key extends keyof MainState>(key: Key, value: MainState[Key]) => void;
  setInnerWidth: (value: number) => void;
  setPlayerStatus: (value: MainState["playerStatus"]) => void;
  setPlayerCanplay: (value: boolean) => void;
  setPlayerLyric: (value: string) => void;
  setPlayerData: (title: string, artist: string, album?: string | null) => void;
  setImgLoadStatus: (value: boolean) => void;
  setSBGCount: (value: string | number) => boolean;
  setWallpaperLocalId: (value: string | number | null) => boolean;
  resetStore: () => Promise<void>;
}

export type MainStore = MainState & MainActions;

const cloneDefaults = () => structuredClone(storeState);

export const useMainStore = create<MainStore>()(subscribeWithSelector((set, get) => ({
  ...cloneDefaults(),
  patch: (patch) => set((state) => validateMainPatch(patch, state)),
  setSetting: (key, value) => get().patch({ [key]: value } as Partial<MainState>),
  setInnerWidth: (value) => set({
    innerWidth: value,
    ...(value >= 720 ? { mobileOpenState: false, mobileFuncState: false } : {}),
  }),
  setPlayerStatus: (value) => set((state) => ({
    playerStatus: value,
    ...(value === "playing" ? { playerHasStarted: true, playerError: null } : {}),
    ...(value === "error" ? { playerCanplay: false } : {}),
  })),
  setPlayerCanplay: (value) => set({ playerCanplay: value }),
  setPlayerLyric: (value) => set({ playerLyric: value }),
  setPlayerData: (title, artist, album = null) => set({
    playerTitle: title,
    playerArtist: artist,
    playerAlbum: album,
  }),
  setImgLoadStatus: (value) => set({ imgLoadStatus: value }),
  setSBGCount: (value) => {
    const state = get();
    const wallpaperId = Number(value);
    if (state.coverType !== 0 || !Number.isInteger(wallpaperId) || wallpaperId < 1 || wallpaperId > state.wallpaperMaxId) {
      return false;
    }
    set({ sBGCount: String(wallpaperId) });
    return true;
  },
  setWallpaperLocalId: (value) => {
    if (value === null || value === "") {
      set({ wallpaperLocalId: null });
      return true;
    }
    const wallpaperId = Number(value);
    if (!Number.isInteger(wallpaperId) || wallpaperId < 1 || wallpaperId > get().wallpaperMaxId) return false;
    set({ wallpaperLocalId: wallpaperId });
    return true;
  },
  resetStore: async () => {
    const persistedSettings = [
      "coverType", "wallpaperLocalId", "autoBGSwitchInterval", "musicVolume",
      "siteStartShow", "footerPlayerShow", "footerBlur", "playerAutoplay",
      "playerOrder", "playerKeyboardShortcuts", "effectsMode", "selectedEffects",
      "theme", "setV", "msgNameShow", "weatherLocation",
    ] as const satisfies ReadonlyArray<keyof MainState>;
    const defaults = Object.fromEntries(
      persistedSettings.map((key) => [key, structuredClone(storeState[key])]),
    ) as Partial<MainState>;
    get().patch(defaults);
    await Promise.resolve();
    removeStorageKeys(localStorage, [STORAGE_KEYS.weatherCache]);
    window.dispatchEvent(new Event(SETTINGS_RESET_EVENT));
  },
})));
