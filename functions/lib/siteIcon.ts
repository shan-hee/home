import { ApiError } from "./api";

const MAX_ICON_BYTES = 512 * 1024;
const MAX_REDIRECTS = 2;
const FETCH_TIMEOUT_MS = 5000;
const decoder = new TextDecoder();

export interface SiteIconFile {
  bytes: ArrayBuffer;
  checksum: string;
  extension: "ico" | "jpg" | "png" | "webp" | "avif" | "svg";
  mimeType: "image/x-icon" | "image/jpeg" | "image/png" | "image/webp" | "image/avif" | "image/svg+xml";
}

const hasBytes = (bytes: Uint8Array, expected: readonly number[]) => (
  bytes.length >= expected.length && expected.every((value, index) => bytes[index] === value)
);

const svgText = (bytes: Uint8Array) => decoder.decode(bytes).replace(/^\uFEFF/, "");

const hasSvgRoot = (value: string) => {
  const start = value
    .trimStart()
    .replace(/^<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/^(?:<!--[\s\S]*?-->\s*)*/i, "");
  return /^<svg(?:\s|>)/i.test(start);
};

const validateSvg = (bytes: Uint8Array) => {
  const value = svgText(bytes);
  if (!hasSvgRoot(value)) throw new ApiError(415, "SITE_ICON_TYPE_REJECTED", "SVG 图标格式无效");
  if (
    value.includes("\u0000")
    || /<!DOCTYPE\b/i.test(value)
    || /<!ENTITY\b/i.test(value)
    || /<(?:[a-z0-9_-]+:)?(?:script|foreignObject|iframe|object|embed|link|meta|base|form|input|button|textarea|select)(?:\s|>)/i.test(value)
    || /\s(?:(?:[a-z0-9_-]+:)?on[a-z][a-z0-9_-]*|xml:base)\s*=/i.test(value)
    || /(?:javascript|vbscript)\s*:/i.test(value)
    || /(?:@import|expression)\s*[\s(]/i.test(value)
    || /\b(?:href|xlink:href)\s*=\s*(?!["']\s*#)/i.test(value)
    || /\burl\s*\(\s*(?!(?:#|["']\s*#))/i.test(value)
  ) {
    throw new ApiError(415, "SITE_ICON_SVG_UNSAFE", "SVG 图标包含不安全内容");
  }

  for (const match of value.matchAll(/\b(?:href|xlink:href)\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    if (!match[2].trim().startsWith("#")) {
      throw new ApiError(415, "SITE_ICON_SVG_EXTERNAL_REFERENCE", "SVG 图标不能引用外部资源");
    }
  }
  for (const match of value.matchAll(/\burl\s*\(\s*(["']?)([\s\S]*?)\1\s*\)/gi)) {
    if (!match[2].trim().startsWith("#")) {
      throw new ApiError(415, "SITE_ICON_SVG_EXTERNAL_REFERENCE", "SVG 图标不能引用外部资源");
    }
  }
};

const detectFormat = (bytes: Uint8Array): Pick<SiteIconFile, "extension" | "mimeType"> | null => {
  if (hasBytes(bytes, [0, 0, 1, 0])) return { extension: "ico", mimeType: "image/x-icon" };
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return { extension: "jpg", mimeType: "image/jpeg" };
  if (hasBytes(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return { extension: "png", mimeType: "image/png" };
  if (bytes.length >= 12 && decoder.decode(bytes.slice(0, 4)) === "RIFF" && decoder.decode(bytes.slice(8, 12)) === "WEBP") {
    return { extension: "webp", mimeType: "image/webp" };
  }
  if (bytes.length >= 16 && decoder.decode(bytes.slice(4, 8)) === "ftyp") {
    const brands = decoder.decode(bytes.slice(8, 32));
    if (brands.includes("avif") || brands.includes("avis")) return { extension: "avif", mimeType: "image/avif" };
  }
  if (hasSvgRoot(svgText(bytes))) return { extension: "svg", mimeType: "image/svg+xml" };
  return null;
};

const blockedHostname = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b, c] = octets as [number, number, number, number];
  return a === 0
    || a === 10
    || a === 127
    || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && ((b === 0 && (c === 0 || c === 2)) || b === 168))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113);
};

const parseSiteUrl = (value: unknown) => {
  if (typeof value !== "string") throw new ApiError(400, "SITE_URL_INVALID", "网站地址无效");
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || blockedHostname(url.hostname)) throw new Error();
    return url;
  } catch {
    throw new ApiError(400, "SITE_URL_INVALID", "网站地址无效");
  }
};

const parseIconUrl = (value: unknown) => {
  if (typeof value !== "string") throw new ApiError(400, "SITE_ICON_URL_INVALID", "图标地址无效");
  let icon: URL;
  try {
    icon = new URL(value.trim());
  } catch {
    throw new ApiError(400, "SITE_ICON_URL_INVALID", "图标地址无效");
  }
  if (icon.protocol !== "https:" || icon.username || icon.password || icon.port || blockedHostname(icon.hostname)) {
    throw new ApiError(400, "SITE_ICON_URL_INVALID", "图标地址无效");
  }

  return icon;
};

const readLimitedBody = async (response: Response) => {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_ICON_BYTES) {
    throw new ApiError(413, "SITE_ICON_TOO_LARGE", "网站图标不能超过 512KB");
  }
  if (!response.body) throw new ApiError(502, "SITE_ICON_EMPTY", "网站图标内容为空");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ICON_BYTES) throw new ApiError(413, "SITE_ICON_TOO_LARGE", "网站图标不能超过 512KB");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new ApiError(502, "SITE_ICON_EMPTY", "网站图标内容为空");
  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return bytes;
};

const hashBytes = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

export const fetchSiteIcon = async (siteValue: unknown, iconValue: unknown): Promise<SiteIconFile> => {
  parseSiteUrl(siteValue);
  let icon = parseIconUrl(iconValue);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(icon, {
        headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/x-icon" },
        redirect: "manual",
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === MAX_REDIRECTS) throw new ApiError(502, "SITE_ICON_REDIRECT_LIMIT", "网站图标重定向次数过多");
        const location = response.headers.get("location");
        if (!location) throw new ApiError(502, "SITE_ICON_REDIRECT_INVALID", "网站图标重定向无效");
        icon = parseIconUrl(new URL(location, icon).toString());
        continue;
      }
      const bytes = Uint8Array.from(await readLimitedBody(response));
      const format = detectFormat(bytes);
      if (!format) throw new ApiError(415, "SITE_ICON_TYPE_REJECTED", "仅支持 ICO、JPEG、PNG、WebP、AVIF 或 SVG 网站图标");
      if (format.extension === "svg") validateSvg(bytes);
      return {
        bytes: bytes.buffer,
        checksum: await hashBytes(bytes),
        ...format,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "SITE_ICON_FETCH_FAILED", "网站图标获取失败或超时");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new ApiError(502, "SITE_ICON_FETCH_FAILED", "网站图标获取失败");
};
