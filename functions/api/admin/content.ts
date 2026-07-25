import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { requireOwnerSession } from "../../lib/auth";
import { loadSiteContent } from "../../lib/siteContent";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    await requireOwnerSession(context.request, context.env);
    const content = await loadSiteContent(context.env.DB);
    return apiResponse(content, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
