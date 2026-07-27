import { openDB, type DBSchema } from "idb";
import { nullable, number, object, picklist, safeParse, string, unknown } from "valibot";
import type { SiteContentSections } from "@/typings/siteContent";

export type ContentSection = keyof SiteContentSections;

export interface AdminDraft {
  section: ContentSection;
  baseRevision: number;
  baseContent: unknown;
  editedContent: unknown;
  updatedAt: string;
}

export interface AdminMutation {
  mutationId: string;
  section: ContentSection;
  baseRevision: number;
  baseContent: unknown;
  content: unknown;
  createdAt: string;
  status: "pending" | "conflict";
  attempts: number;
  lastError: string | null;
}

export interface RememberedOwner {
  key: "owner";
  deviceId: string;
  deviceName: string;
  expiresAt: string;
}

interface OfflineDatabase extends DBSchema {
  adminDrafts: {
    key: ContentSection;
    value: AdminDraft;
  };
  adminOutbox: {
    key: string;
    value: AdminMutation;
    indexes: { "by-section": ContentSection; "by-status": AdminMutation["status"] };
  };
  metadata: {
    key: string;
    value: RememberedOwner;
  };
}

const sectionValues = ["profile", "siteLinks", "socialLinks", "music", "wallpaper", "preferences", "hitokoto"] as const;
const draftSchema = object({
  section: picklist(sectionValues),
  baseRevision: number(),
  baseContent: unknown(),
  editedContent: unknown(),
  updatedAt: string(),
});
const mutationSchema = object({
  mutationId: string(),
  section: picklist(sectionValues),
  baseRevision: number(),
  baseContent: unknown(),
  content: unknown(),
  createdAt: string(),
  status: picklist(["pending", "conflict"]),
  attempts: number(),
  lastError: nullable(string()),
});
const rememberedOwnerSchema = object({
  key: picklist(["owner"]),
  deviceId: string(),
  deviceName: string(),
  expiresAt: string(),
});

const database = openDB<OfflineDatabase>("home-admin-offline", 2, {
  async upgrade(db, oldVersion, _newVersion, transaction) {
    if (oldVersion < 1) {
      db.createObjectStore("adminDrafts", { keyPath: "section" });
      const outbox = db.createObjectStore("adminOutbox", { keyPath: "mutationId" });
      outbox.createIndex("by-section", "section");
      outbox.createIndex("by-status", "status");
      db.createObjectStore("metadata", { keyPath: "key" });
    }
    if (oldVersion < 2) {
      const changedSections: ContentSection[] = ["wallpaper", "preferences"];
      const drafts = transaction.objectStore("adminDrafts");
      const outbox = transaction.objectStore("adminOutbox");
      await Promise.all(changedSections.map(async (section) => {
        await drafts.delete(section);
        const records = await outbox.index("by-section").getAll(section);
        await Promise.all(records.map((record) => outbox.delete(record.mutationId)));
      }));
    }
  },
});

export const readAdminDraft = async (section: ContentSection) => {
  const parsed = safeParse(draftSchema, await (await database).get("adminDrafts", section));
  return parsed.success ? parsed.output as AdminDraft : null;
};

export const writeAdminDraft = async (draft: AdminDraft) => {
  await (await database).put("adminDrafts", draft);
};

export const deleteAdminDraft = async (section: ContentSection) => {
  await (await database).delete("adminDrafts", section);
};

export const deleteAdminSectionState = async (section: ContentSection) => {
  const db = await database;
  const transaction = db.transaction(["adminDrafts", "adminOutbox"], "readwrite");
  await transaction.objectStore("adminDrafts").delete(section);
  const records = await transaction.objectStore("adminOutbox").index("by-section").getAll(section);
  await Promise.all(records.map((record) => transaction.objectStore("adminOutbox").delete(record.mutationId)));
  await transaction.done;
};

export const putAdminMutation = async (mutation: AdminMutation) => {
  const db = await database;
  const transaction = db.transaction("adminOutbox", "readwrite");
  const existing = await transaction.store.index("by-section").getAll(mutation.section);
  await Promise.all(existing.map((item) => transaction.store.delete(item.mutationId)));
  await transaction.store.put(mutation);
  await transaction.done;
};

export const updateAdminMutation = async (mutation: AdminMutation) => {
  await (await database).put("adminOutbox", mutation);
};

export const deleteAdminMutation = async (mutationId: string) => {
  await (await database).delete("adminOutbox", mutationId);
};

export const listAdminMutations = async () => {
  const records = await (await database).getAll("adminOutbox");
  return records.flatMap((record) => {
    const parsed = safeParse(mutationSchema, record);
    return parsed.success ? [parsed.output as AdminMutation] : [];
  }).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
};

export const rememberOwner = async (owner: Omit<RememberedOwner, "key">) => {
  try { await (await database).put("metadata", { key: "owner", ...owner }); } catch { /* 在线会话本身仍然有效。 */ }
};

export const readRememberedOwner = async () => {
  try {
    const parsed = safeParse(rememberedOwnerSchema, await (await database).get("metadata", "owner"));
    if (!parsed.success || Date.parse(parsed.output.expiresAt) <= Date.now()) return null;
    return parsed.output as RememberedOwner;
  } catch { return null; }
};

export const forgetOwner = async () => {
  try { await (await database).delete("metadata", "owner"); } catch { /* 无可用的本地数据库时无需处理。 */ }
};
