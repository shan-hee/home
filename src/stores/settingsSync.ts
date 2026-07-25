import { create } from "zustand";
import { useMainStore } from "@/store";
import { ApiClientError, requestJson } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import {
  SYNC_SETTING_KEYS,
  type PendingSettingMutation,
  type SettingsSyncResponse,
  type SyncSettingKey,
  type SyncSettingValue,
} from "@/typings/settingsSync";
import { STORAGE_KEYS } from "@/utils/storageKeys";
import type { MainState } from "@/typings/store";

type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

interface PersistedSyncState {
  version: 1;
  values: Partial<Record<SyncSettingKey, SyncSettingValue>>;
  serverRevision: number;
  fieldRevisions: Partial<Record<SyncSettingKey, number>>;
  pendingMutations: PendingSettingMutation[];
}

interface SettingsSyncStore {
  initialized: boolean;
  applyingRemote: boolean;
  status: SyncStatus;
  serverRevision: number;
  fieldRevisions: Partial<Record<SyncSettingKey, number>>;
  pendingMutations: PendingSettingMutation[];
  lastSyncedAt: string | null;
  restorePersistedState: () => void;
  persistState: () => void;
  queueMutation: <Key extends SyncSettingKey>(key: Key, value: SyncSettingValue<Key>, broadcast?: boolean) => void;
  scheduleSync: (delay?: number) => void;
  synchronize: () => Promise<void>;
  initialize: () => void;
}

const keySet = new Set<string>(SYNC_SETTING_KEYS);
const isSyncSettingKey = (value: string): value is SyncSettingKey => keySet.has(value);
const clone = <Value,>(value: Value): Value => structuredClone(value);
const tabId = crypto.randomUUID();
let debounceTimer: number | null = null;
let inFlight: Promise<void> | null = null;
let channel: BroadcastChannel | null = null;
let disposeRuntime: (() => void) | null = null;

const equalValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const applyChangedMainValues = (values: Partial<MainState>) => {
  const current = useMainStore.getState();
  const changed: Partial<MainState> = {};
  (Object.keys(values) as Array<keyof MainState>).forEach((key) => {
    if (equalValue(current[key], values[key])) return;
    (changed as Record<string, unknown>)[key] = values[key];
  });
  if (Object.keys(changed).length) current.patch(changed);
};

const validMutation = (value: unknown): value is PendingSettingMutation => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const mutation = value as Partial<PendingSettingMutation>;
  return typeof mutation.mutationId === "string"
    && typeof mutation.key === "string"
    && isSyncSettingKey(mutation.key)
    && typeof mutation.changedAt === "string";
};

export const getSyncStatusLabel = (state: Pick<SettingsSyncStore, "status" | "pendingMutations">) => {
  const count = state.pendingMutations.length;
  if (state.status === "syncing") return "正在同步";
  if (state.status === "offline") return `离线保存${count ? ` · ${count} 项待同步` : ""}`;
  if (state.status === "error") return `同步稍后重试${count ? ` · ${count} 项待同步` : ""}`;
  if (state.status === "synced") return "已同步";
  return count ? `${count} 项待同步` : "本地设置已就绪";
};

export const useSettingsSyncStore = create<SettingsSyncStore>((set, get) => ({
  initialized: false,
  applyingRemote: false,
  status: "idle",
  serverRevision: 0,
  fieldRevisions: {},
  pendingMutations: [],
  lastSyncedAt: null,
  restorePersistedState: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ownerSettings);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedSyncState>;
      if (parsed.version !== 1) return;
      const values = Object.fromEntries(
        Object.entries(parsed.values || {}).filter(([key]) => isSyncSettingKey(key)),
      ) as Partial<MainState>;
      set({ applyingRemote: true });
      applyChangedMainValues(values);
      set({
        applyingRemote: false,
        serverRevision: Number.isInteger(parsed.serverRevision) && Number(parsed.serverRevision) >= 0
          ? Number(parsed.serverRevision)
          : 0,
        fieldRevisions: Object.fromEntries(
          Object.entries(parsed.fieldRevisions || {}).filter(([key, revision]) => (
            isSyncSettingKey(key) && Number.isInteger(revision) && Number(revision) >= 0
          )),
        ) as Partial<Record<SyncSettingKey, number>>,
        pendingMutations: Array.isArray(parsed.pendingMutations)
          ? parsed.pendingMutations.filter(validMutation).slice(-50)
          : [],
      });
    } catch {
      set({ applyingRemote: false, serverRevision: 0, fieldRevisions: {}, pendingMutations: [] });
    }
  },
  persistState: () => {
    const main = useMainStore.getState();
    const state = get();
    const value: PersistedSyncState = {
      version: 1,
      values: Object.fromEntries(SYNC_SETTING_KEYS.map((key) => [key, clone(main[key])])) as PersistedSyncState["values"],
      serverRevision: state.serverRevision,
      fieldRevisions: state.fieldRevisions,
      pendingMutations: state.pendingMutations,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.ownerSettings, JSON.stringify(value));
    } catch {
      // 存储不可用时仍保留当前页面内的同步队列。
    }
  },
  queueMutation: (key, value, broadcast = true) => {
    const mutation: PendingSettingMutation = {
      mutationId: crypto.randomUUID(),
      key,
      value: clone(value) as SyncSettingValue,
      changedAt: new Date().toISOString(),
    };
    set((state) => ({
      pendingMutations: [...state.pendingMutations.filter((pending) => pending.key !== key), mutation],
      status: navigator.onLine ? "idle" : "offline",
    }));
    get().persistState();
    if (broadcast) channel?.postMessage({ type: "field", source: tabId, key, value: mutation.value });
    get().scheduleSync();
  },
  scheduleSync: (delay = 500) => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void get().synchronize();
    }, delay);
  },
  synchronize: async () => {
    const auth = useAuthStore.getState();
    if (!get().initialized || auth.status !== "authenticated") return;
    if (!navigator.onLine) {
      set({ status: "offline" });
      return;
    }
    if (inFlight) return inFlight;
    inFlight = (async () => {
      set({ status: "syncing" });
      const sent = get().pendingMutations.slice(0, 50).map(clone);
      const sentIds = new Set(sent.map(({ mutationId }) => mutationId));
      try {
        const response = sent.length
          ? await requestJson<SettingsSyncResponse>("/api/sync/settings", {
            method: "PATCH",
            body: JSON.stringify({ deviceId: auth.deviceId, mutations: sent }),
          })
          : await requestJson<SettingsSyncResponse>("/api/sync/settings");
        const remaining = get().pendingMutations.filter(({ mutationId }) => !sentIds.has(mutationId));
        const revisions = { ...get().fieldRevisions };
        const patch: Partial<MainState> = {};
        SYNC_SETTING_KEYS.forEach((key) => {
          const field = response.fields[key];
          if (!field) return;
          revisions[key] = Number(field.revision) || 0;
          if (!remaining.some((pending) => pending.key === key)) {
            (patch as Record<string, unknown>)[key] = clone(field.value);
          }
        });
        set({ applyingRemote: true });
        applyChangedMainValues(patch);
        set({
          applyingRemote: false,
          pendingMutations: remaining,
          serverRevision: Number(response.revision) || 0,
          fieldRevisions: revisions,
          lastSyncedAt: new Date().toISOString(),
          status: "synced",
        });
        SYNC_SETTING_KEYS.forEach((key) => {
          if (!response.fields[key] && !get().pendingMutations.some((pending) => pending.key === key)) {
            get().queueMutation(key, useMainStore.getState()[key], false);
          }
        });
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          useAuthStore.getState().expireSession();
          set({ status: "idle" });
        } else {
          set({ status: navigator.onLine ? "error" : "offline" });
        }
      } finally {
        get().persistState();
      }
    })().finally(() => {
      inFlight = null;
      if (get().pendingMutations.length && useAuthStore.getState().status === "authenticated") get().scheduleSync(1200);
    });
    return inFlight;
  },
  initialize: () => {
    if (get().initialized) return;
    get().restorePersistedState();
    set({ initialized: true });
    const unsubscribeMain = SYNC_SETTING_KEYS.map((key) => {
      return useMainStore.subscribe(
        (state) => state[key],
        (value) => {
          if (!get().applyingRemote) get().queueMutation(key, value as never);
        },
        { equalityFn: equalValue },
      );
    });
    const unsubscribeAuth = useAuthStore.subscribe(
      (state) => state.status,
      (status) => {
        if (status === "authenticated") void get().synchronize();
      },
    );
    const requestSync = () => {
      if (useAuthStore.getState().status === "authenticated") void get().synchronize();
    };
    const restoreFromStorage = () => get().restorePersistedState();
    const restoreWhenVisible = () => {
      if (!document.hidden) requestSync();
    };
    window.addEventListener("online", requestSync);
    window.addEventListener("focus", requestSync);
    document.addEventListener("visibilitychange", restoreWhenVisible);
    const restoreOnStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.ownerSettings) return;
      restoreFromStorage();
    };
    window.addEventListener("storage", restoreOnStorage);
    let receiveBroadcast: ((event: MessageEvent) => void) | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("home:owner-settings:v1");
      receiveBroadcast = (event: MessageEvent) => {
        const message = event.data as { type?: string; source?: string; key?: string; value?: unknown };
        if (!message || message.source === tabId) return;
        if (message.type === "field" && message.key && isSyncSettingKey(message.key)) {
          set({ applyingRemote: true });
          applyChangedMainValues({ [message.key]: clone(message.value) } as Partial<MainState>);
          set({ applyingRemote: false });
          restoreFromStorage();
          return;
        }
      };
      channel.addEventListener("message", receiveBroadcast);
    }
    disposeRuntime = () => {
      unsubscribeMain.forEach((unsubscribe) => unsubscribe());
      unsubscribeAuth();
      window.removeEventListener("online", requestSync);
      window.removeEventListener("focus", requestSync);
      document.removeEventListener("visibilitychange", restoreWhenVisible);
      window.removeEventListener("storage", restoreOnStorage);
      if (receiveBroadcast) channel?.removeEventListener("message", receiveBroadcast);
      channel?.close();
      channel = null;
    };
    requestSync();
  },
}));

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeRuntime?.();
    disposeRuntime = null;
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    debounceTimer = null;
  });
}
