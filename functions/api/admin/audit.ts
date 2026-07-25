import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { requireOwnerSession } from "../../lib/auth";
import type { PagesContext } from "../../lib/types";

interface AuditRow {
  id: number;
  action: string;
  target: string;
  detail_json: string;
  device_id: string | null;
  created_at: string;
}

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    await requireOwnerSession(context.request, context.env);
    const result = await context.env.DB.prepare(`
      SELECT id, action, target, detail_json, device_id, created_at
      FROM audit_logs
      ORDER BY id DESC
      LIMIT 100
    `).all<AuditRow>();
    return apiResponse({
      entries: (result.results || []).map((entry) => ({
        id: entry.id,
        action: entry.action,
        target: entry.target,
        details: JSON.parse(entry.detail_json) as unknown,
        deviceId: entry.device_id,
        createdAt: entry.created_at,
      })),
    }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
