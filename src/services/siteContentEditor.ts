import { ApiClientError } from "@/services/apiClient";
import { useAdminOfflineStore } from "@/stores/adminOffline";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import type { SiteContentSections } from "@/typings/siteContent";

interface SectionUpdate<Section extends keyof SiteContentSections> {
  section: Section;
  content: SiteContentSections[Section];
  revision: number;
  updatedAt: string;
}

export const saveSiteContentSection = async <Section extends keyof SiteContentSections>(
  section: Section,
  content: SiteContentSections[Section],
) => {
  const snapshot = useSiteContentStore.getState().snapshot;
  try {
    const outcome = await useAdminOfflineStore.getState().saveSection(
      section,
      snapshot.sectionRevisions[section],
      snapshot.sections[section],
      content,
    );
    if (outcome.status === "queued") {
      useSiteContentStore.getState().replaceSection(
        section,
        content,
        snapshot.sectionRevisions[section],
        new Date().toISOString(),
      );
      return content;
    }
    const result = outcome.result as SectionUpdate<Section>;
    useSiteContentStore.getState().replaceSection(
      section,
      result.content,
      result.revision,
      result.updatedAt,
    );
    return result.content;
  } catch (reason) {
    if (reason instanceof ApiClientError && reason.status === 401) {
      useAuthStore.getState().expireSession();
    }
    if (reason instanceof ApiClientError && reason.status === 409) {
      await useSiteContentStore.getState().refresh();
    }
    throw reason;
  }
};
