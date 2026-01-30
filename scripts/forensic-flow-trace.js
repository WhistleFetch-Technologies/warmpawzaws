#!/usr/bin/env node
/**
 * Forensic flow trace: verify wire parameters at each step against backend contracts.
 * Flow: Identify (meta) -> Discover (API) -> Available slots -> Create booking -> Status (confirm/start/complete).
 * Optional: Payment create (payload only). No early exit: run all steps, collect all mismatches, report at end.
 *
 * Backend contracts (from code review):
 * - CreateBookingRequestSchema: customerId, vendorId, serviceId (UUID), bookingDate (YYYY-MM-DD), bookingTime (HH:MM), serviceType (enum)
 * - UpdateBookingStatusRequestSchema: status (enum), reason optional, notes optional
 * - GET /bookings/available-slots: vendorId, date required; serviceId, serviceStyle, staffId optional
 * - GET /customer/discover-services: lat, lng, role_id or category
 * - GET /customer/vendor/:vendorId/services: vendorId path
 */

const API_BASE_URL = process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '9876543210';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const SERVICE_TYPE_ENUM = ['at_vendor', 'at_home', 'online', 'at_center', 'tele', 'hybrid', 'product'];
const STATUS_ENUM = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'];

const mismatches = [];
const stepResults = [];

function recordMismatch(step, message, expected, actual) {
  mismatches.push({ step, message, expected, actual });
}

function validateUUID(value, name) {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value);
}

function validateDate(value) {
  return typeof value === 'string' && DATE_REGEX.test(value);
}

function validateTime(value) {
  return typeof value === 'string' && TIME_REGEX.test(value);
}

async function apiFetch(url, method, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await globalThis.fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.error?.message || res.statusText);
  return data;
}

async function main() {
  console.log('=== FORENSIC FLOW TRACE (wire params vs backend contracts) ===\n');
  const base = API_BASE_URL;

  // --- Step 0: by-phone (required for customerId) ---
  let customerId;
  try {
    const byPhone = await apiFetch(`${base}/customer/by-phone?phone=${encodeURIComponent(TEST_PHONE)}`, 'GET');
    customerId = byPhone?.customer?.id ?? byPhone?.id;
    if (!customerId) recordMismatch('by-phone', 'Missing customerId in response', 'customer.id or id', byPhone);
    else if (!validateUUID(customerId, 'customerId')) recordMismatch('by-phone', 'customerId not UUID', 'UUID', customerId);
    stepResults.push({ step: 'by-phone', ok: !!customerId, customerId });
  } catch (e) {
    recordMismatch('by-phone', 'Request failed', '200 + customerId', e.message);
    stepResults.push({ step: 'by-phone', ok: false, error: e.message });
  }

  // --- Step 1: discover-services ---
  const roleId = 'veterinarian';
  const discoverQuery = `lat=12.9716&lng=77.5946&role_id=${encodeURIComponent(roleId)}`;
  const requiredDiscoverParams = ['lat', 'lng', 'role_id'];
  const discoverUrl = `${base}/customer/discover-services?${discoverQuery}`;
  let vendorId;
  try {
    const discoverRes = await apiFetch(discoverUrl, 'GET');
    const list = discoverRes.providers ?? discoverRes.vendors ?? [];
    if (!Array.isArray(list) || list.length === 0) recordMismatch('discover-services', 'Empty providers/vendors', 'non-empty array', list);
    const first = list[0];
    vendorId = first?.id ?? first?.vendor_id ?? first?.vendorId;
    if (!vendorId) recordMismatch('discover-services', 'First provider missing id/vendor_id/vendorId', 'UUID', Object.keys(first || {}));
    else if (!validateUUID(vendorId, 'vendorId')) recordMismatch('discover-services', 'vendorId not UUID', 'UUID', vendorId);
    stepResults.push({ step: 'discover-services', ok: !!vendorId, vendorId, queryParams: requiredDiscoverParams });
  } catch (e) {
    recordMismatch('discover-services', 'Request failed', '200 + providers', e.message);
    stepResults.push({ step: 'discover-services', ok: false, error: e.message });
  }

  if (!vendorId) {
    console.log('Cannot continue without vendorId. Remaining steps will validate params only (no live call).');
  }

  // --- Step 2: vendor/:vendorId/services ---
  let serviceId;
  if (vendorId) {
    try {
      const servicesRes = await apiFetch(`${base}/customer/vendor/${vendorId}/services`, 'GET');
      const services = servicesRes?.services ?? servicesRes?.data ?? [];
      if (!Array.isArray(services) || services.length === 0) recordMismatch('vendor/services', 'Empty services', 'non-empty array', services);
      const s = services[0];
      serviceId = s?.id ?? s?.serviceId ?? s?.service_id;
      if (!serviceId) recordMismatch('vendor/services', 'First service missing id/serviceId/service_id', 'UUID', Object.keys(s || {}));
      else if (!validateUUID(serviceId, 'serviceId')) recordMismatch('vendor/services', 'serviceId not UUID (must be base service UUID for create)', 'UUID', serviceId);
      stepResults.push({ step: 'vendor/services', ok: !!serviceId, serviceId });
    } catch (e) {
      recordMismatch('vendor/services', 'Request failed', '200 + services', e.message);
      stepResults.push({ step: 'vendor/services', ok: false, error: e.message });
    }
  } else {
    stepResults.push({ step: 'vendor/services', ok: false, skipped: true });
  }

  // --- Step 3: available-slots ---
  const dateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  })();
  const requiredSlotsParams = ['vendorId', 'date'];
  const slotsQuery = new URLSearchParams({ date: dateStr });
  if (vendorId) slotsQuery.set('vendorId', vendorId);
  if (serviceId) slotsQuery.set('serviceId', serviceId);
  try {
    if (!vendorId) {
      recordMismatch('available-slots', 'vendorId required for request', 'non-empty vendorId', vendorId);
      stepResults.push({ step: 'available-slots', ok: false, skipped: true, requiredParams: requiredSlotsParams });
    } else {
    const slotsRes = await apiFetch(`${base}/bookings/available-slots?${slotsQuery}`, 'GET');
    if (!slotsRes.slots) recordMismatch('available-slots', 'Response missing slots', 'slots array', Object.keys(slotsRes));
    const slots = Array.isArray(slotsRes.slots) ? slotsRes.slots : [];
    stepResults.push({ step: 'available-slots', ok: true, slotsCount: slots.length, requiredParams: requiredSlotsParams });
    }
  } catch (e) {
    recordMismatch('available-slots', 'Request failed', '200 + slots', e.message);
    stepResults.push({ step: 'available-slots', ok: false, error: e.message });
  }

  // --- Step 4: POST /bookings/create (wire vs CreateBookingRequestSchema) ---
  const bookingTime = '10:00';
  const createBody = {
    customerId: customerId || '00000000-0000-0000-0000-000000000000',
    vendorId: vendorId || '00000000-0000-0000-0000-000000000000',
    serviceId: serviceId || '00000000-0000-0000-0000-000000000000',
    bookingDate: dateStr,
    bookingTime,
    serviceType: 'at_center',
    amount: 500,
    customerPhone: TEST_PHONE,
  };
  const createRequired = ['customerId', 'vendorId', 'serviceId', 'bookingDate', 'bookingTime', 'serviceType'];
  for (const k of createRequired) {
    if (createBody[k] === undefined || createBody[k] === null) recordMismatch('bookings/create', `Missing required field: ${k}`, 'present', createBody[k]);
  }
  if (!SERVICE_TYPE_ENUM.includes(createBody.serviceType)) recordMismatch('bookings/create', 'serviceType not in enum', SERVICE_TYPE_ENUM, createBody.serviceType);
  if (!validateDate(createBody.bookingDate)) recordMismatch('bookings/create', 'bookingDate format', 'YYYY-MM-DD', createBody.bookingDate);
  if (!validateTime(createBody.bookingTime)) recordMismatch('bookings/create', 'bookingTime format', 'HH:MM', createBody.bookingTime);
  if (createBody.amount !== undefined && (typeof createBody.amount !== 'number' || createBody.amount <= 0)) recordMismatch('bookings/create', 'amount must be positive number if present', 'number > 0', createBody.amount);

  let bookingId;
  if (customerId && vendorId && serviceId) {
    try {
      const createRes = await apiFetch(`${base}/bookings/create`, 'POST', createBody);
      bookingId = createRes?.data?.bookingId ?? createRes?.bookingId ?? createRes?.data?.booking_id ?? createRes?.booking_id ?? createRes?.id;
      if (!bookingId) recordMismatch('bookings/create', 'Response missing bookingId', 'data.bookingId or bookingId', createRes);
      else if (!validateUUID(bookingId, 'bookingId')) recordMismatch('bookings/create', 'bookingId not UUID', 'UUID', bookingId);
      stepResults.push({ step: 'bookings/create', ok: !!bookingId, bookingId, bodyKeys: Object.keys(createBody) });
    } catch (e) {
      recordMismatch('bookings/create', 'Request failed', '201/200 + bookingId', e.message);
      stepResults.push({ step: 'bookings/create', ok: false, error: e.message });
    }
  } else {
    stepResults.push({ step: 'bookings/create', ok: false, skipped: true, bodyValidated: true });
  }

  // --- Step 5: PUT /bookings/:bookingId/status (confirm -> in_progress -> completed) ---
  const statusTransitions = [
    { status: 'confirmed', body: { status: 'confirmed' } },
    { status: 'in_progress', body: { status: 'in_progress', reason: 'Forensic trace' } },
    { status: 'completed', body: { status: 'completed', notes: 'Forensic trace' } },
  ];
  for (const { status, body } of statusTransitions) {
    if (!STATUS_ENUM.includes(body.status)) recordMismatch(`bookings/status (${status})`, 'status not in enum', STATUS_ENUM, body.status);
    if (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 500)) recordMismatch(`bookings/status (${status})`, 'reason max 500', 'string length <= 500', body.reason);
    if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 1000)) recordMismatch(`bookings/status (${status})`, 'notes max 1000', 'string length <= 1000', body.notes);
  }

  if (bookingId) {
    for (const { status, body } of statusTransitions) {
      try {
        await apiFetch(`${base}/bookings/${bookingId}/status`, 'PUT', body);
        stepResults.push({ step: `bookings/status (${status})`, ok: true });
      } catch (e) {
        recordMismatch(`bookings/status (${status})`, 'Request failed', '200', e.message);
        stepResults.push({ step: `bookings/status (${status})`, ok: false, error: e.message });
      }
    }
  } else {
    stepResults.push({ step: 'bookings/status (all)', ok: false, skipped: true });
  }

  // --- Payment integration: payload only (no live payment) ---
  const paymentPayload = {
    bookingId: bookingId || '00000000-0000-0000-0000-000000000000',
    amount: 500,
    paymentMethod: 'razorpay',
  };
  if (paymentPayload.bookingId && !validateUUID(paymentPayload.bookingId, 'bookingId')) recordMismatch('payments/create', 'bookingId must be UUID', 'UUID', paymentPayload.bookingId);
  if (typeof paymentPayload.amount !== 'number' || paymentPayload.amount <= 0) recordMismatch('payments/create', 'amount must be positive', 'number > 0', paymentPayload.amount);
  stepResults.push({ step: 'payments/create (payload check)', ok: true, payloadKeys: Object.keys(paymentPayload) });

  // --- Report: no early exit; all steps run ---
  console.log('\n--- Step results ---');
  stepResults.forEach((r) => console.log(JSON.stringify(r)));
  console.log('\n--- Mismatches (wire vs backend contract) ---');
  if (mismatches.length === 0) {
    console.log('None.');
  } else {
    mismatches.forEach((m) => console.log(JSON.stringify(m, null, 2)));
  }
  console.log('\n--- Summary ---');
  console.log('Steps run:', stepResults.length);
  console.log('Mismatches:', mismatches.length);
  process.exit(mismatches.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
