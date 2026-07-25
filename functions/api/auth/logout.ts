import { apiResponse, errorResponse, getRequestId, requireSameOrigin } from "../../lib/api";
import {
  clearSessionCookie,
  getOwnerSession,
  sessionTokenFromRequest,
  writeAuditLog,
} from "../../lib/auth";
import { sha256Hex } from "../../lib/crypto";
import type { PagesContext } from "../../lib/types";

export const onRequestPost = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request, context.env);
    const session = await getOwnerSession(context.request, context.env, false);
    const rawToken = sessionTokenFromRequest(context.request);

    if (session) {
      await writeAuditLog(context.env, session, "auth.logout", "session");
    }
    if (rawToken) {
      const tokenHash = await sha256Hex(rawToken);
      await context.env.DB.prepare(
        "UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
      ).bind(new Date().toISOString(), tokenHash).run();
    }

    return apiResponse({ authenticated: false }, requestId, {
      headers: { "set-cookie": clearSessionCookie(context.request) },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
