import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { clearSessionCookie, getOwnerSession } from "../../lib/auth";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const session = await getOwnerSession(context.request, context.env);
    if (!session) {
      return apiResponse({ authenticated: false }, requestId, {
        headers: { "set-cookie": clearSessionCookie(context.request) },
      });
    }

    return apiResponse({
      authenticated: true,
      device: {
        id: session.deviceId,
        name: session.deviceName,
      },
      expiresAt: session.expiresAt,
    }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
