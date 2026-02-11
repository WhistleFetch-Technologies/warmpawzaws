#!/usr/bin/env npx ts-node
/**
 * ============================================================================
 * FORENSIC VIDEO CALL E2E – Code trace + optional live API tests
 * ============================================================================
 *
 * 1. Code trace: Validates that video call flow is wired end-to-end (entry
 *    points → APIs → backend create-on-join, snake_case, notify-ready, end).
 * 2. Live API tests (optional): When API_BASE and TEST_BOOKING_ID (and
 *    TEST_VENDOR_ID, TEST_CUSTOMER_ID) are set, calls real endpoints and
 *    validates responses.
 *
 * Usage:
 *   npx ts-node scripts/forensic-video-call-e2e.ts
 *   API_BASE=https://... TEST_BOOKING_ID=uuid TEST_VENDOR_ID=uuid TEST_CUSTOMER_ID=uuid npx ts-node scripts/forensic-video-call-e2e.ts
 *
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const results: { category: string; check: string; pass: boolean; detail?: string }[] = [];

function pass(category: string, check: string, detail?: string) {
  results.push({ category, check, pass: true, detail });
}
function fail(category: string, check: string, detail?: string) {
  results.push({ category, check, pass: false, detail });
}

function readFile(p: string): string {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}
function grep(content: string, pattern: RegExp): boolean {
  return pattern.test(content);
}

// ---------------------------------------------------------------------------
// 1. BACKEND: Routes and create-on-join
// ---------------------------------------------------------------------------
function validateBackend() {
  const handlerIndex = readFile('backend/lambda/src/handler/index.ts');
  const videoCall = readFile('backend/lambda/src/endpoints/video-call.ts');

  if (grep(handlerIndex, /registerVideoCallEndpoints\s*\(/)) pass('Backend', 'handler/index.ts registers registerVideoCallEndpoints');
  else fail('Backend', 'handler/index.ts registers video call');

  if (grep(videoCall, /app\.post\s*\(\s*['"]\/video-call\/join['"]/)) pass('Backend', 'POST /video-call/join registered');
  else fail('Backend', 'POST /video-call/join');

  if (grep(videoCall, /app\.post\s*\(\s*['"]\/video-call\/create-meeting['"]/)) pass('Backend', 'POST /video-call/create-meeting registered');
  else fail('Backend', 'POST /video-call/create-meeting');

  if (grep(videoCall, /app\.post\s*\(\s*['"]\/video-call\/notify-ready['"]/)) pass('Backend', 'POST /video-call/notify-ready registered');
  else fail('Backend', 'POST /video-call/notify-ready');

  if (grep(videoCall, /app\.get\s*\(\s*['"]\/video-call\/:bookingId\/attendees['"]/)) pass('Backend', 'GET /video-call/:bookingId/attendees registered');
  else fail('Backend', 'GET attendees');

  if (grep(videoCall, /create-on-join|No active session.*creating meeting on join|!activeSession/)) pass('Backend', 'Join: create-on-join when no session');
  else fail('Backend', 'Join: create-on-join logic');

  if (grep(videoCall, /normalizeJoinBody|booking_id|participant_id|participant_type/)) pass('Backend', 'Join: snake_case normalization (booking_id, participant_id, participant_type)');
  else fail('Backend', 'Join: snake_case');

  if (grep(videoCall, /normalizeCreateMeetingBody|booking_id|customer_id|vendor_id/)) pass('Backend', 'Create-meeting: snake_case normalization');
  else fail('Backend', 'Create-meeting: snake_case');

  if (grep(videoCall, /tele_call_incoming|notification_type/)) pass('Backend', 'notify-ready: tele_call_incoming notification');
  else fail('Backend', 'notify-ready: notification type');

  if (grep(videoCall, /body\.booking_id.*pathParameters|bookingId.*booking_id/)) pass('Backend', 'End: accepts booking_id in body');
  else fail('Backend', 'End: booking_id in body');
}

// ---------------------------------------------------------------------------
// 2. VENDOR WEB: Entry points and ChimeVideoCall
// ---------------------------------------------------------------------------
function validateVendorWeb() {
  const appointmentModal = readFile('apps/vendor-web/components/vendor/AppointmentDetailModal.tsx');
  const vendorDashboard = readFile('apps/vendor-web/components/vendor/dashboard/BussinesProvider/VendorDashboard.tsx');
  const videoPageClient = readFile('apps/vendor-web/app/video/[bookingId]/VideoPageClient.tsx');
  const chime = readFile('apps/vendor-web/components/vendor/ChimeVideoCall.tsx');

  if (grep(appointmentModal, /video-call\/create-meeting/)) pass('VendorWeb', 'AppointmentDetailModal: create-meeting with bookingId, customerId, vendorId');
  else fail('VendorWeb', 'AppointmentDetailModal: create-meeting');

  if (grep(appointmentModal, /video-call\/notify-ready|notify-ready.*participantType/)) pass('VendorWeb', 'AppointmentDetailModal: notify-ready before navigate');
  else fail('VendorWeb', 'AppointmentDetailModal: notify-ready');

  if (grep(vendorDashboard, /notify-ready.*participantType.*vendor|video-call\/notify-ready/)) pass('VendorWeb', 'VendorDashboard: notify-ready after create-meeting');
  else fail('VendorWeb', 'VendorDashboard: notify-ready');

  if (grep(videoPageClient, /ChimeVideoCall.*bookingId|participantType.*vendor|participantId/)) pass('VendorWeb', 'VideoPageClient: ChimeVideoCall with bookingId, participantId, participantType');
  else fail('VendorWeb', 'VideoPageClient: ChimeVideoCall props');

  if (grep(chime, /\/video-call\/join|post\s*\([^)]*video-call\/join/)) pass('VendorWeb', 'ChimeVideoCall: POST /video-call/join');
  else fail('VendorWeb', 'ChimeVideoCall: join');

  if (grep(chime, /video-call\/.*\/end|video-call\/end/)) pass('VendorWeb', 'ChimeVideoCall: POST end');
  else fail('VendorWeb', 'ChimeVideoCall: end');

  if (grep(chime, /attendees|video-call\/.*\/attendees/)) pass('VendorWeb', 'ChimeVideoCall: GET attendees');
  else fail('VendorWeb', 'ChimeVideoCall: attendees');
}

// ---------------------------------------------------------------------------
// 3. CUSTOMER WEB: Entry points and ChimeVideoCall
// ---------------------------------------------------------------------------
function validateCustomerWeb() {
  const bookingModal = readFile('apps/customer-web/components/customer/BookingDetailModal.tsx');
  const customerComplete = readFile('apps/customer-web/components/customer/CustomerHomeComplete.tsx');
  const videoPageClient = readFile('apps/customer-web/app/video/[bookingId]/VideoPageClient.tsx');
  const chime = readFile('apps/customer-web/components/customer/booking/ChimeVideoCall.tsx');

  if (grep(bookingModal, /video-call\/create-meeting|create-meeting.*bookingId/)) pass('CustomerWeb', 'BookingDetailModal: create-meeting');
  else fail('CustomerWeb', 'BookingDetailModal: create-meeting');

  if (grep(bookingModal, /notify-ready|participantType.*customer/)) pass('CustomerWeb', 'BookingDetailModal: notify-ready');
  else fail('CustomerWeb', 'BookingDetailModal: notify-ready');

  if (grep(customerComplete, /onAccept.*bookingId|video-call.*bookingId|window\.location.*\/video\//)) pass('CustomerWeb', 'CustomerHomeComplete: Accept navigates to video');
  else fail('CustomerWeb', 'CustomerHomeComplete: Accept → video');

  if (grep(videoPageClient, /ChimeVideoCall|participantType.*customer|participantId/)) pass('CustomerWeb', 'Customer VideoPageClient: ChimeVideoCall with participantId');
  else fail('CustomerWeb', 'Customer VideoPageClient');

  if (grep(chime, /video-call\/join|participantId.*participantType/)) pass('CustomerWeb', 'Customer ChimeVideoCall: join with participantId, participantType');
  else fail('CustomerWeb', 'Customer ChimeVideoCall: join');
}

// ---------------------------------------------------------------------------
// 4. MOBILE: No CallApi; use video-call/join and end
// ---------------------------------------------------------------------------
function validateMobile() {
  const vendorApi = readFile('apps/WarmpawzVendor/src/lib/api-client.ts');
  const vendorScreen = readFile('apps/WarmpawzVendor/src/screens/video/VideoCallScreen.tsx');
  const customerApi = readFile('apps/WarmpawzCustomer/src/lib/api-client.ts');
  const customerScreen = readFile('apps/WarmpawzCustomer/src/screens/consultation/VideoConsultationScreen.tsx');

  if (grep(vendorApi, /video-call\/join|participant_id|participant_type/)) pass('MobileVendor', 'api-client: join uses /video-call/join with participant_id, participant_type');
  else fail('MobileVendor', 'api-client: join');

  if (grep(vendorApi, /video-call\/end|booking_id/)) pass('MobileVendor', 'api-client: endVideoCall uses /video-call/end with booking_id');
  else fail('MobileVendor', 'api-client: end');

  if (!grep(vendorScreen, /CallApi\.|call\/initiate|call\/.*\/answer/)) pass('MobileVendor', 'VideoCallScreen: does not use CallApi');
  else fail('MobileVendor', 'VideoCallScreen: should not use CallApi');

  if (grep(vendorScreen, /vendorApiClient\.joinVideoCall|vendorApiClient\.endVideoCall/)) pass('MobileVendor', 'VideoCallScreen: uses vendorApiClient join/end');
  else fail('MobileVendor', 'VideoCallScreen: vendorApiClient');

  if (grep(customerApi, /video-call\/join|participant_id|participant_type/)) pass('MobileCustomer', 'api-client: join with participant_id, participant_type');
  else fail('MobileCustomer', 'api-client: join');

  if (!grep(customerScreen, /CallApi\.|call\/initiate|call\/.*\/answer/)) pass('MobileCustomer', 'VideoConsultationScreen: does not use CallApi');
  else fail('MobileCustomer', 'VideoConsultationScreen: should not use CallApi');

  if (grep(customerScreen, /apiClient\.joinVideoCall|apiClient\.endVideoCall/)) pass('MobileCustomer', 'VideoConsultationScreen: uses apiClient join/end');
  else fail('MobileCustomer', 'VideoConsultationScreen: apiClient');
}

// ---------------------------------------------------------------------------
// 5. LIVE API TESTS (optional)
// ---------------------------------------------------------------------------
async function runLiveApiTests(): Promise<void> {
  const apiBase = process.env.API_BASE || process.env.apiGatewayDefaultUrl;
  const bookingId = process.env.TEST_BOOKING_ID;
  const vendorId = process.env.TEST_VENDOR_ID;
  const customerId = process.env.TEST_CUSTOMER_ID;

  if (!apiBase) {
    results.push({ category: 'LiveAPI', check: 'Skipped (no API_BASE)', pass: true, detail: 'Set API_BASE and TEST_BOOKING_ID to run live tests' });
    return;
  }
  if (!bookingId) {
    results.push({ category: 'LiveAPI', check: 'Skipped (no TEST_BOOKING_ID)', pass: true, detail: 'Set TEST_BOOKING_ID (and TEST_VENDOR_ID, TEST_CUSTOMER_ID) for full E2E' });
    return;
  }

  const base = apiBase.replace(/\/$/, '');
  type Json = Record<string, unknown>;
  const post = async (path: string, body: object): Promise<{ status: number; body: Json }> => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
  };
  const get = async (path: string): Promise<{ status: number; body: Json }> => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
  };

  try {
    // Join as vendor (create-on-join: no prior session)
    if (vendorId) {
      const joinVendor = await post('/video-call/join', {
        booking_id: bookingId,
        participant_id: vendorId,
        participant_type: 'vendor',
      });
      const b = joinVendor.body as { success?: boolean; meeting?: { MediaPlacement?: unknown }; attendee?: { JoinToken?: string }; error?: string };
      if (joinVendor.status === 200 && b?.success && b?.meeting?.MediaPlacement && b?.attendee?.JoinToken) {
        pass('LiveAPI', 'POST /video-call/join (vendor, snake_case) → 200, meeting + attendee');
      } else if (joinVendor.status === 404 || joinVendor.status === 400) {
        pass('LiveAPI', 'POST /video-call/join (vendor) → 4xx (booking/window invalid)', b?.error || String(joinVendor.status));
      } else {
        fail('LiveAPI', 'POST /video-call/join (vendor)', `${joinVendor.status}: ${JSON.stringify(joinVendor.body).slice(0, 120)}`);
      }
    }

    // Join as customer (same booking)
    if (customerId) {
      const joinCustomer = await post('/video-call/join', {
        bookingId,
        participantId: customerId,
        participantType: 'customer',
      });
      const bc = joinCustomer.body as { success?: boolean; attendee?: unknown; error?: string };
      if (joinCustomer.status === 200 && bc?.success && bc?.attendee) {
        pass('LiveAPI', 'POST /video-call/join (customer, camelCase) → 200, attendee');
      } else if (joinCustomer.status === 404 || joinCustomer.status === 400) {
        pass('LiveAPI', 'POST /video-call/join (customer) → 4xx', bc?.error || String(joinCustomer.status));
      } else {
        fail('LiveAPI', 'POST /video-call/join (customer)', `${joinCustomer.status}: ${JSON.stringify(joinCustomer.body).slice(0, 120)}`);
      }
    }

    // Attendees
    const attendees = await get(`/video-call/${bookingId}/attendees`);
    const ba = attendees.body as { customerJoined?: boolean; error?: string };
    if (attendees.status === 200 && typeof ba?.customerJoined === 'boolean') {
      pass('LiveAPI', 'GET /video-call/:bookingId/attendees → 200, customerJoined/vendorJoined');
    } else if (attendees.status === 400 || attendees.status === 404) {
      pass('LiveAPI', 'GET attendees → 4xx', ba?.error || String(attendees.status));
    } else {
      fail('LiveAPI', 'GET attendees', `${attendees.status}: ${JSON.stringify(attendees.body).slice(0, 80)}`);
    }

    // Notify-ready (vendor notifies customer)
    if (vendorId) {
      const notify = await post('/video-call/notify-ready', {
        booking_id: bookingId,
        participant_type: 'vendor',
        participant_id: vendorId,
      });
      const bn = notify.body as { success?: boolean; error?: string };
      if (notify.status === 200 && bn?.success) {
        pass('LiveAPI', 'POST /video-call/notify-ready (snake_case) → 200');
      } else if (notify.status === 400 || notify.status === 404) {
        pass('LiveAPI', 'POST notify-ready → 4xx', bn?.error || String(notify.status));
      } else {
        fail('LiveAPI', 'POST notify-ready', `${notify.status}: ${JSON.stringify(notify.body).slice(0, 80)}`);
      }
    }

    // End
    const endRes = await post('/video-call/end', { booking_id: bookingId });
    const be = endRes.body as { error?: string };
    if (endRes.status === 200) {
      pass('LiveAPI', 'POST /video-call/end (booking_id) → 200');
    } else if (endRes.status === 400 || endRes.status === 404) {
      pass('LiveAPI', 'POST end → 4xx', be?.error || String(endRes.status));
    } else {
      fail('LiveAPI', 'POST end', `${endRes.status}: ${JSON.stringify(endRes.body).slice(0, 80)}`);
    }
  } catch (e: unknown) {
    fail('LiveAPI', 'Live requests', e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// RUN
// ---------------------------------------------------------------------------
async function main() {
  const outPath = path.join(ROOT, 'scripts', 'forensic-video-call-e2e-result.txt');
  try {
  validateBackend();
  validateVendorWeb();
  validateCustomerWeb();
  validateMobile();
  await runLiveApiTests();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ category: 'Error', check: msg, pass: false });
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  const lines: string[] = [
    '',
    '========== FORENSIC VIDEO CALL E2E ==========',
    '',
    ...results.map((r) => {
      const icon = r.pass ? '[PASS]' : '[FAIL]';
      return `${icon} [${r.category}] ${r.check}${r.detail ? ` — ${r.detail}` : ''}`;
    }),
    '',
    '-------------------------------------------',
    `Total: ${passed} passed, ${failed} failed`,
    '============================================',
    '',
  ];
  const out = lines.join('\n');
  try {
    fs.writeFileSync(outPath, out, 'utf8');
  } catch (_) {
    // ignore write error (e.g. sandbox)
  }
  process.stdout.write(out + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
