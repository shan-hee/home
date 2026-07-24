import { cachedResponse } from "../lib/cache";
import { fetchJson, jsonResponse } from "../lib/http";

interface Environment {
  GITHUB_REPOSITORY?: string;
  GITHUB_TOKEN?: string;
}

type PagesContext = {
  request: Request;
  env: Environment;
  waitUntil?: (promise: Promise<unknown>) => void;
};

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
  const repository = context.env.GITHUB_REPOSITORY?.trim() || "shan-hee/home";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    return jsonResponse({ error: "GITHUB_REPOSITORY 格式无效" }, { status: 500 });
  }
  const cacheUrl = new URL(
    `/__edge-cache/version?repository=${encodeURIComponent(repository)}`,
    context.request.url,
  ).toString();
  try {
    return await cachedResponse(cacheUrl, 600, context, async () => {
      const headers = new Headers({ accept: "application/vnd.github+json", "user-agent": "shan-hee-home" });
      if (context.env.GITHUB_TOKEN?.trim()) {
        headers.set("authorization", `Bearer ${context.env.GITHUB_TOKEN.trim()}`);
      }

      try {
        const release = await fetchJson<GitHubRelease>(
          `https://api.github.com/repos/${repository}/releases/latest`,
          { headers },
        );
        if (!release.tag_name || !versionParts(release.tag_name)) throw new Error("Release 版本格式无效");
        return jsonResponse({
          version: release.tag_name.replace(/^v/i, ""),
          tag: release.tag_name,
          name: release.name || release.tag_name,
          prerelease: Boolean(release.prerelease),
          url: release.html_url || `https://github.com/${repository}/releases`,
          publishedAt: release.published_at || null,
          repository,
        }, {}, "public, max-age=600");
      } catch {
        const tags = await fetchJson<GitHubTag[]>(
          `https://api.github.com/repos/${repository}/tags?per_page=30`,
          { headers },
        );
        const tag = tags.map((item) => item.name || "").filter((name) => versionParts(name)).sort(compareVersions)[0];
        if (!tag) throw new Error("仓库没有可解析的 Release 或 Tag");
        return jsonResponse({
          version: tag.replace(/^v/i, ""),
          tag,
          name: tag,
          prerelease: /(?:alpha|beta|rc|pre|dev)/i.test(tag),
          url: `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`,
          publishedAt: null,
          repository,
        }, {}, "public, max-age=600");
      }
    });
  } catch (error) {
    console.error("版本检查失败：", error);
    return jsonResponse({ error: "版本检查暂时不可用" }, { status: 503 });
  }
};
