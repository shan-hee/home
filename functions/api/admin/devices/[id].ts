import {
  apiResponse,
  ApiError,
  errorResponse,
  getRequestId,
  requireSameOrigin,
} from "../../../lib/api";
import {
  clearSessionCookie,
  requireOwnerSession,
  writeAuditLog,
} from "../../../lib/auth";
import type { PagesContext } from "../../../lib/types";

const routeId = (context: PagesContext) => {
  const value = context.params?.id;
  return Array.isArray(value) ? value[0] : value;
};

export const onRequestDelete = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request);
    const session = await requireOwnerSession(context.request, context.env);
    const deviceId = routeId(context)?.trim() || "";
    if (!deviceId || deviceId.length > 80) {
      throw new ApiError(400, "INVALID_DEVICE_ID", "设备标识无效");
    }

    const exists = await context.env.DB.prepare(
      "SELECT id FROM owner_devices WHERE id = ?",
    ).bind(deviceId).first<{ id: string }>();
    if (!exists) throw new ApiError(404, "DEVICE_NOT_FOUND", "设备不存在");

    const now = new Date().toISOString();
    await writeAuditLog(context.env, session, "device.revoke", deviceId, {
      current: deviceId === session.deviceId,
    });
    await context.env.DB.batch([
      context.env.DB.prepare(
        "UPDATE owner_devices SET revoked_at = ? WHERE id = ?",
      ).bind(now, deviceId),
      context.env.DB.prepare(
        "UPDATE auth_sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL",
      ).bind(now, deviceId),
    ]);

    const headers = new Headers();
    if (deviceId === session.deviceId) {
      headers.set("set-cookie", clearSessionCookie(context.request));
    }
    return apiResponse({
      revoked: true,
      currentSessionRevoked: deviceId === session.deviceId,
    }, requestId, { headers });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
