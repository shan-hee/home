import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MainState } from "@/typings/store";
import { loadPlayerPreferences } from "@/stores/playerPreferences";

const playerPreferences = loadPlayerPreferences();

const initialState: MainState = {
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

interface MainActions {
  patch: (patch: Partial<MainState>) => void;
  setInnerWidth: (value: number) => void;
  setPlayerStatus: (value: MainState["playerStatus"]) => void;
}

type MainStore = MainState & MainActions;

export const useMainStore = create<MainStore>()(subscribeWithSelector((set) => ({
  ...initialState,
  patch: (patch) => set(patch),
  setInnerWidth: (value) => set({
    innerWidth: value,
    ...(value >= 720 ? { mobileOpenState: false, mobileFuncState: false } : {}),
  }),
  setPlayerStatus: (value) => set((state) => ({
    playerStatus: value,
    ...(value === "playing" ? { playerHasStarted: true, playerError: null } : {}),
    ...(value === "error" ? { playerCanplay: false } : {}),
  })),
})));
