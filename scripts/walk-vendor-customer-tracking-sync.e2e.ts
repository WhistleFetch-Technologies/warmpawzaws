/**
 * Walk tracking sync E2E (HTTP script, no browser)
 *
 * Flow (matches vendor `HomeServiceTrackingManager` + customer `WalkLiveTrackingView`):
 * 1. Resolve a walk-style at_home booking (env or discover via TEST_CUSTOMER_PHONE)
 * 2. Vendor POST /vendor/bookings/:bookingId/start-session (OTP) — skipped if already in_progress or SKIP_START_SESSION=1
 * 3. Vendor POST /vendor/bookings/:bookingId/location-update with TEST_LAT / TEST_LNG
 * 4. Poll GET /tracking/booking/:bookingId until currentLocation is present
 * 5. Assert customer "map pin" equals the tracking API position (same extraction as
 *    `mapGpsTrackingToWalkData` in apps/customer-web/.../WalkLiveTrackingView.tsx)
 *
 * Required for a full run against a real API:
 * - A booking with service_name/type indicating a walk, at_home, destination coordinates (for GPS session creation)
 * - Valid TEST_VENDOR_ID owning the booking
 * - OTP: set TEST_OTP or rely on GET /vendor/bookings/:bookingId/details → otpCode
 *
 * Usage:
 *   npx tsx scripts/walk-vendor-customer-tracking-sync.e2e.ts
 *   set API_BASE_URL=https://...&& set TEST_CUSTOMER_PHONE=...&& set TEST_BOOKING_ID=...&& set TEST_VENDOR_ID=...&& npx tsx scripts/walk-vendor-customer-tracking-sync.e2e.ts
 *
 * Dry run (no mutations — only GETs and contract checks):
 *   DRY_RUN=1 npx tsx scripts/walk-vendor-customer-tracking-sync.e2e.ts
 */

const API_BASE = (process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com').replace(/\/$/, '');
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '';
const ENV_BOOKING_ID = (process.env.TEST_BOOKING_ID || '').trim();
const ENV_VENDOR_ID = (process.env.TEST_VENDOR_ID || '').trim();
const ENV_OTP = (process.env.TEST_OTP || '').trim();
const TEST_LAT = parseFloat(process.env.TEST_LAT || '12.9716');
const TEST_LNG = parseFloat(process.env.TEST_LNG || '77.5946');
const DRY_RUN =
  String(process.env.DRY_RUN || '').toLowerCase() === 'true' || process.env.DRY_RUN === '1';
const SKIP_START_SESSION =
  String(process.env.SKIP_START_SESSION || '').toLowerCase() === 'true' ||
  process.env.SKIP_START_SESSION === '1';
const FORCE_UAT = String(process.env.FORCE_UAT || '').toLowerCase() === 'true' || process.env.FORCE_UAT === '1';
const POLL_MS = Math.max(500, parseInt(process.env.POLL_MS || '2000', 10));
const POLL_ATTEMPTS = Math.max(1, parseInt(process.env.POLL_ATTEMPTS || '8', 10));
const EPS = 1e-4;

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.X_API_KEY || process.env.API_KEY;
  if (key) h['x-api-key'] = key;
  if (FORCE_UAT) h['x-uat-mode'] = 'true';
  return h;
}

async function fetchJson(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Must stay aligned with `mapGpsTrackingToWalkData` in:
 * apps/customer-web/components/customer/walker/WalkLiveTrackingView.tsx
 */
function extractCustomerWalkPinFromGpsTracking(tracking: Record<string, unknown> | null | undefined): {
  lat: number;
  lng: number;
} | null {
  if (!tracking) return null;
  const st = String(tracking.status ?? '').toLowerCase();
  if (st === 'completed' || st === 'cancelled') return null;

  const cur = tracking.currentLocation as
    | { latitude?: number; longitude?: number }
    | undefined;
  const start = tracking.startLocation as { latitude?: number; longitude?: number } | undefined;
  const dest = tracking.destinationLocation as { latitude?: number; longitude?: number } | undefined;

  const lat = cur?.latitude ?? start?.latitude ?? dest?.latitude;
  const lng = cur?.longitude ?? start?.longitude ?? dest?.longitude;
  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return null;
  }
  return { lat: Number(lat), lng: Number(lng) };
}

function isWalkLikeBooking(b: Record<string, unknown>): boolean {
  const name = String(b.serviceName || b.service_name || '').toLowerCase();
  const type = String(b.serviceType || b.service_type || '').toLowerCase();
  return (
    name.includes('walk') ||
    name.includes('stroll') ||
    type.includes('walk') ||
    type === 'walking'
  );
}

async function resolveBookingAndVendor(): Promise<{ bookingId: string; vendorId: string }> {
  if (ENV_BOOKING_ID && ENV_VENDOR_ID) {
    return { bookingId: ENV_BOOKING_ID, vendorId: ENV_VENDOR_ID };
  }

  if (!TEST_PHONE) {
    throw new Error('Set TEST_BOOKING_ID + TEST_VENDOR_ID, or TEST_CUSTOMER_PHONE for discovery');
  }

  const list = await fetchJson('GET', `/customer/bookings?phone=${encodeURIComponent(TEST_PHONE)}`);
  const bookings: any[] = list.data?.bookings || list.data || [];
  const candidate = bookings.find((b) => {
    const style = String(b.service_style || b.serviceStyle || '').toLowerCase();
    const atHome = style === 'at_home' || style.includes('home');
    return atHome && isWalkLikeBooking(b) && (b.status === 'confirmed' || b.status === 'in_progress');
  });

  if (!candidate) {
    throw new Error(
      `No suitable walk at_home booking (confirmed or in_progress) for phone ${TEST_PHONE}. ` +
        `Set TEST_BOOKING_ID and TEST_VENDOR_ID explicitly.`
    );
  }

  const bookingId = String(candidate.id || candidate.bookingId || candidate.booking_id || '');
  const vendorId = String(candidate.vendor_id || candidate.vendorId || '');
  if (!bookingId || !vendorId) {
    throw new Error('Resolved booking missing id or vendor_id');
  }
  return { bookingId, vendorId };
}

async function getVendorBookingDetails(bookingId: string): Promise<Record<string, unknown>> {
  const r = await fetchJson('GET', `/vendor/bookings/${encodeURIComponent(bookingId)}/details`);
  if (!r.ok) {
    throw new Error(`GET /vendor/bookings/.../details failed: ${r.status} ${JSON.stringify(r.data)}`);
  }
  const booking = r.data?.booking || r.data;
  return (booking || {}) as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log('Walk tracking sync E2E');
  console.log(`API_BASE_URL=${API_BASE}`);
  console.log(`DRY_RUN=${DRY_RUN} SKIP_START_SESSION=${SKIP_START_SESSION}`);
  console.log(`TEST_LAT=${TEST_LAT} TEST_LNG=${TEST_LNG}\n`);

  const { bookingId, vendorId } = await resolveBookingAndVendor();
  console.log(`Booking: ${bookingId}`);
  console.log(`Vendor:  ${vendorId}`);

  const details = await getVendorBookingDetails(bookingId);
  const status = String(details.status || '');
  const otp =
    ENV_OTP ||
    String(details.otpCode || details.otp_code || (details as any).otp || '').trim();

  if (!isWalkLikeBooking(details)) {
    console.warn('⚠️ Booking may not be classified as a walk in API fields; continuing anyway.');
  }

  if (!DRY_RUN && status === 'confirmed' && !SKIP_START_SESSION) {
    if (!/^\d{4}$/.test(otp)) {
      throw new Error(
        'Missing 4-digit OTP: set TEST_OTP or ensure booking has otp_code (GET /vendor/bookings/:id/details → otpCode)'
      );
    }
    console.log('\n→ POST /vendor/bookings/:id/start-session');
    const start = await fetchJson('POST', `/vendor/bookings/${encodeURIComponent(bookingId)}/start-session`, {
      vendorId,
      otp,
    });
    if (!start.ok && start.data?.error !== 'Session already started') {
      throw new Error(`start-session failed: ${start.status} ${JSON.stringify(start.data)}`);
    }
    console.log('   start-session:', start.data?.message || start.data?.error || 'ok');
  } else if (DRY_RUN) {
    console.log('\n(DRY_RUN: skipping start-session and location-update)');
  } else {
    console.log('\n(skipping start-session: already in progress or SKIP_START_SESSION)');
  }

  if (!DRY_RUN) {
    console.log('\n→ POST /vendor/bookings/:id/location-update');
    const loc = await fetchJson('POST', `/vendor/bookings/${encodeURIComponent(bookingId)}/location-update`, {
      latitude: TEST_LAT,
      longitude: TEST_LNG,
      accuracy: 10,
    });
    if (!loc.ok) {
      throw new Error(`location-update failed: ${loc.status} ${JSON.stringify(loc.data)}`);
    }
    if (String(loc.data?.message || '').includes('No active session')) {
      throw new Error(
        'No active gps_tracking_sessions row for this booking. ' +
          'Ensure at_home booking has destination coordinates and session was started (start-session creates GPS when possible).'
      );
    }
    console.log('   location-update ok', { eta: loc.data?.eta, distanceRemaining: loc.data?.distanceRemaining });
  }

  console.log('\n→ Poll GET /tracking/booking/:bookingId (customer-facing)');
  let tracking: Record<string, unknown> | null = null;
  const attempts = DRY_RUN ? 1 : POLL_ATTEMPTS;
  for (let i = 0; i < attempts; i++) {
    const tr = await fetchJson('GET', `/tracking/booking/${encodeURIComponent(bookingId)}`);
    if (!tr.ok) {
      throw new Error(`GET /tracking/booking failed: ${tr.status} ${JSON.stringify(tr.data)}`);
    }
    const t = tr.data?.tracking;
    if (t && extractCustomerWalkPinFromGpsTracking(t as Record<string, unknown>)) {
      tracking = t as Record<string, unknown>;
      break;
    }
    if (!DRY_RUN) {
      console.log(`   poll ${i + 1}/${POLL_ATTEMPTS}: no fixable position yet`);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }

  if (!tracking) {
    if (DRY_RUN) {
      console.log('\n✅ DRY_RUN: GET /tracking/booking OK (no active session or no coordinates — expected without mutations).');
      return;
    }
    throw new Error(
      'GET /tracking/booking did not return a mappable position. ' +
        'Check GPS session status and that location-update succeeded.'
    );
  }

  const pin = extractCustomerWalkPinFromGpsTracking(tracking);
  if (!pin) {
    throw new Error('extractCustomerWalkPinFromGpsTracking returned null');
  }

  const apiCur = tracking.currentLocation as { latitude?: number; longitude?: number } | undefined;
  if (apiCur?.latitude != null && apiCur?.longitude != null) {
    const dLat = Math.abs(Number(apiCur.latitude) - pin.lat);
    const dLng = Math.abs(Number(apiCur.longitude) - pin.lng);
    if (dLat > EPS || dLng > EPS) {
      throw new Error(
        `Internal inconsistency: currentLocation (${apiCur.latitude},${apiCur.longitude}) vs pin (${pin.lat},${pin.lng})`
      );
    }
  }

  if (!DRY_RUN) {
    const dLat = Math.abs(pin.lat - TEST_LAT);
    const dLng = Math.abs(pin.lng - TEST_LNG);
    if (dLat > 0.02 || dLng > 0.02) {
      throw new Error(
        `Position mismatch: customer view pin (${pin.lat}, ${pin.lng}) vs sent (${TEST_LAT}, ${TEST_LNG}). ` +
          `Delta: ${dLat}, ${dLng}`
      );
    }
  }

  console.log('\n✅ ASSERT OK: customer-view pin matches GET /tracking/booking');
  console.log(`   Pin: (${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)})`);
  if (apiCur) {
    console.log(`   Raw currentLocation: (${Number(apiCur.latitude).toFixed(6)}, ${Number(apiCur.longitude).toFixed(6)})`);
  }

  const legacy = await fetchJson('GET', `/customer/${encodeURIComponent(bookingId)}/track-walk`);
  if (legacy.ok && legacy.data?.success && legacy.data?.isActive) {
    const lw = legacy.data?.currentPosition;
    if (lw?.lat != null && lw?.lng != null) {
      console.log('\nℹ️ Legacy walker_live_sessions also active; coords:', lw.lat, lw.lng);
    }
  }
}

main().catch((e) => {
  console.error('\n❌ FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
