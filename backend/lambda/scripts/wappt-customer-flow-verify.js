#!/usr/bin/env node
/**
 * Warmpawz Appointments — customer API flow verification (dev/prod).
 *
 * Validates catalogue-published vendors, discovery DTO shape (no list pricing),
 * fee endpoint, and slot availability for the booking flow.
 *
 * Usage:
 *   node scripts/wappt-customer-flow-verify.js
 *   node scripts/wappt-customer-flow-verify.js --base https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
 *   node scripts/wappt-customer-flow-verify.js --vendor-id <uuid> --date 2026-07-30
 *   node scripts/wappt-customer-flow-verify.js --json-out scripts/_wappt-flow-verify.json
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_BASE = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

const BASE = (argValue('--base', process.env.WAPPT_VERIFY_API_BASE || DEFAULT_BASE) || DEFAULT_BASE).replace(
  /\/$/,
  '',
);
const FORCED_VENDOR_ID = argValue('--vendor-id', process.env.WAPPT_VERIFY_VENDOR_ID || '');
const SLOT_DATE =
  argValue('--date', process.env.WAPPT_VERIFY_SLOT_DATE || '') ||
  (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  })();
const JSON_OUT = argValue('--json-out', '');

const FLOWS = [
  { key: 'vet_clinic', category: 'vet', serviceStyle: 'at_center', roleId: 'veterinarian' },
  { key: 'vet_home', category: 'vet', serviceStyle: 'at_home', roleId: 'veterinarian' },
  { key: 'vet_tele', category: 'vet', serviceStyle: 'tele', roleId: 'veterinarian' },
  { key: 'grooming_center', category: 'grooming', serviceStyle: 'at_center', roleId: 'groomer' },
  { key: 'grooming_home', category: 'grooming', serviceStyle: 'at_home', roleId: 'groomer' },
];

/** @type {{ name: string; ok: boolean; detail?: string; data?: unknown }[]} */
const results = [];

function record(name, ok, detail, data) {
  results.push({ name, ok, detail, data });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchJson(urlPath, opts = {}) {
  const url = `${BASE}${urlPath}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { Accept: 'application/json', ...(opts.headers || {}) },
    body: opts.body,
  });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, body, url };
}

function extractVendors(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.vendors)) return payload.vendors;
  if (Array.isArray(payload.providers)) return payload.providers;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function vendorIdFromRow(row) {
  if (!row || typeof row !== 'object') return '';
  return String(
    row.vendorId || row.vendor_id || row.id || row.providerId || row.provider_id || '',
  ).trim();
}

function vendorNameFromRow(row) {
  if (!row || typeof row !== 'object') return '';
  return String(
    row.businessName || row.business_name || row.name || row.vendorName || row.vendor_name || '',
  ).trim();
}

function assertNoListPricing(row, label) {
  const issues = [];
  if (row.priceMin != null && Number(row.priceMin) > 0) {
    issues.push(`priceMin=${row.priceMin}`);
  }
  if (row.price_min != null && Number(row.price_min) > 0) {
    issues.push(`price_min=${row.price_min}`);
  }
  if (row.startingPrice != null && Number(row.startingPrice) > 0) {
    issues.push(`startingPrice=${row.startingPrice}`);
  }
  if (issues.length) {
    record(`${label}: no list pricing`, false, issues.join(', '));
    return false;
  }
  record(`${label}: no list pricing`, true, 'ok');
  return true;
}

async function verifyDiscoverServices(flow) {
  const qs = new URLSearchParams({
    category: flow.category,
    serviceStyle: flow.serviceStyle,
    roleId: flow.roleId,
    limit: '20',
    lat: '12.9716',
    lng: '77.5946',
  });
  const { status, body, url } = await fetchJson(`/customer/discover-services?${qs}`);
  const vendors = extractVendors(body);
  const okStatus = status === 200 && body?.success !== false;
  record(
    `discover-services ${flow.key}`,
    okStatus,
    `HTTP ${status}, vendors=${vendors.length} — ${url}`,
    { count: vendors.length, total: body?.total },
  );
  if (!okStatus) return null;

  let wapptCount = 0;
  for (const v of vendors) {
    if (v.warmpawzAppointments === true) wapptCount += 1;
    assertNoListPricing(v, `discover-services/${flow.key}/${vendorNameFromRow(v) || vendorIdFromRow(v)}`);
  }
  record(
    `discover-services ${flow.key}: warmpawzAppointments flag`,
    wapptCount === vendors.length,
    `${wapptCount}/${vendors.length} rows flagged`,
  );
  return vendors[0] || null;
}

async function verifyWapptByStyleAlias(flow) {
  const qs = new URLSearchParams({
    style: flow.serviceStyle,
    category: flow.category,
    limit: '10',
    lat: '12.9716',
    lng: '77.5946',
  });
  const { status, body } = await fetchJson(`/customer/warmpawz-appointments/discovery/by-style?${qs}`);
  const vendors = extractVendors(body);
  record(
    `wappt by-style alias ${flow.key}`,
    status === 200,
    `HTTP ${status}, vendors=${vendors.length}`,
  );
  return vendors[0] || null;
}

async function verifyDiscoveryCount(flow) {
  const qs = new URLSearchParams({
    category: flow.category,
    serviceStyle: flow.serviceStyle,
    lat: '12.9716',
    lng: '77.5946',
  });
  const { status, body } = await fetchJson(`/customer/discovery/count?${qs}`);
  const count = typeof body?.count === 'number' ? body.count : null;
  record(
    `discovery/count ${flow.key}`,
    status === 200 && count != null,
    `HTTP ${status}, count=${count}`,
  );
  return count;
}

async function verifyVendorFee(vendorId, label) {
  const { status, body } = await fetchJson(
    `/customer/warmpawz-appointments/vendors/${encodeURIComponent(vendorId)}/fee`,
  );
  const fee = body?.appointmentFee;
  const ok = status === 200 && body?.success === true && fee != null && Number(fee) >= 0;
  record(
    `vendor fee ${label}`,
    ok,
    ok ? `fee=₹${fee}` : `HTTP ${status} ${body?.error || ''}`,
    { vendorId, appointmentFee: fee },
  );
  return ok ? Number(fee) : null;
}

async function verifyVendorProfile(vendorId, label) {
  const { status, body } = await fetchJson(`/customer/vendor/${encodeURIComponent(vendorId)}`);
  const vendor = body?.vendor || body;
  const name = vendorNameFromRow(vendor);
  record(
    `vendor profile ${label}`,
    status === 200 && !!name,
    name ? name : `HTTP ${status}`,
    { vendorId, name },
  );
  return vendor;
}

async function verifyAvailableSlots(vendorId, serviceStyle, label) {
  const qs = new URLSearchParams({
    date: SLOT_DATE,
    serviceStyle,
    totalDuration: '30',
    serviceIds: 'warmpawz_appointments',
  });
  const { status, body } = await fetchJson(
    `/customer/vendor/${encodeURIComponent(vendorId)}/available-slots?${qs}`,
  );
  const slots = Array.isArray(body?.slots) ? body.slots : [];
  const available = slots.filter((s) => s.available !== false).length;
  record(
    `available-slots ${label}`,
    status === 200 && body?.success !== false,
    `HTTP ${status}, date=${SLOT_DATE}, total=${slots.length}, available=${available}`,
    {
      vendorOnline: body?.vendorOnline,
      isOnline: body?.isOnline,
      message: body?.message,
    },
  );
  return { slots, available };
}

async function main() {
  console.log(`\nWarmpawz Appointments flow verify — ${BASE}`);
  console.log(`Slot probe date: ${SLOT_DATE}\n`);

  /** @type {string} */
  let primaryVendorId = FORCED_VENDOR_ID;
  let primaryVendorName = '';

  for (const flow of FLOWS) {
    const row = await verifyDiscoverServices(flow);
    await verifyWapptByStyleAlias(flow);
    await verifyDiscoveryCount(flow);
    if (!primaryVendorId && flow.key === 'vet_clinic' && row) {
      primaryVendorId = vendorIdFromRow(row);
      primaryVendorName = vendorNameFromRow(row);
    }
  }

  if (!primaryVendorId) {
    record('primary catalogue vendor', false, 'No published vendor found in vet_clinic discover-services');
  } else {
    record('primary catalogue vendor', true, `${primaryVendorName || primaryVendorId}`);
    await verifyVendorFee(primaryVendorId, primaryVendorName || 'catalogue');
    await verifyVendorProfile(primaryVendorId, primaryVendorName || 'catalogue');
    await verifyAvailableSlots(primaryVendorId, 'at_center', `${primaryVendorName || 'catalogue'} clinic`);
    await verifyAvailableSlots(primaryVendorId, 'at_home', `${primaryVendorName || 'catalogue'} home`);
  }

  const failed = results.filter((r) => !r.ok).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    apiBase: BASE,
    slotDate: SLOT_DATE,
    primaryVendorId: primaryVendorId || null,
    primaryVendorName: primaryVendorName || null,
    passed: results.length - failed,
    failed,
    total: results.length,
    results,
  };

  console.log(`\n--- Summary: ${summary.passed}/${summary.total} passed, ${failed} failed ---\n`);

  if (JSON_OUT) {
    const outPath = path.isAbsolute(JSON_OUT) ? JSON_OUT : path.join(process.cwd(), JSON_OUT);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`Wrote ${outPath}`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
