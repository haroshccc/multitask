const ALLOWED_ORIGINS = new Set<string>([
  "https://multitask-one.vercel.app",
  "http://localhost:5173",
]);

export function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://multitask-one.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit & { origin?: string | null } = {}
): Response {
  const { origin, ...rest } = init;
  return new Response(JSON.stringify(body), {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin ?? null),
      ...(rest.headers ?? {}),
    },
  });
}
