#!/usr/bin/env node
/**
 * Dev verification for H-3: reschedule updates same booking row (booking-service).
 *
 * Usage:
 *   node scripts/verify-dev-reschedule-h3.mjs
 *   TEST_PHONE=9876543210 BOOKING_ID=<uuid> node scripts/verify-dev-reschedule-h3.mjs
 *
 * Env:
 *   API_BASE_URL  (default dev API Gateway)
 *   TEST_PHONE    (default 9876543210)
 *   BOOKING_ID    (optional — skip list and use this booking)
 *   UAT_OTP       (default 123456)
 */

const API_BASE = (process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com').replace(/\/$/, '');
const TEST_PHONE = process.env.TEST_PHONE || '9876543210';
const UAT_OTP = process.env.UAT_OTP || '123456';
const BOOKING_ID_ENV = process.env.BOOKING_ID || '';

const RESCHEDULABLE = new Set(['pending', 'pending_payment', 'confirmed']);

function log(ok, msg) {
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

function unwrap(payload) {
  let p = payload;
  for (let i = 0; i < 5 && p; i++) {
    if (p.booking && typeof p.booking === 'object') return p.booking;
    if (p.data?.booking && typeof p.data.booking === 'object') return p.data.booking;
    if (p.data?.id || p.data?.bookingId) return p.data;
    if (p.id || p.bookingId) return p;
    if (p.data && typeof p.data === 'object' && !Array.isArray(p.data)) {
      p = p.data;
      continue;
    }
    break;
  }
  return p;
}

function normalizeDate(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

function normalizeTime(v) {
  if (!v) return null;
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function decodeJwtSub(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const payload = JSON.parse(json);
  return payload.sub || payload.customerId || payload.userId || null;
}

function pickBooking(list) {
  const items = Array.isArray(list) ? list : [];
  return items.find((b) => {
    const status = (b.status || '').toLowerCase();
    if (!RESCHEDULABLE.has(status)) return false;
    const d = b.bookingDate || b.booking_date;
    if (!d) return true;
    return new Date(d) >= new Date(new Date().toISOString().slice(0, 10));
  });
}

function bookingIdOf(b) {
  return b?.id || b?.bookingId || b?.booking_id;
}

function addDays(isoDate, days) {
  const base = normalizeDate(isoDate) || new Date().toISOString().slice(0, 10);
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextSlotTime(current) {
  const t = (current || '10:00').slice(0, 5);
  const [h, m] = t.split(':').map(Number);
  let nh = h + 2;
  if (nh >= 20) nh = 9;
  return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function login() {
  await api('POST', '/auth/send-otp', { phone: TEST_PHONE, role: 'customer' });
  const verify = await api('POST', '/auth/verify-otp', { phone: TEST_PHONE, otp: UAT_OTP, role: 'customer' });
  const body = unwrap(verify.data);
  const token =
    body?.token?.access_token ||
    body?.token?.accessToken ||
    body?.access_token ||
    body?.accessToken ||
    verify.data?.access_token;
  if (!token) {
    throw new Error(`Login failed (${verify.status}): ${JSON.stringify(verify.data).slice(0, 400)}`);
  }
  const customerId = decodeJwtSub(token);
  return { token, customerId };
}

async function listBookings(token, customerId) {
  // Java booking-service (authenticated)
  if (customerId) {
    const r = await api('GET', `/customer/${customerId}/bookings?size=50&status=confirmed`, null, token);
    const body = unwrap(r.data);
    const content = body?.content || body?.bookings || body;
    if (Array.isArray(content) && content.length) return { source: 'java', bookings: content, status: r.status };
  }
  // Lambda convenience (phone query)
  const r2 = await api('GET', `/customer/bookings?phone=${encodeURIComponent(TEST_PHONE)}`, null, token);
  const body2 = unwrap(r2.data);
  const bookings = body2?.bookings || body2?.content || (Array.isArray(body2) ? body2 : []);
  return { source: 'lambda', bookings: bookings || [], status: r2.status };
}

async function getBooking(token, bookingId) {
  const r = await api('GET', `/customer/bookings/${bookingId}`, null, token);
  if (r.status === 200) {
    const body = r.data;
    return unwrap(body?.booking ? body : body);
  }
  const r2 = await api('GET', `/bookings/${bookingId}`, null, token);
  return unwrap(r2.data);
}

async function main() {
  console.log('H-3 dev reschedule verification');
  console.log(`  API:   ${API_BASE}`);
  console.log(`  Phone: ${TEST_PHONE}`);
  console.log('');

  const { token, customerId } = await login();
  log(true, `Logged in (customerId=${customerId || 'from token'})`);

  let bookingId = BOOKING_ID_ENV;
  let before;

  if (!bookingId) {
    const listed = await listBookings(token, customerId);
    console.log(`  Bookings list: ${listed.source} HTTP ${listed.status}, count=${listed.bookings.length}`);
    const pick = pickBooking(listed.bookings);
    if (!pick) {
      console.log('\nNo reschedulable booking found. Create one in dev UI or run:');
      console.log(`  BOOKING_ID=<uuid> node scripts/verify-dev-reschedule-h3.mjs`);
      process.exit(2);
    }
    bookingId = bookingIdOf(pick);
    before = pick;
    log(true, `Using booking ${bookingId} (status=${pick.status}, date=${pick.bookingDate || pick.booking_date})`);
  } else {
    before = await getBooking(token, bookingId);
    log(true, `Loaded booking ${bookingId}`);
  }

  const oldDate = normalizeDate(before.bookingDate || before.booking_date);
  const oldTime = normalizeTime(before.bookingTime || before.booking_time || '10:00');
  const oldPaymentId = before.paymentId || before.payment_id || null;
  const oldStatus = (before.status || '').toLowerCase();

  const newDate = addDays(oldDate || new Date().toISOString().slice(0, 10), 3);
  const newTime = nextSlotTime(oldTime);

  console.log(`  Reschedule: ${oldDate} ${oldTime} → ${newDate} ${newTime}`);

  const res = await api(
    'POST',
    `/bookings/${bookingId}/reschedule`,
    { newDate, newTime, reason: 'H-3 dev verification' },
    token
  );

  if (res.status !== 200) {
    log(false, `Reschedule HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 500)}`);
    process.exit(1);
  }

  const after = unwrap(res.data);
  const afterId = bookingIdOf(after) || res.data?.data?.bookingId;
  const afterPayment = after.paymentId || after.payment_id || null;
  const afterStatus = (after.status || '').toLowerCase();
  const afterDate = normalizeDate(after.bookingDate || after.booking_date);
  const afterTime = normalizeTime(after.bookingTime || after.booking_time);

  const routeHint =
    res.data?.data?.oldDate != null ? '(Lambda handler response shape)' : '(Java booking-service shape)';

  let failed = 0;
  if (afterId !== bookingId) {
    log(false, `ID changed: ${bookingId} → ${afterId}`);
    failed++;
  } else {
    log(true, `Same booking id: ${afterId} ${routeHint}`);
  }

  if (oldPaymentId && afterPayment !== oldPaymentId) {
    log(false, `payment_id changed: ${oldPaymentId} → ${afterPayment}`);
    failed++;
  } else if (oldPaymentId) {
    log(true, `payment_id unchanged: ${oldPaymentId}`);
  } else {
    log(true, 'No payment_id on booking (skipped payment check)');
  }

  if (afterStatus === 'rescheduled') {
    log(false, `Status became "rescheduled" (expected unchanged, was "${oldStatus}")`);
    failed++;
  } else if (afterDate === newDate && afterTime === newTime) {
    log(true, `Status="${afterStatus}", new date/time applied (${afterDate} ${afterTime})`);
  } else {
    log(false, `Date/time mismatch: expected ${newDate} ${newTime}, got ${afterDate} ${afterTime}`);
    failed++;
  }

  const again = await getBooking(token, bookingId);
  const againId = bookingIdOf(again);
  const againDate = normalizeDate(again.bookingDate || again.booking_date);
  if (againId === bookingId && againDate === newDate) {
    log(true, `GET after reschedule: same id, date=${againDate}`);
  } else {
    log(false, `GET mismatch: id=${againId}, date=${againDate}`);
    failed++;
  }

  console.log('');
  if (failed) {
    console.log('FAILED — H-3 checks did not pass.');
    process.exit(1);
  }
  console.log('PASSED — H-3 reschedule keeps same booking row in dev.');
  console.log('\nNote: Dev API route ANY /bookings/{proxy+} may still target Lambda.');
  console.log('Java ECS (task :17) is live; wire VPC link routes via scripts/apply-booking-stack-dev.ps1 to hit Java.');
  console.log('\nManual UI: https://d2aoyjj8ine0wk.cloudfront.net → My Bookings → Reschedule');
  console.log('       or https://customer.dev.warmpawz.com');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
