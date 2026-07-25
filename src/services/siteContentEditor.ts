import { ApiClientError, requestJson } from "@/services/apiClient";
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
    const result = await requestJson<SectionUpdate<Section>>(`/api/admin/content/${section}`, {
      method: "PUT",
      body: JSON.stringify({
        baseRevision: snapshot.sectionRevisions[section],
        content,
      }),
    });
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
