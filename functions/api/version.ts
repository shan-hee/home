import { apiResponse, ApiError, errorResponse, getRequestId } from "../lib/api";
import { cachedResponse } from "../lib/cache";
import { fetchJson } from "../lib/http";
import { loadSiteContent } from "../lib/siteContent";
import type { PagesContext } from "../lib/types";

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  name?: string;
  prerelease?: boolean;
  published_at?: string;
}

interface GitHubTag {
  name?: string;
}

const versionParts = (value: string) => {
  const match = value.trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
};

const compareVersions = (first: string, second: string) => {
  const a = versionParts(first) || [0, 0, 0];
  const b = versionParts(second) || [0, 0, 0];
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return b[index] - a[index];
  }
  return 0;
};

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const config = await loadSiteContent(context.env.DB);
    const profile = config.sections.profile as { repositoryUrl?: unknown };
    if (typeof profile.repositoryUrl !== "string") {
      throw new ApiError(500, "REPOSITORY_NOT_CONFIGURED", "代码仓库尚未配置");
    }
    const repositoryUrl = new URL(profile.repositoryUrl);
    const repository = repositoryUrl.pathname.split("/").filter(Boolean).join("/");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
      throw new ApiError(500, "REPOSITORY_INVALID", "代码仓库配置无效");
    }
    const cacheUrl = new URL(
      `/__edge-cache/version?repository=${encodeURIComponent(repository)}`,
      context.request.url,
    ).toString();
    return await cachedResponse(cacheUrl, 600, context, async () => {
      const headers = new Headers({ accept: "application/vnd.github+json", "user-agent": "shan-hee-home" });

      try {
        const release = await fetchJson<GitHubRelease>(
          `https://api.github.com/repos/${repository}/releases/latest`,
          { headers },
        );
        if (!release.tag_name || !versionParts(release.tag_name)) throw new Error("Release 版本格式无效");
        return apiResponse({
          version: release.tag_name.replace(/^v/i, ""),
          tag: release.tag_name,
          name: release.name || release.tag_name,
          prerelease: Boolean(release.prerelease),
          url: release.html_url || `https://github.com/${repository}/releases`,
          publishedAt: release.published_at || null,
          repository,
        }, requestId, {}, "public, max-age=600");
      } catch {
        const tags = await fetchJson<GitHubTag[]>(
          `https://api.github.com/repos/${repository}/tags?per_page=30`,
          { headers },
        );
        const tag = tags.map((item) => item.name || "").filter((name) => versionParts(name)).sort(compareVersions)[0];
        if (!tag) throw new Error("仓库没有可解析的 Release 或 Tag");
        return apiResponse({
          version: tag.replace(/^v/i, ""),
          tag,
          name: tag,
          prerelease: /(?:alpha|beta|rc|pre|dev)/i.test(tag),
          url: `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`,
          publishedAt: null,
          repository,
        }, requestId, {}, "public, max-age=600");
      }
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error, requestId);
    console.error("版本检查失败：", error);
    return errorResponse(new ApiError(503, "VERSION_CHECK_FAILED", "版本检查暂时不可用"), requestId);
  }
};
