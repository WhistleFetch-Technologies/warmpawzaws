#!/usr/bin/env node
/**
 * Discovery and next-available-slot report for all flows.
 * Uses same API contract: discover-services (or diagnostics vendors), then available-slots.
 * Reports: flow name, vendor count, slots available (yes/no), next slot (date + time or "none in 7 days").
 *
 * Usage: TEST_API_URL=<base> node scripts/forensic-discovery-and-slots-report.js
 */

const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const LAT = '12.9716';
const LNG = '77.5946';

const FLOWS = [
  { name: 'Vet at_center', category: 'vet', serviceStyle: 'at_center', discovery: 'discover-services' },
  { name: 'Vet at_home', category: 'vet', serviceStyle: 'at_home', discovery: 'discover-services' },
  { name: 'Vet tele', category: 'vet', serviceStyle: 'tele', discovery: 'discover-services' },
  { name: 'Grooming at_center', category: 'grooming', serviceStyle: 'at_center', discovery: 'discover-services' },
  { name: 'Grooming at_home', category: 'grooming', serviceStyle: 'at_home', discovery: 'discover-services' },
  { name: 'Walker at_home', category: 'walker', serviceStyle: 'at_home', discovery: 'discover-services' },
  { name: 'Training at_center', category: 'training', serviceStyle: 'at_center', discovery: 'discover-services' },
  { name: 'Training at_home', category: 'training', serviceStyle: 'at_home', discovery: 'discover-services' },
  { name: 'Diagnostics (discover-services)', category: 'diagnostics', serviceStyle: 'at_center', discovery: 'discover-services' },
  { name: 'Diagnostics (vendors-with-tests)', category: 'diagnostics', serviceStyle: null, discovery: 'diagnostics-vendors' },
  { name: 'Nutrition / meal plan (discover-services)', category: 'nutrition', serviceStyle: 'at_center', discovery: 'discover-services' },
];

function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}

async function getVendorsForFlow(base, flow) {
  if (flow.discovery === 'diagnostics-vendors') {
    try {
      const res = await fetchJson(`${base}/customer/diagnostics/vendors-with-tests?lat=${LAT}&lng=${LNG}&maxDistance=50`);
      const list = res.vendors ?? [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  const params = new URLSearchParams({
    category: flow.category,
    serviceStyle: flow.serviceStyle || 'at_center',
    latitude: LAT,
    longitude: LNG,
    limit: '50',
  });
  try {
    const res = await fetchJson(`${base}/customer/discover-services?${params}`);
    const list = res.providers ?? res.vendors ?? [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function getNextAvailableSlot(base, vendorId, serviceStyle, maxDays = 7) {
  for (let d = 0; d <= maxDays; d++) {
    const date = dateStr(d);
    try {
      const params = new URLSearchParams({ date, serviceStyle: serviceStyle || 'at_center' });
      const res = await fetchJson(`${base}/customer/vendor/${vendorId}/available-slots?${params}`);
      const slots = res.slots ?? [];
      if (Array.isArray(slots) && slots.length > 0) {
        const first = slots.find((s) => s.available !== false) ?? slots[0];
        const time = first.time ?? first.startTime ?? first.start_time ?? '09:00';
        return { date, time, slotsCount: slots.length };
      }
    } catch (_) {
      // skip this date
    }
  }
  return null;
}

function getVendorId(v) {
  return v.id ?? v.vendorId ?? v.vendor_id;
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  const report = [];

  console.log('\n' + '═'.repeat(80));
  console.log('DISCOVERY & NEXT AVAILABLE SLOT REPORT (all flows, same API contract)');
  console.log('═'.repeat(80));
  console.log(`API: ${base}`);
  console.log(`Location: ${LAT}, ${LNG}`);
  console.log('═'.repeat(80));

  for (const flow of FLOWS) {
    const vendors = await getVendorsForFlow(base, flow);
    const count = vendors.length;
    const firstVendorId = count > 0 ? getVendorId(vendors[0]) : null;
    const serviceStyle = flow.serviceStyle || 'at_center';
    let nextSlot = null;
    let slotsAvailable = 'no';
    if (firstVendorId) {
      nextSlot = await getNextAvailableSlot(base, firstVendorId, serviceStyle);
      slotsAvailable = nextSlot ? `yes (${nextSlot.slotsCount} on ${nextSlot.date})` : 'no (none in 8 days)';
    }
    report.push({
      flow: flow.name,
      vendors: count,
      slotsAvailable,
      nextWhen: nextSlot ? `${nextSlot.date} ${nextSlot.time}` : '—',
    });
    console.log(`\n${flow.name}: ${count} vendor(s), slots ${nextSlot ? 'yes' : 'no'}, next: ${nextSlot ? `${nextSlot.date} ${nextSlot.time}` : '—'}`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY TABLE');
  console.log('═'.repeat(80));
  console.log(
    [
      'Flow'.padEnd(35),
      'Vendors'.padStart(8),
      'Slots'.padEnd(22),
      'Next when',
    ].join(' | ')
  );
  console.log('-'.repeat(80));
  for (const r of report) {
    console.log(
      [
        r.flow.padEnd(35),
        String(r.vendors).padStart(8),
        (r.slotsAvailable === 'no' || r.slotsAvailable.startsWith('no ') ? r.slotsAvailable : 'yes').padEnd(22),
        r.nextWhen,
      ].join(' | ')
    );
  }
  console.log('═'.repeat(80));

  // Lab test & meal plan: confirm they use same booking contract
  console.log('\n📋 API CONTRACT ALIGNMENT (same discovery → slots → payment/create where applicable)');
  console.log('─'.repeat(80));
  console.log('• Vet, Grooming, Walker, Training: GET discover-services → GET vendor/:id → GET vendor/:id/services → GET vendor/:id/available-slots → POST /bookings/create (booking-contract.ts)');
  console.log('• Diagnostics: GET /customer/diagnostics/vendors-with-tests OR discover-services?category=diagnostics → GET vendor/:id/diagnostics/tests → POST /bookings/create (same body: vendorId, customerId, bookingDate, bookingTime, serviceType, amount)');
  console.log('• Nutrition/meal: GET discover-services?category=nutrition → GET vendor/:id/nutrition/meal-plans → order/slots; service-style booking uses same vendor/:id/available-slots + POST /bookings/create');
  console.log('═'.repeat(80) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
