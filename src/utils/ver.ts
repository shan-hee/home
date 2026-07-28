import config from "@/../package.json";

export const appVersion = config.version;
export const appVersionNumber = appVersion.match(/^(\d+\.\d+\.\d+)/)?.[1] || "0.0.0";
