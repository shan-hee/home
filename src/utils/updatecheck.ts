import { requestJson } from "@/services/apiClient";

interface VersionApiResponse {
  version: string;
  tag: string;
  name: string;
  prerelease: boolean;
  url: string;
  publishedAt: string | null;
  repository: string;
}

export interface UpdateResult {
  status: "up-to-date" | "available";
  latestVersion: string;
  prerelease: boolean;
  releaseUrl: string;
  publishedAt: string | null;
  repository: string;
}

const normalizeVersion = (value: string) => {
  const match = value.trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
};

const compareVersions = (current: number[], latest: number[]) => {
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== latest[index]) return current[index] - latest[index];
  }
  return 0;
};

export const checkForUpdate = async (currentVersion: string): Promise<UpdateResult> => {
  const payload = await requestJson<unknown>("/api/version", { cache: "no-store" });
  if (!payload || typeof payload !== "object") throw new Error("版本接口响应格式无效");
  const value = payload as Partial<VersionApiResponse>;
  if (
    typeof value.version !== "string"
    || typeof value.prerelease !== "boolean"
    || typeof value.url !== "string"
    || typeof value.repository !== "string"
    || (value.publishedAt !== null && typeof value.publishedAt !== "string")
  ) {
    throw new Error("版本接口响应格式无效");
  }
  const current = normalizeVersion(currentVersion);
  const latest = normalizeVersion(value.version);
  if (!current || !latest) throw new Error("版本格式无效");
  return {
    status: compareVersions(current, latest) >= 0 ? "up-to-date" : "available",
    latestVersion: latest.join("."),
    prerelease: value.prerelease,
    releaseUrl: value.url,
    publishedAt: value.publishedAt,
    repository: value.repository,
  };
};
