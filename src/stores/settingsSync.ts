import { defineStore } from "pinia";
import { watch, type WatchStopHandle } from "vue";
import { mainStore } from "@/store";
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

const keySet = new Set<string>(SYNC_SETTING_KEYS);
const isSyncSettingKey = (value: string): value is SyncSettingKey => keySet.has(value);
const clone = <Value>(value: Value): Value => structuredClone(value);
const tabId = crypto.randomUUID();
let debounceTimer: number | null = null;
let inFlight: Promise<void> | null = null;
let stopHandles: WatchStopHandle[] = [];
let channel: BroadcastChannel | null = null;

const validMutation = (value: unknown): value is PendingSettingMutation => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const mutation = value as Partial<PendingSettingMutation>;
  return typeof mutation.mutationId === "string"
    && typeof mutation.key === "string"
    && isSyncSettingKey(mutation.key)
    && typeof mutation.changedAt === "string";
};

export const useSettingsSyncStore = defineStore("settings-sync", {
  state: () => ({
    initialized: false,
    applyingRemote: false,
    status: "idle" as SyncStatus,
    serverRevision: 0,
    fieldRevisions: {} as Partial<Record<SyncSettingKey, number>>,
    pendingMutations: [] as PendingSettingMutation[],
    lastSyncedAt: null as string | null,
  }),
  getters: {
    pendingCount: (state) => state.pendingMutations.length,
    statusLabel(state) {
      if (state.status === "syncing") return "正在同步";
      if (state.status === "offline") return `离线保存${state.pendingMutations.length ? ` · ${state.pendingMutations.length} 项待同步` : ""}`;
      if (state.status === "error") return `同步稍后重试${state.pendingMutations.length ? ` · ${state.pendingMutations.length} 项待同步` : ""}`;
      if (state.status === "synced") return "已同步";
      return state.pendingMutations.length ? `${state.pendingMutations.length} 项待同步` : "本地设置已就绪";
    },
  },
  actions: {
    restorePersistedState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ownerSettings);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<PersistedSyncState>;
        if (parsed.version !== 1) return;
        const values = Object.fromEntries(
          Object.entries(parsed.values || {}).filter(([key]) => isSyncSettingKey(key)),
        ) as Partial<MainState>;
        this.applyingRemote = true;
        mainStore().$patch(values);
        this.applyingRemote = false;
        this.serverRevision = Number.isInteger(parsed.serverRevision) && (parsed.serverRevision as number) >= 0
          ? parsed.serverRevision as number
          : 0;
        this.fieldRevisions = Object.fromEntries(
          Object.entries(parsed.fieldRevisions || {}).filter(([key, revision]) => (
            isSyncSettingKey(key) && Number.isInteger(revision) && (revision as number) >= 0
          )),
        ) as Partial<Record<SyncSettingKey, number>>;
        this.pendingMutations = Array.isArray(parsed.pendingMutations)
          ? parsed.pendingMutations.filter(validMutation).slice(-50)
          : [];
      } catch {
        this.serverRevision = 0;
        this.fieldRevisions = {};
        this.pendingMutations = [];
      }
    },
    persistState() {
      const store = mainStore();
      const value: PersistedSyncState = {
        version: 1,
        values: Object.fromEntries(
          SYNC_SETTING_KEYS.map((key) => [key, clone(store[key])]),
        ) as Partial<Record<SyncSettingKey, SyncSettingValue>>,
        serverRevision: this.serverRevision,
        fieldRevisions: this.fieldRevisions,
        pendingMutations: this.pendingMutations,
      };
      try {
        localStorage.setItem(STORAGE_KEYS.ownerSettings, JSON.stringify(value));
      } catch {
        // 存储不可用时仍保留当前页面内的同步队列。
      }
    },
    queueMutation<Key extends SyncSettingKey>(key: Key, value: SyncSettingValue<Key>, broadcast = true) {
      const mutation: PendingSettingMutation = {
        mutationId: crypto.randomUUID(),
        key,
        value: clone(value) as SyncSettingValue,
        changedAt: new Date().toISOString(),
      };
      this.pendingMutations = [
        ...this.pendingMutations.filter((pending) => pending.key !== key),
        mutation,
      ];
      this.status = navigator.onLine ? "idle" : "offline";
      this.persistState();
      if (broadcast) channel?.postMessage({ type: "field", source: tabId, key, value: mutation.value });
      this.scheduleSync();
    },
    scheduleSync(delay = 500) {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        void this.synchronize();
      }, delay);
    },
    applyRemoteResponse(response: SettingsSyncResponse, sentMutationIds: Set<string>) {
      const store = mainStore();
      this.pendingMutations = this.pendingMutations.filter(
        (mutation) => !sentMutationIds.has(mutation.mutationId),
      );
      this.serverRevision = Number(response.revision) || 0;
      const patch: Record<string, unknown> = {};
      SYNC_SETTING_KEYS.forEach((key) => {
        const field = response.fields[key];
        if (!field) return;
        this.fieldRevisions[key] = Number(field.revision) || 0;
        if (!this.pendingMutations.some((pending) => pending.key === key)) {
          patch[key] = clone(field.value);
        }
      });
      this.applyingRemote = true;
      store.$patch(patch as Partial<MainState>);
      this.applyingRemote = false;
      this.lastSyncedAt = new Date().toISOString();
      this.status = "synced";
      this.persistState();
      channel?.postMessage({ type: "synced", source: tabId });
    },
    seedMissingServerFields(response: SettingsSyncResponse) {
      const store = mainStore();
      SYNC_SETTING_KEYS.forEach((key) => {
        if (!response.fields[key] && !this.pendingMutations.some((pending) => pending.key === key)) {
          this.queueMutation(key, store[key], false);
        }
      });
    },
    async synchronize() {
      const auth = useAuthStore();
      if (!this.initialized || !auth.authenticated) return;
      if (!navigator.onLine) {
        this.status = "offline";
        return;
      }
      if (inFlight) return inFlight;

      inFlight = (async () => {
        this.status = "syncing";
        const sent = this.pendingMutations.slice(0, 50).map((mutation) => clone(mutation));
        const sentIds = new Set(sent.map((mutation) => mutation.mutationId));
        try {
          const response = sent.length
            ? await requestJson<SettingsSyncResponse>("/api/sync/settings", {
              method: "PATCH",
              body: JSON.stringify({ deviceId: auth.deviceId, mutations: sent }),
            })
            : await requestJson<SettingsSyncResponse>("/api/sync/settings");
          this.applyRemoteResponse(response, sentIds);
          this.seedMissingServerFields(response);
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 401) {
            auth.expireSession();
            this.status = "idle";
            return;
          }
          this.status = navigator.onLine ? "error" : "offline";
        } finally {
          this.persistState();
        }
      })().finally(() => {
        inFlight = null;
        if (this.pendingMutations.length && useAuthStore().authenticated) this.scheduleSync(1200);
      });
      return inFlight;
    },
    initialize() {
      if (this.initialized) return;
      try {
        localStorage.removeItem("main");
        localStorage.removeItem("home:weather:location:v1");
        sessionStorage.removeItem("main");
      } catch {
        // 旧键不可访问时不影响当前页面使用默认设置。
      }
      this.restorePersistedState();
      this.initialized = true;
      const store = mainStore();
      const auth = useAuthStore();

      stopHandles = SYNC_SETTING_KEYS.map((key) => watch(
        () => store[key],
        (value) => {
          if (!this.applyingRemote) this.queueMutation(key, value);
        },
        { deep: true, flush: "sync" },
      ));
      stopHandles.push(watch(
        () => auth.authenticated,
        (authenticated) => {
          if (authenticated) void this.synchronize();
        },
        { flush: "sync" },
      ));

      const requestSync = () => {
        if (auth.authenticated) void this.synchronize();
      };
      window.addEventListener("online", requestSync);
      window.addEventListener("focus", requestSync);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) requestSync();
      });
      window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEYS.ownerSettings) return;
        this.restorePersistedState();
        requestSync();
      });

      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel("home:owner-settings:v1");
        channel.addEventListener("message", (event: MessageEvent) => {
          const message = event.data as { type?: string; source?: string; key?: string; value?: unknown };
          if (!message || message.source === tabId) return;
          if (message.type === "field" && message.key && isSyncSettingKey(message.key)) {
            this.applyingRemote = true;
            store.$patch({ [message.key]: clone(message.value) } as Partial<MainState>);
            this.applyingRemote = false;
          }
          this.restorePersistedState();
          requestSync();
        });
      }
      if (auth.authenticated) void this.synchronize();
    },
  },
});
