// ✅ MINIMAL BOOT VERSION: Only essential imports at top level
// This version loads endpoints lazily to prevent bundle explosion

import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono@4/cors';
import { logger } from 'npm:hono@4/logger';

const app = new Hono();

// ✅ CRITICAL: Global middleware FIRST
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
  credentials: false,
}));
app.use('*', logger(console.log));

// ✅ CRITICAL: Global OPTIONS handler - MUST be before any route registration
app.options('*', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma');
  c.header('Access-Control-Max-Age', '86400');
  return c.text('', 204);
});

// ✅ CRITICAL: Public health endpoint - accessible without auth
app.get('/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/make-server-3dd53475/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/make-server*/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ LAZY LOADING: Endpoints loaded in background after boot
let endpointsLoaded = false;
const loadEndpoints = async () => {
  if (endpointsLoaded) return;
  try {
    console.log('🔄 Loading endpoints lazily...');
    // Dynamic imports - loaded after server boots
    const { regionEndpoints } = await import('./region-endpoints.tsx');
    regionEndpoints(app);
    
    // Add more critical endpoints here as needed
    // All other endpoints can be loaded on-demand
    
    endpointsLoaded = true;
    console.log('✅ Endpoints loaded');
  } catch (error) {
    console.error('❌ Failed to load endpoints:', error);
  }
};

// Load endpoints in background (non-blocking)
loadEndpoints().catch(console.error);

// ✅ MINIMAL SAFETY WRAPPER
console.info('[make-server] starting (minimal boot)');

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,Content-Type,Authorization,X-Requested-With,Accept',
    'Access-Control-Max-Age': '86400',
    'Connection': 'keep-alive'
  };
}

Deno.serve(async (req: Request) => {
  try {
    const { pathname } = new URL(req.url);
    
    // ✅ CRITICAL: Global preflight guard FIRST
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    
    // ✅ Health must be public and simple
    if (pathname === '/health' || pathname === '/make-server-3dd53475/health' || pathname.endsWith('/health')) {
      return new Response(
        JSON.stringify({ ok: true, status: 'ok', timestamp: Date.now(), path: pathname }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
      );
    }
    
    // ✅ Try Hono app
    try {
      return await app.fetch(req);
    } catch (appError) {
      console.error('❌ [HONO-APP] Error:', appError);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: appError instanceof Error ? appError.message : String(appError) }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
      );
    }
    
  } catch (error) {
    console.error('❌ [TOP-LEVEL] Unhandled request error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
    );
  }
});

// ✅ Background init guarded
(async () => {
  try {
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(Promise.resolve());
    }
  } catch {
    /* no-op */
  }
})();

