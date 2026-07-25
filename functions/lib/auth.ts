import { ApiError } from "./api";
import { createRandomToken, hmacSha256Hex, secureTextEqual, sha256Hex } from "./crypto";
import type { AppEnvironment } from "./types";

const SESSION_COOKIE = "home_session";
const SESSION_TTL_DAYS_DEFAULT = 30;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_BLOCK_MS = 30 * 60 * 1000;
const RATE_MAX_FAILURES = 5;
const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

interface SessionRow {
  token_hash: string;
  device_id: string;
  device_name: string;
  expires_at: string;
  last_seen_at: string;
}

interface RateLimitRow {
  failed_count: number;
  window_started_at: string;
  blocked_until: string | null;
}

export interface OwnerSession {
  tokenHash: string;
  deviceId: string;
  deviceName: string;
  expiresAt: string;
}

const parseCookies = (request: Request) => {
  const entries = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      return separator < 0 ? [part, ""] : [part.slice(0, separator), part.slice(separator + 1)];
    });
  return new Map(entries as Array<[string, string]>);
};

export const sessionTokenFromRequest = (request: Request) => {
  return parseCookies(request).get(SESSION_COOKIE) || null;
};

const cookieBase = (request: Request) => {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict${secure}`;
};

export const createSessionCookie = (request: Request, token: string, maxAgeSeconds: number) => {
  return `${SESSION_COOKIE}=${token}; ${cookieBase(request)}; Max-Age=${maxAgeSeconds}`;
};

export const clearSessionCookie = (request: Request) => {
  return `${SESSION_COOKIE}=; ${cookieBase(request)}; Max-Age=0`;
};

export const sessionTtlSeconds = (env: AppEnvironment) => {
  const configured = Number(env.SESSION_TTL_DAYS || SESSION_TTL_DAYS_DEFAULT);
  const days = Number.isFinite(configured) && configured >= 1 && configured <= 90
    ? configured
    : SESSION_TTL_DAYS_DEFAULT;
  return Math.round(days * 24 * 60 * 60);
};

export const verifyOwnerPassword = async (env: AppEnvironment, candidate: string) => {
  const configured = env.OWNER_PASSWORD || "";
  if (configured.length < 8 || configured.length > 128) {
    throw new ApiError(503, "AUTH_NOT_CONFIGURED", "登录服务暂时不可用");
  }
  return secureTextEqual(candidate, configured);
};

const requestIpHash = async (request: Request, env: AppEnvironment) => {
  const secret = env.IP_HASH_SECRET || "";
  if (secret.length < 32) {
    throw new ApiError(503, "AUTH_NOT_CONFIGURED", "登录服务暂时不可用");
  }
  const ip = request.headers.get("cf-connecting-ip")?.trim()
    || (env.APP_ENV === "development" ? "local-development" : "");
  if (!ip) throw new ApiError(503, "CLIENT_ADDRESS_UNAVAILABLE", "登录服务暂时不可用");
  return hmacSha256Hex(secret, ip);
};

export const assertLoginAllowed = async (request: Request, env: AppEnvironment) => {
  const ipHash = await requestIpHash(request, env);
  const row = await env.DB.prepare(
    "SELECT failed_count, window_started_at, blocked_until FROM auth_rate_limits WHERE ip_hash = ?",
  ).bind(ipHash).first<RateLimitRow>();
  if (!row) return ipHash;

  const now = Date.now();
  if (row.blocked_until && Date.parse(row.blocked_until) > now) {
    throw new ApiError(429, "LOGIN_RATE_LIMITED", "登录尝试过多，请稍后再试");
  }
  return ipHash;
};

export const recordLoginFailure = async (env: AppEnvironment, ipHash: string) => {
  const now = new Date();
  const row = await env.DB.prepare(
    "SELECT failed_count, window_started_at FROM auth_rate_limits WHERE ip_hash = ?",
  ).bind(ipHash).first<Pick<RateLimitRow, "failed_count" | "window_started_at">>();
  const withinWindow = row && Date.parse(row.window_started_at) >= now.getTime() - RATE_WINDOW_MS;
  const failedCount = withinWindow ? row.failed_count + 1 : 1;
  const windowStartedAt = withinWindow ? row.window_started_at : now.toISOString();
  const blockedUntil = failedCount >= RATE_MAX_FAILURES
    ? new Date(now.getTime() + RATE_BLOCK_MS).toISOString()
    : null;

  await env.DB.prepare(`
    INSERT INTO auth_rate_limits (
      ip_hash, failed_count, window_started_at, blocked_until, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(ip_hash) DO UPDATE SET
      failed_count = excluded.failed_count,
      window_started_at = excluded.window_started_at,
      blocked_until = excluded.blocked_until,
      updated_at = excluded.updated_at
  `).bind(ipHash, failedCount, windowStartedAt, blockedUntil, now.toISOString()).run();
};

export const clearLoginFailures = async (env: AppEnvironment, ipHash: string) => {
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE ip_hash = ?").bind(ipHash).run();
};

export const createOwnerSession = async (
  request: Request,
  env: AppEnvironment,
  device: { id: string; name: string },
) => {
  const token = createRandomToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const ttlSeconds = sessionTtlSeconds(env);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 512);

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO owner_devices (
        id, name, user_agent, created_at, last_seen_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        user_agent = excluded.user_agent,
        last_seen_at = excluded.last_seen_at,
        revoked_at = NULL
    `).bind(device.id, device.name, userAgent, now.toISOString(), now.toISOString()),
    env.DB.prepare(`
      INSERT INTO auth_sessions (
        token_hash, device_id, created_at, expires_at, last_seen_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, NULL)
    `).bind(tokenHash, device.id, now.toISOString(), expiresAt, now.toISOString()),
    env.DB.prepare(`
      INSERT INTO audit_logs (action, target, detail_json, device_id, created_at)
      VALUES ('auth.login', 'session', '{}', ?, ?)
    `).bind(device.id, now.toISOString()),
  ]);

  return {
    token,
    cookie: createSessionCookie(request, token, ttlSeconds),
    expiresAt,
  };
};

export const getOwnerSession = async (
  request: Request,
  env: AppEnvironment,
  touch = true,
): Promise<OwnerSession | null> => {
  const token = sessionTokenFromRequest(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const row = await env.DB.prepare(`
    SELECT
      sessions.token_hash,
      sessions.device_id,
      sessions.expires_at,
      sessions.last_seen_at,
      devices.name AS device_name
    FROM auth_sessions AS sessions
    INNER JOIN owner_devices AS devices ON devices.id = sessions.device_id
    WHERE sessions.token_hash = ?
      AND sessions.revoked_at IS NULL
      AND devices.revoked_at IS NULL
      AND sessions.expires_at > ?
  `).bind(tokenHash, now.toISOString()).first<SessionRow>();
  if (!row) return null;

  if (touch && Date.parse(row.last_seen_at) < now.getTime() - SESSION_TOUCH_INTERVAL_MS) {
    await env.DB.batch([
      env.DB.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?")
        .bind(now.toISOString(), tokenHash),
      env.DB.prepare("UPDATE owner_devices SET last_seen_at = ? WHERE id = ?")
        .bind(now.toISOString(), row.device_id),
    ]);
  }

  return {
    tokenHash,
    deviceId: row.device_id,
    deviceName: row.device_name,
    expiresAt: row.expires_at,
  };
};

export const requireOwnerSession = async (request: Request, env: AppEnvironment) => {
  const session = await getOwnerSession(request, env);
  if (!session) throw new ApiError(401, "UNAUTHORIZED", "需要重新登录");
  return session;
};

export const writeAuditLog = async (
  env: AppEnvironment,
  session: OwnerSession,
  action: string,
  target: string,
  details: Record<string, unknown> = {},
) => {
  await env.DB.prepare(`
    INSERT INTO audit_logs (action, target, detail_json, device_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(action, target, JSON.stringify(details), session.deviceId, new Date().toISOString()).run();
};
