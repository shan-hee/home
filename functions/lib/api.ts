import { jsonResponse } from "./http";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const getRequestId = (request: Request) => {
  return request.headers.get("cf-ray")?.trim() || crypto.randomUUID();
};

export const apiResponse = (
  body: unknown,
  requestId: string,
  init: ResponseInit = {},
  cacheControl = "no-store",
) => {
  const headers = new Headers(init.headers);
  headers.set("x-request-id", requestId);
  return jsonResponse(body, { ...init, headers }, cacheControl);
};

export const errorResponse = (error: unknown, requestId: string) => {
  if (error instanceof ApiError) {
    return apiResponse({
      error: {
        code: error.code,
        message: error.message,
      },
    }, requestId, { status: error.status });
  }

  console.error(`请求 ${requestId} 处理失败：`, error);
  return apiResponse({
    error: {
      code: "INTERNAL_ERROR",
      message: "服务暂时不可用",
    },
  }, requestId, { status: 500 });
};

export const parseJsonBody = async <Body>(request: Request, maxBytes = 4096): Promise<Body> => {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "CONTENT_TYPE_REQUIRED", "请求必须使用 JSON");
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, "REQUEST_TOO_LARGE", "请求内容过大");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError(413, "REQUEST_TOO_LARGE", "请求内容过大");
  }

  try {
    return JSON.parse(text) as Body;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "请求 JSON 格式无效");
  }
};

export const requireSameOrigin = (request: Request) => {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin")?.trim();
  if (!origin || origin !== expected) {
    throw new ApiError(403, "ORIGIN_REJECTED", "请求来源不受信任");
  }
};
