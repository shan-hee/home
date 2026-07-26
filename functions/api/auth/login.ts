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
  verifyOwnerPassword,
} from "../../lib/auth";
import type { PagesContext } from "../../lib/types";

interface LoginBody {
  password?: unknown;
  deviceName?: unknown;
}

export const onRequestPost = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request, context.env);
    const body = await parseJsonBody<LoginBody>(context.request);
    const password = typeof body.password === "string" ? body.password : "";
    const deviceId = crypto.randomUUID();
    const deviceName = typeof body.deviceName === "string" ? body.deviceName.trim() : "";

    if (!password || password.length > 128 || !deviceName || deviceName.length > 80) {
      throw new ApiError(400, "INVALID_LOGIN_REQUEST", "登录信息格式无效");
    }

    const ipHash = await assertLoginAllowed(context.request, context.env);
    if (!await verifyOwnerPassword(context.env, password)) {
      await recordLoginFailure(context.env, ipHash);
      throw new ApiError(401, "INVALID_PASSWORD", "密码错误或暂时无法登录");
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
