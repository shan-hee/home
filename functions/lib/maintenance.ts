import type { AppEnvironment } from "./types";

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export const cleanupExpiredData = async (env: AppEnvironment) => {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      DELETE FROM auth_sessions
      WHERE COALESCE(revoked_at, expires_at) < ?
    `).bind(daysAgo(30)),
    env.DB.prepare(`
      DELETE FROM admin_mutations
      WHERE created_at < ?
    `).bind(daysAgo(30)),
    env.DB.prepare(`
      DELETE FROM audit_logs
      WHERE created_at < ?
    `).bind(daysAgo(180)),
    env.DB.prepare(`
      DELETE FROM auth_rate_limits
      WHERE updated_at < ?
        AND (blocked_until IS NULL OR blocked_until < ?)
    `).bind(daysAgo(1), now),
  ]);
};
