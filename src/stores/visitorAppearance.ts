import { create } from "zustand";
import { array, object, picklist, safeParse } from "valibot";
import type { BackgroundEffect, BackgroundEffectMode, ThemePreference } from "@/typings/store";

const STORAGE_KEY = "home:visitor-appearance:v1";
const effectValues = ["snow", "firefly", "lantern", "meteor"] as const;
const appearanceSchema = object({
  theme: picklist(["system", "time", "light", "dark"]),
  effectsMode: picklist(["auto", "off", "manual"]),
  selectedEffects: array(picklist(effectValues)),
});

interface AppearanceValues {
  theme: ThemePreference;
  effectsMode: BackgroundEffectMode;
  selectedEffects: BackgroundEffect[];
}

interface AppearanceStore extends AppearanceValues {
  update: (patch: Partial<AppearanceValues>) => void;
}

const defaults: AppearanceValues = {
  theme: "system",
  effectsMode: "auto",
  selectedEffects: [],
};

const loadAppearance = (): AppearanceValues => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = safeParse(appearanceSchema, JSON.parse(raw) as unknown);
    if (!parsed.success) return defaults;
    return {
      theme: parsed.output.theme,
      effectsMode: parsed.output.effectsMode,
      selectedEffects: [...new Set(parsed.output.selectedEffects)],
    };
  } catch {
    return defaults;
  }
};

const persistAppearance = (value: AppearanceValues) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 当前页面内的偏好仍然有效。
  }
};

export const useVisitorAppearanceStore = create<AppearanceStore>((set, get) => ({
  ...loadAppearance(),
  update: (patch) => {
    const next = { ...get(), ...patch };
    const value: AppearanceValues = {
      theme: next.theme,
      effectsMode: next.effectsMode,
      selectedEffects: [...new Set(next.selectedEffects)],
    };
    set(value);
    persistAppearance(value);
  },
}));
