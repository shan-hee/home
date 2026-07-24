export const STORAGE_KEYS = {
  pinia: "main",
  weatherLocation: "home:weather:location:v1",
  weatherCache: "home:weather:cache:v1",
} as const;

export const SETTINGS_RESET_EVENT = "home:settings-reset";

export const removeStorageKeys = (storage: Storage, keys: readonly string[]) => {
  keys.forEach((key) => storage.removeItem(key));
};
