import { apiResponse, errorResponse, getRequestId } from "../../lib/api";
import { resolveNeteaseLyrics } from "../../lib/music";
import type { PagesContext } from "../../lib/types";

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    const id = new URL(context.request.url).searchParams.get("id")?.trim() || "";
    const lyrics = await resolveNeteaseLyrics(id);
    return apiResponse(lyrics, requestId, {}, "public, max-age=3600");
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
