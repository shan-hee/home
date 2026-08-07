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
  playerPlayIntent: false,
  playerHasStarted: false,
  playerError: null,
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
  setPlayerStatus: (value) => set((state) => {
    let playerPlayIntent = state.playerPlayIntent;
    if (value === "playing") playerPlayIntent = true;
    else if (value === "paused" || value === "ready" || value === "error") playerPlayIntent = false;
    const playingStateCurrent = value !== "playing" || (state.playerHasStarted && state.playerError === null);
    if (state.playerStatus === value && state.playerPlayIntent === playerPlayIntent && playingStateCurrent) return state;
    return {
      playerStatus: value,
      playerPlayIntent,
      ...(value === "playing" ? { playerHasStarted: true, playerError: null } : {}),
    };
  }),
})));
