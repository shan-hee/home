import {
  apiResponse,
  ApiError,
  errorResponse,
  getRequestId,
  parseJsonBody,
  requireSameOrigin,
} from "../../lib/api";
import {
  assertLoginAllowed,
  clearLoginFailures,
  createOwnerSession,
  recordLoginFailure,
  verifyOwnerAccessKey,
} from "../../lib/auth";
import type { PagesContext } from "../../lib/types";

interface LoginBody {
  accessKey?: unknown;
  deviceId?: unknown;
  deviceName?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const onRequestPost = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request, context.env);
    const body = await parseJsonBody<LoginBody>(context.request);
    const accessKey = typeof body.accessKey === "string" ? body.accessKey : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const deviceName = typeof body.deviceName === "string" ? body.deviceName.trim() : "";

    if (!accessKey || accessKey.length > 512 || !UUID_PATTERN.test(deviceId) || !deviceName || deviceName.length > 80) {
      throw new ApiError(400, "INVALID_LOGIN_REQUEST", "登录信息格式无效");
    }

    const ipHash = await assertLoginAllowed(context.request, context.env);
    if (!await verifyOwnerAccessKey(context.env, accessKey)) {
      await recordLoginFailure(context.env, ipHash);
      throw new ApiError(401, "INVALID_ACCESS_KEY", "访问密钥无效或暂时无法登录");
    }

    await clearLoginFailures(context.env, ipHash);
    const session = await createOwnerSession(context.request, context.env, {
      id: deviceId,
      name: deviceName,
    });
    const headers = new Headers({ "set-cookie": session.cookie });
    return apiResponse({
      authenticated: true,
      device: {
        id: deviceId,
        name: deviceName,
      },
      expiresAt: session.expiresAt,
    }, requestId, { headers });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
