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

// Import Hono and endpoint modules
import { Hono } from 'npm:hono@4';
import { regionEndpoints } from './region-endpoints.tsx';
import { onboardingFormAPI } from './onboarding-form-api.tsx';
import { onboardingConfigEndpoints } from './onboarding-config-endpoints.tsx';
import { roleConfigEndpoints } from './role-config-endpoints.tsx';
import { catalogEndpointsSQL } from './catalog-endpoints-sql.tsx';
import { staffScheduleEndpointsSQL } from './staff-schedule-endpoints-sql.tsx';
import { reschedulingPoliciesEndpointsSQL } from './rescheduling-policies-sql.tsx';
import { searchEndpointsSQL } from './search-endpoints-sql.tsx';
import { agoraVideoEndpointsSQL } from './agora-video-integration-sql.tsx';
import { donationManagementEndpointsSQL } from './donation-management-endpoints-sql.tsx';
// ✅ NEW: Batch 13 SQL-only endpoints
import { staffDiscoveryEndpoints } from './staff-discovery-endpoints-sql.tsx'; // ✅ SQL-only: Staff discovery (13 KV ops removed)
import standardizedOtpEndpointsSQL from './standardized-otp-endpoints-sql.tsx'; // ✅ SQL-only: Standardized OTP (11 KV ops removed)
import appointmentLifecycleEndpointsSQL from './appointment-lifecycle-endpoints-sql.tsx'; // ✅ SQL-only: Appointment lifecycle (13 KV ops removed)
import { transactionMonitoringEndpoints } from './transaction-monitoring-endpoints-sql.tsx'; // ✅ SQL-only: Transaction monitoring (Batch 7 Phase 4)
import { registerProfilePhotoEndpoints } from './profile-photo-management-sql.tsx'; // ✅ SQL-only: Profile photo management (11 KV ops removed)
import cctvAccessEndpointsSQL from './cctv-access-endpoints-sql.tsx'; // ✅ SQL-only: CCTV access (11 KV ops removed)
import homeServiceAutoAssignmentSQL from './home-service-auto-assignment-sql.tsx'; // ✅ SQL-only: Home service auto-assignment (11 KV ops removed)
import { registerPetSuggestionSystem } from './pet-suggestion-system-sql.tsx'; // ✅ SQL-only: Pet suggestion system (12 KV ops removed)
import advancedFilteringSystemSQL from './advanced-filtering-system-sql.tsx'; // ✅ SQL-only: Advanced filtering (15 KV ops removed)
import tierUpgradeAutomationSQL from './tier-upgrade-automation-sql.tsx'; // ✅ SQL-only: Tier upgrade automation (14 KV ops removed)

// Create Hono app instance
const app = new Hono();

// Register endpoint modules
try {
  console.log('✅ Registering region endpoints...');
  regionEndpoints(app);
} catch (error) {
  console.error('❌ Error registering region endpoints:', error);
}

try {
  console.log('✅ Registering onboarding form API...');
  onboardingFormAPI(app);
} catch (error) {
  console.error('❌ Error registering onboarding form API:', error);
}

try {
  console.log('✅ Registering onboarding config endpoints (vendor applications)...');
  onboardingConfigEndpoints(app);
} catch (error) {
  console.error('❌ Error registering onboarding config endpoints:', error);
}

try {
  console.log('✅ Registering role config endpoints (config/roles)...');
  roleConfigEndpoints(app);
} catch (error) {
  console.error('❌ Error registering role config endpoints:', error);
}

try {
  console.log('✅ Registering catalog endpoints (admin/catalog)...');
  catalogEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering catalog endpoints:', error);
}

try {
  console.log('✅ Registering staff schedule endpoints...');
  staffScheduleEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering staff schedule endpoints:', error);
}

try {
  console.log('✅ Registering rescheduling policies endpoints...');
  reschedulingPoliciesEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering rescheduling policies endpoints:', error);
}

try {
  console.log('✅ Registering search endpoints...');
  searchEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering search endpoints:', error);
}

try {
  console.log('✅ Registering Agora video integration endpoints...');
  agoraVideoEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering Agora video integration endpoints:', error);
}

// ✅ NEW: Batch 13 SQL-only endpoint registrations
try {
  console.log('✅ Registering staff discovery endpoints (SQL-only)...');
  staffDiscoveryEndpoints(app);
} catch (error) {
  console.error('❌ Error registering staff discovery endpoints:', error);
}

try {
  console.log('✅ Registering standardized OTP endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', standardizedOtpEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering standardized OTP endpoints:', error);
}

try {
  console.log('✅ Registering appointment lifecycle endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', appointmentLifecycleEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering appointment lifecycle endpoints:', error);
}

try {
  console.log('✅ Registering transaction monitoring endpoints (SQL-only)...');
  transactionMonitoringEndpoints(app);
} catch (error) {
  console.error('❌ Error registering transaction monitoring endpoints:', error);
}

// Health endpoint (simple, no dependencies)
app.get('/make-server-3dd53475/health', (c) => {
  const origin = c.req.header('origin');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() }, 200, {
    ...buildCorsHeaders(origin),
  });
});

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");

  // 1) Always answer preflight FIRST - this is critical for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
  }

  // 2) Try Hono app for all other requests
  try {
    const response = await app.fetch(req);
    
    // Ensure CORS headers are on the response
    const headers = new Headers(response.headers);
    const corsHeaders = buildCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    console.error('❌ [TOP-LEVEL] Error handling request:', error);
    return json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : String(error)
    }, 500, origin);
  }
});
