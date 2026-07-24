interface VersionInfo {
  channel: string;
  version: string;
  type: string;
  upa: string;
}

interface VersionApiResponse {
  version: string;
  prerelease: boolean;
}

interface UpdateResult {
  status: "true" | "false" | "error";
  latestVersion: string;
  isPreview: "true" | "false";
  versionType: string;
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

export const checkForUpdate = async (versionInfo: VersionInfo): Promise<UpdateResult> => {
  try {
    const response = await fetch("/api/version", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`版本接口返回 ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("版本接口响应格式无效");
    const value = payload as Partial<VersionApiResponse>;
    if (typeof value.version !== "string" || typeof value.prerelease !== "boolean") {
      throw new Error("版本接口响应字段无效");
    }
    const current = normalizeVersion(versionInfo.version);
    const latest = normalizeVersion(value.version);
    if (!current || !latest) throw new Error("版本格式无效");
    return {
      status: compareVersions(current, latest) >= 0 ? "true" : "false",
      latestVersion: latest.join("."),
      isPreview: value.prerelease ? "true" : "false",
      versionType: value.prerelease ? "prerelease" : "release",
    };
  } catch (error) {
    console.error("更新检查失败：", error);
    return {
      status: "error",
      latestVersion: "0.0.0",
      isPreview: "false",
      versionType: "error",
    };
  }
};
