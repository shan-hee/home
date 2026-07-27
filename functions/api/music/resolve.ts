import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { resolveNeteasePlaybackUrl } from "../../lib/music";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const id = new URL(context.request.url).searchParams.get("id")?.trim() || "";
    const url = await resolveNeteasePlaybackUrl(id);
    return apiResponse({ url }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
