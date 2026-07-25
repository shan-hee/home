export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export const requestJson = async <ResponseBody>(
  input: string,
  init: RequestInit = {},
): Promise<ResponseBody> => {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({})) as ResponseBody & ApiErrorPayload;
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload.error?.code || "REQUEST_FAILED",
      payload.error?.message || "请求失败，请稍后再试",
    );
  }
  return payload;
};
