import type { AppEnvironment } from "./types";

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export const cleanupExpiredData = async (env: AppEnvironment) => {
  const now = new Date().toISOString();
  const thirtyDaysAgo = daysAgo(30);
  await env.DB.batch([
    env.DB.prepare(`
      DELETE FROM auth_sessions
      WHERE COALESCE(revoked_at, expires_at) < ?
    `).bind(thirtyDaysAgo),
    env.DB.prepare(`
      DELETE FROM admin_mutations
      WHERE created_at < ?
    `).bind(thirtyDaysAgo),
    env.DB.prepare(`
      DELETE FROM audit_logs
      WHERE created_at < ?
    `).bind(daysAgo(180)),
    env.DB.prepare(`
      DELETE FROM owner_devices
      WHERE revoked_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM auth_sessions
          WHERE auth_sessions.device_id = owner_devices.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM admin_mutations
          WHERE admin_mutations.device_id = owner_devices.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM audit_logs
          WHERE audit_logs.device_id = owner_devices.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM content_sections
          WHERE content_sections.updated_by_device = owner_devices.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM assets
          WHERE assets.created_by_device = owner_devices.id
        )
    `).bind(thirtyDaysAgo),
    env.DB.prepare(`
      DELETE FROM auth_rate_limits
      WHERE updated_at < ?
        AND (blocked_until IS NULL OR blocked_until < ?)
    `).bind(daysAgo(1), now),
  ]);
};
