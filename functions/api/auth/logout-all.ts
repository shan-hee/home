import { apiResponse, errorResponse, getRequestId, requireSameOrigin } from "../../lib/api";
import {
  clearSessionCookie,
  requireOwnerSession,
  writeAuditLog,
} from "../../lib/auth";
import type { PagesContext } from "../../lib/types";

export const onRequestPost = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request, context.env);
    const session = await requireOwnerSession(context.request, context.env);
    const now = new Date().toISOString();
    await writeAuditLog(context.env, session, "auth.logout_all", "sessions");
    await context.env.DB.prepare(
      "UPDATE auth_sessions SET revoked_at = ? WHERE revoked_at IS NULL",
    ).bind(now).run();

    return apiResponse({ authenticated: false }, requestId, {
      headers: { "set-cookie": clearSessionCookie(context.request) },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
