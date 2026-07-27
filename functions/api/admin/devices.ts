import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { requireOwnerSession } from "../../lib/auth";
import { cleanupExpiredData } from "../../lib/maintenance";
import type { PagesContext } from "../../lib/types";

interface DeviceRow {
  id: string;
  name: string;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  active_sessions: number;
}

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const session = await requireOwnerSession(context.request, context.env);
    await cleanupExpiredData(context.env);
    const result = await context.env.DB.prepare(`
      SELECT
        devices.id,
        devices.name,
        devices.user_agent,
        devices.created_at,
        devices.last_seen_at,
        devices.revoked_at,
        COUNT(sessions.token_hash) AS active_sessions
      FROM owner_devices AS devices
      LEFT JOIN auth_sessions AS sessions
        ON sessions.device_id = devices.id
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > ?
      GROUP BY devices.id
      ORDER BY devices.last_seen_at DESC
    `).bind(new Date().toISOString()).all<DeviceRow>();

    return apiResponse({
      devices: (result.results || []).map((device) => ({
        id: device.id,
        name: device.name,
        userAgent: device.user_agent,
        createdAt: device.created_at,
        lastSeenAt: device.last_seen_at,
        revokedAt: device.revoked_at,
        activeSessions: Number(device.active_sessions || 0),
        current: device.id === session.deviceId,
      })),
    }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
