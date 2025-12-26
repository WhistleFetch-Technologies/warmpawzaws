// ✅ PAYMENT FUNCTION: Payment processing
// Minimal imports - only payment endpoints

import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono@4/cors';
import { logger } from 'npm:hono@4/logger';
import { sendSuccess, sendError } from '../_shared/response-utils.ts';
import { paymentEndpoints } from './payment-endpoints.tsx';
import razorpayPaymentIntegrationSQL from './razorpay-payment-integration-sql.tsx';
import { marketplacePaymentEndpoints } from './marketplace-payment-endpoints.tsx';
import { refundReschedulingEndpointsSQL } from './refund-rescheduling-complete-sql.tsx';
import { registerPayoutCronJob } from './payout-cron-job.tsx';
import { registerSettlementAutomation } from './settlement-automation.tsx';

const app = new Hono();

// ✅ Global Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
  credentials: false,
}));
app.use('*', logger(console.log));

// ✅ CRITICAL: Global OPTIONS handler
app.options('*', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma');
  c.header('Access-Control-Max-Age', '86400');
  return c.text('', 204);
});

// ✅ Public health endpoint
app.get('/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), function: 'payment' });
});
app.get('/make-server-payment/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), function: 'payment' });
});
app.get('/make-server*/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), function: 'payment' });
});

// ✅ Register Payment Endpoints
console.log('✅ Registering Payment Endpoints...');
paymentEndpoints(app);
marketplacePaymentEndpoints(app);
refundReschedulingEndpointsSQL(app);
registerPayoutCronJob(app);
registerSettlementAutomation(app);
if (razorpayPaymentIntegrationSQL && typeof razorpayPaymentIntegrationSQL === 'object') {
  app.route('/make-server-3dd53475', razorpayPaymentIntegrationSQL);
}

// ✅ Root endpoint
app.get('/', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.text('Warmpawz Payment API Server');
});

// ✅ 404 handler
app.notFound((c) => {
  return sendError(c, 'Not Found', 404, { path: c.req.path });
});

// ✅ Error handler
app.onError((err, c) => {
  console.error('Server Error:', err);
  return sendError(c, err, 500);
});

// ✅ MINIMAL SAFETY WRAPPER
console.info('[make-server-payment] starting');

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
    if (pathname === '/health' || pathname === '/make-server-payment/health' || pathname.endsWith('/health')) {
      return new Response(
        JSON.stringify({ ok: true, status: 'ok', timestamp: Date.now(), path: pathname, function: 'payment' }),
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

