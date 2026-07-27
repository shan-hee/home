import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MainState } from "@/typings/store";
import { validateMainPatch } from "@/store/plugins/validation";
import { loadPlayerPreferences } from "@/stores/playerPreferences";

const playerPreferences = loadPlayerPreferences();

export const storeState: MainState = {
  imgLoadStatus: false,
  innerWidth: null,
  musicBoxOpenState: false,
  musicIsOk: false,
  musicVolume: playerPreferences?.musicVolume ?? 0.3,
  boxOpenState: false,
  mobileOpenState: false,
  mobileFuncState: false,
  playerStatus: "idle",
  playerHasStarted: false,
  playerError: null,
  playerCanplay: false,
  playerTitle: null,
  playerArtist: null,
  playerLyric: "",
  footerPlayerShow: false,
  playerOrder: playerPreferences?.playerOrder ?? "shuffle",
  playerCurrentTime: 0,
  playerDuration: 0,
  showFirefly: false,
  showSnowfall: false,
  showLantern: false,
  showMeteor: false,
};

export interface MainActions {
  patch: (patch: Partial<MainState>) => void;
  setSetting: <Key extends keyof MainState>(key: Key, value: MainState[Key]) => void;
  setInnerWidth: (value: number) => void;
  setPlayerStatus: (value: MainState["playerStatus"]) => void;
  setPlayerCanplay: (value: boolean) => void;
  setPlayerLyric: (value: string) => void;
  setPlayerData: (title: string, artist: string) => void;
  setImgLoadStatus: (value: boolean) => void;
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
  setPlayerData: (title, artist) => set({
    playerTitle: title,
    playerArtist: artist,
  }),
  setImgLoadStatus: (value) => set({ imgLoadStatus: value }),
})));
