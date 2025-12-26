// supabase/functions/make-server-3dd53475/index.ts

// Centralized CORS configuration
const DEFAULT_ALLOW_ORIGIN = "*"; // tighten in production
const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? DEFAULT_ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
  } as Record<string, string>;
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(origin),
    },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");

  // 1) Always answer preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
  }

  // 2) Public health
  if (req.method === "GET" && url.pathname === "/make-server-3dd53475/health") {
    return json({ status: "ok" }, 200, origin);
  }

  // 3) Regions routes (public for now; add auth later as needed)
  if (url.pathname === "/make-server-3dd53475/regions/active" && req.method === "GET") {
    // TODO: replace with real data source
    return json({ region: "ap-south-1", status: "active" }, 200, origin);
  }

  if (url.pathname === "/make-server-3dd53475/regions/india" && req.method === "GET") {
    // TODO: replace with real data source
    return json({ region: "ap-south-1", country: "IN" }, 200, origin);
  }

  // 4) Fallback
  return json({ error: "Not Found" }, 404, origin);
});

