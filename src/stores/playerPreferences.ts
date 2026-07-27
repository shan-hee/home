import { maxValue, minValue, number, object, picklist, pipe, safeParse } from "valibot";
import type { MainState } from "@/typings/store";

const STORAGE_KEY = "home:player-preferences:v1";
const playerPreferencesSchema = object({
  playerOrder: picklist(["list", "single", "shuffle"]),
  musicVolume: pipe(number(), minValue(0), maxValue(1)),
});

export interface PlayerPreferences {
  playerOrder: MainState["playerOrder"];
  musicVolume: number;
}

export const loadPlayerPreferences = (): PlayerPreferences | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeParse(playerPreferencesSchema, JSON.parse(raw) as unknown);
    if (!parsed.success) return null;
    return parsed.output;
  } catch {
    return null;
  }
};

export const savePlayerPreferences = (preferences: PlayerPreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // 当前页面内的播放器设置仍然有效。
  }
};
