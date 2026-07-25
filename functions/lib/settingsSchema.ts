import { ApiError } from "./api";

export const SETTING_KEYS = [
  "theme",
  "coverType",
  "wallpaperLocalId",
  "autoBGSwitchInterval",
  "effectsMode",
  "selectedEffects",
  "siteStartShow",
  "footerPlayerShow",
  "footerBlur",
  "musicVolume",
  "playerAutoplay",
  "playerOrder",
  "playerKeyboardShortcuts",
  "weatherLocation",
] as const;

export type SettingKey = typeof SETTING_KEYS[number];

const enumValue = <Value extends string>(value: unknown, allowed: readonly Value[]) => {
  if (typeof value !== "string" || !allowed.includes(value as Value)) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "设置值无效");
  }
  return value as Value;
};

const booleanValue = (value: unknown) => {
  if (typeof value !== "boolean") throw new ApiError(400, "INVALID_SETTING_VALUE", "设置值无效");
  return value;
};

const integerValue = (value: unknown, allowed: readonly number[]) => {
  if (!Number.isInteger(value) || !allowed.includes(value as number)) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "设置值无效");
  }
  return value as number;
};

const optionalWallpaperId = (value: unknown) => {
  if (value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 200) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "壁纸 ID 无效");
  }
  return value as number;
};

const volume = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "音量设置无效");
  }
  return Math.round(value * 1000) / 1000;
};

const effects = (value: unknown) => {
  const allowed = ["snow", "firefly", "lantern", "meteor"] as const;
  if (!Array.isArray(value) || value.length > allowed.length) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "背景特效设置无效");
  }
  const normalized = value.map((item) => enumValue(item, allowed));
  return [...new Set(normalized)];
};

const weatherLocation = (value: unknown) => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "天气城市设置无效");
  }
  const location = value as Record<string, unknown>;
  if (Object.keys(location).some((key) => !["name", "latitude", "longitude"].includes(key))) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "天气城市设置包含未知字段");
  }
  const name = typeof location.name === "string" ? location.name.trim() : "";
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (
    !name || name.length > 80
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    throw new ApiError(400, "INVALID_SETTING_VALUE", "天气城市设置无效");
  }
  return {
    name,
    latitude: Number(latitude.toFixed(2)),
    longitude: Number(longitude.toFixed(2)),
  };
};

const validators: Record<SettingKey, (value: unknown) => unknown> = {
  theme: (value) => enumValue(value, ["system", "time", "bg", "light", "dark"] as const),
  coverType: (value) => integerValue(value, [0, 1, 2, 3]),
  wallpaperLocalId: optionalWallpaperId,
  autoBGSwitchInterval: (value) => integerValue(value, [0, 1, 2, 3]),
  effectsMode: (value) => enumValue(value, ["auto", "off", "manual"] as const),
  selectedEffects: effects,
  siteStartShow: booleanValue,
  footerPlayerShow: booleanValue,
  footerBlur: booleanValue,
  musicVolume: volume,
  playerAutoplay: booleanValue,
  playerOrder: (value) => enumValue(value, ["list", "single", "shuffle"] as const),
  playerKeyboardShortcuts: booleanValue,
  weatherLocation,
};

export const isSettingKey = (value: string): value is SettingKey => {
  return (SETTING_KEYS as readonly string[]).includes(value);
};

export const normalizeSetting = (key: string, value: unknown) => {
  if (!isSettingKey(key)) {
    throw new ApiError(400, "UNKNOWN_SETTING_KEY", "设置项不受支持");
  }
  return { key, value: validators[key](value) };
};
