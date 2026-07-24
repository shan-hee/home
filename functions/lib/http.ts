export const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

export const jsonResponse = (
  body: unknown,
  init: ResponseInit = {},
  cacheControl = "no-store",
) => {
  const headers = new Headers(init.headers);
  headers.set("cache-control", cacheControl);
  headers.set("content-type", "application/json; charset=utf-8");
  Object.entries(securityHeaders).forEach(([name, value]) => headers.set(name, value));
  return new Response(JSON.stringify(body), { ...init, headers });
};

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeout = 5000,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const fetchJson = async <ResponseBody>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeout = 5000,
) => {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  const response = await fetchWithTimeout(input, { ...init, headers }, timeout);
  if (!response.ok) throw new Error(`上游接口返回 ${response.status}`);
  return await response.json() as ResponseBody;
};
