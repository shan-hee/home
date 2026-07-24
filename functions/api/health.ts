import { jsonResponse } from "../lib/http";

export const onRequest = () => {
  return jsonResponse({
    ok: true,
    service: "home-pages-functions",
  });
};
