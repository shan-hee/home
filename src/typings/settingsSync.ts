import type { MainState } from "@/typings/store";

export const SYNC_SETTING_KEYS = [
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
] as const satisfies ReadonlyArray<keyof MainState>;

export type SyncSettingKey = typeof SYNC_SETTING_KEYS[number];
export type SyncSettingValue<Key extends SyncSettingKey = SyncSettingKey> = MainState[Key];

export interface PendingSettingMutation {
  mutationId: string;
  key: SyncSettingKey;
  value: SyncSettingValue;
  changedAt: string;
}

export interface RemoteSettingField {
  value: unknown;
  revision: number;
  deviceId: string;
  updatedAt: string;
}

export interface SettingsSyncResponse {
  revision: number;
  fields: Partial<Record<SyncSettingKey, RemoteSettingField>> & Record<string, RemoteSettingField>;
}
