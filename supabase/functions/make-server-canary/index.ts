// ✅ MINIMAL CANARY FUNCTION: Tests infrastructure vs code
// If this works, the issue is with make-server-3dd53475 size/deps
// If this fails, it's a wider infrastructure issue

console.info('[make-server-canary] starting');

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,Content-Type,Authorization,X-Requested-With,Accept',
    'Access-Control-Max-Age': '86400',
    'Connection': 'keep-alive'
  };
}

function isHealth(pathname: string): boolean {
  if (pathname === '/health' || pathname === '/make-server-canary/health') return true;
  return /^\/make-server-canary\/health$/.test(pathname) || pathname.endsWith('/health');
}

Deno.serve(async (req: Request) => {
  try {
    // ✅ CRITICAL: Global preflight guard FIRST
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const { pathname } = new URL(req.url);

    // ✅ Health must be public and simple
    if (isHealth(pathname)) {
      return new Response(
        JSON.stringify({ ok: true, status: 'ok', timestamp: Date.now(), path: pathname }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders()
          } 
        }
      );
    }

    // ✅ Default OK
    return new Response(
      JSON.stringify({ message: 'Canary function working', path: pathname }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
    );

  } catch (e) {
    console.error('[make-server-canary] handler error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e instanceof Error ? e.message : String(e) }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders()
        } 
      }
    );
  }
});

// ✅ Background init guarded to avoid ReferenceError
(async () => {
  try {
    // @ts-ignore - check existence safely
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(Promise.resolve());
    }
  } catch {
    /* no-op */
  }
})();

