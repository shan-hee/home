export const onRequest = () => {
  return Response.json({
    ok: true,
    service: "home-pages-functions",
  });
};
