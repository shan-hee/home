import { create } from "zustand";
import { ApiClientError, requestJson } from "@/services/apiClient";
import {
  deleteAdminDraft,
  deleteAdminMutation,
  deleteAdminSectionState,
  listAdminMutations,
  putAdminMutation,
  readAdminDraft,
  updateAdminMutation,
  writeAdminDraft,
  type AdminDraft,
  type AdminMutation,
  type ContentSection,
} from "@/services/offlineDatabase";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import type { SiteContentSections } from "@/typings/siteContent";

interface SectionUpdate<Section extends ContentSection = ContentSection> {
  section: Section;
  content: SiteContentSections[Section];
  revision: number;
  updatedAt: string;
}

export type SaveOutcome =
  | { status: "saved"; result: SectionUpdate }
  | { status: "queued"; mutationId: string };

interface AdminOfflineStore {
  initialized: boolean;
  flushing: boolean;
  pendingCount: number;
  conflictCount: number;
  initialize: () => void;
  refreshCounts: () => Promise<void>;
  saveDraft: (section: ContentSection, baseRevision: number, baseContent: unknown, editedContent: unknown) => Promise<void>;
  loadDraft: (section: ContentSection) => Promise<AdminDraft | null>;
  discardDraft: (section: ContentSection) => Promise<void>;
  discardSection: (section: ContentSection) => Promise<void>;
  saveSection: (section: ContentSection, baseRevision: number, baseContent: unknown, content: unknown) => Promise<SaveOutcome>;
  flush: () => Promise<void>;
}

const submitMutation = (mutation: AdminMutation) => requestJson<SectionUpdate>(
  `/api/admin/content/${mutation.section}`,
  {
    method: "PUT",
    body: JSON.stringify({
      mutationId: mutation.mutationId,
      baseRevision: mutation.baseRevision,
      content: mutation.content,
    }),
  },
);

const retryable = (reason: unknown) => !(reason instanceof ApiClientError) || reason.status >= 500;
let disposeRuntime: (() => void) | null = null;

export const getAdminOfflineLabel = (state: Pick<AdminOfflineStore, "flushing" | "pendingCount" | "conflictCount">) => {
  if (state.flushing) return "正在提交离线修改";
  if (state.conflictCount) return `${state.conflictCount} 项修改冲突`;
  if (state.pendingCount) return `${state.pendingCount} 项修改待提交`;
  return "配置已同步";
};

export const useAdminOfflineStore = create<AdminOfflineStore>((set, get) => ({
  initialized: false,
  flushing: false,
  pendingCount: 0,
  conflictCount: 0,
  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });
    void get().refreshCounts();
    const flush = () => void get().flush();
    const visible = () => { if (!document.hidden) flush(); };
    const unsubscribeAuth = useAuthStore.subscribe((state) => state.status, (status) => { if (status === "authenticated") flush(); });
    window.addEventListener("online", flush);
    window.addEventListener("focus", flush);
    document.addEventListener("visibilitychange", visible);
    disposeRuntime = () => {
      unsubscribeAuth();
      window.removeEventListener("online", flush);
      window.removeEventListener("focus", flush);
      document.removeEventListener("visibilitychange", visible);
    };
  },
  refreshCounts: async () => {
    const records = await listAdminMutations();
    set({ pendingCount: records.filter((item) => item.status === "pending").length, conflictCount: records.filter((item) => item.status === "conflict").length });
  },
  saveDraft: async (section, baseRevision, baseContent, editedContent) => {
    await writeAdminDraft({ section, baseRevision, baseContent: structuredClone(baseContent), editedContent: structuredClone(editedContent), updatedAt: new Date().toISOString() });
  },
  loadDraft: readAdminDraft,
  discardDraft: async (section) => { await deleteAdminDraft(section); },
  discardSection: async (section) => { await deleteAdminSectionState(section); await get().refreshCounts(); },
  saveSection: async (section, baseRevision, baseContent, content) => {
    const mutation: AdminMutation = {
      mutationId: crypto.randomUUID(), section, baseRevision,
      baseContent: structuredClone(baseContent), content: structuredClone(content),
      createdAt: new Date().toISOString(), status: "pending", attempts: 0, lastError: null,
    };
    await writeAdminDraft({
      section,
      baseRevision,
      baseContent: structuredClone(baseContent),
      editedContent: structuredClone(content),
      updatedAt: mutation.createdAt,
    });
    await putAdminMutation(mutation);
    await get().refreshCounts();
    try {
      const result = await submitMutation(mutation);
      await Promise.all([deleteAdminMutation(mutation.mutationId), deleteAdminDraft(section)]);
      await get().refreshCounts();
      return { status: "saved", result } as SaveOutcome;
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.status === 409) {
        await updateAdminMutation({ ...mutation, status: "conflict", attempts: 1, lastError: reason.message });
      } else if (reason instanceof ApiClientError && reason.status === 401) {
        useAuthStore.getState().expireSession();
      } else if (!retryable(reason)) {
        await deleteAdminMutation(mutation.mutationId);
        await get().refreshCounts();
        throw reason;
      }
      await get().refreshCounts();
      if (retryable(reason)) return { status: "queued", mutationId: mutation.mutationId } as SaveOutcome;
      throw reason;
    }
  },
  flush: async () => {
    if (get().flushing || useAuthStore.getState().status !== "authenticated") return;
    set({ flushing: true });
    let changed = false;
    try {
      const records = await listAdminMutations();
      for (const mutation of records.filter((item) => item.status === "pending")) {
        try {
          await submitMutation(mutation);
          await Promise.all([deleteAdminMutation(mutation.mutationId), deleteAdminDraft(mutation.section)]);
          changed = true;
        } catch (reason) {
          if (reason instanceof ApiClientError && reason.status === 409) {
            await updateAdminMutation({ ...mutation, status: "conflict", attempts: mutation.attempts + 1, lastError: reason.message });
            continue;
          }
          if (reason instanceof ApiClientError && reason.status === 401) {
            useAuthStore.getState().expireSession();
          } else if (reason instanceof ApiClientError && reason.status < 500) {
            await updateAdminMutation({ ...mutation, status: "conflict", attempts: mutation.attempts + 1, lastError: reason.message });
          } else {
            await updateAdminMutation({ ...mutation, attempts: mutation.attempts + 1, lastError: reason instanceof Error ? reason.message : "请求失败" });
          }
          break;
        }
      }
      if (changed) await useSiteContentStore.getState().refresh();
    } finally {
      set({ flushing: false });
      await get().refreshCounts();
    }
  },
}));

if (import.meta.hot) {
  import.meta.hot.dispose(() => { disposeRuntime?.(); disposeRuntime = null; });
}
