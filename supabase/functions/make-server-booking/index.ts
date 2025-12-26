// ✅ BOOKING FUNCTION: Booking management
// Minimal imports - only booking endpoints

import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono@4/cors';
import { logger } from 'npm:hono@4/logger';
import { sendSuccess, sendError } from '../_shared/response-utils.ts';
import { bookingEndpoints } from './booking-endpoints.tsx';
import { registerBookingLifecycleManagement } from './booking-lifecycle-management-sql.tsx';
import { bookingManagementEndpointsSQL } from './booking-management-endpoints-sql.tsx';
import { homeServicesEndpointsSQL } from './home-services-endpoints-sql.tsx';
import { followupEndpointsSQL } from './followup-endpoints-sql.tsx';
import { registerMedicalHistoryEndpoints } from './medical-history-endpoints.tsx';
import { registerUniversalStaffSchedule } from './universal-staff-schedule-sql.tsx';
import { registerCenterAvailabilityEndpoints } from './center-availability-endpoints-sql.tsx';
import { registerBoardingRoomManagement } from './boarding-room-management.tsx';

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
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), function: 'booking' });
});
app.get('/make-server-booking/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), function: 'booking' });
});
app.get('/make-server*/health', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), function: 'booking' });
});

// ✅ Register Booking Endpoints
console.log('✅ Registering Booking Endpoints...');
bookingEndpoints(app);
registerBookingLifecycleManagement(app);
bookingManagementEndpointsSQL(app);
homeServicesEndpointsSQL(app);
followupEndpointsSQL(app);
registerMedicalHistoryEndpoints(app);
registerUniversalStaffSchedule(app);
registerCenterAvailabilityEndpoints(app);
registerBoardingRoomManagement(app);

// ✅ Root endpoint
app.get('/', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  return c.text('Warmpawz Booking API Server');
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
console.info('[make-server-booking] starting');

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
    if (pathname === '/health' || pathname === '/make-server-booking/health' || pathname.endsWith('/health')) {
      return new Response(
        JSON.stringify({ ok: true, status: 'ok', timestamp: Date.now(), path: pathname, function: 'booking' }),
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

