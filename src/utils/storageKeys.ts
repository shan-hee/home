export const STORAGE_KEYS = {
  ownerDeviceId: "home:owner:device-id:v1",
  ownerSettings: "home:owner-settings:v1",
  siteContent: "home:site-content:v1",
  weatherCache: "home:weather:cache:v1",
} as const;

export const SETTINGS_RESET_EVENT = "home:settings-reset";

export const removeStorageKeys = (storage: Storage, keys: readonly string[]) => {
  keys.forEach((key) => storage.removeItem(key));
};
