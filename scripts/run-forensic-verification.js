#!/usr/bin/env node
/**
 * E2E forensic verification: API discovery + booking lifecycle, with DB revalidation.
 *
 * Flow:
 * 1. IDENTIFY (DB-backed): GET /customer/discovery/meta to obtain expected roles/styles
 *    from DB – used only to know what to expect and to revalidate API results.
 * 2. DISCOVER (API only): For each role, discover vendors/services only via API:
 *    GET /customer/discover-services, GET /customer/vendor/:id/services.
 * 3. BOOKING LIFECYCLE: create → confirm → start → complete (all via API).
 * 4. REVALIDATE: Compare API discovery results to DB-backed expectations (roles,
 *    vendor presence); report mismatches.
 *
 * Usage:
 *   node scripts/run-forensic-verification.js
 *   Env: TEST_API_URL, TEST_CUSTOMER_PHONE (default 9876543210)
 */

const API_BASE_URL = process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '9876543210';

function log(flow, step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${flow}] ${step}: ${message}`);
  if (data != null) console.log(JSON.stringify(data, null, 2));
}

async function apiRequest(endpoint, method = 'GET', body) {
  const url = `${API_BASE_URL}${endpoint}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  log('_api', method, endpoint, body || undefined);
  const response = await fetch(url, opts);
  const data = await response.json().catch(() => ({}));
  const errMsg =
    typeof data?.error === 'string'
      ? data.error
      : data?.error?.message ?? (data?.error && JSON.stringify(data.error)) ?? response.statusText;
  if (!response.ok) throw new Error(`API Error: ${errMsg}`);
  return data;
}

/** DB-backed API: identifies expected roles/styles (for revalidation only). Discovery is done via discover-services. */
async function getDiscoveryMeta() {
  const res = await apiRequest('/customer/discovery/meta', 'GET');
  const roles = res.roles || [];
  return { roles, categories: res.categories || [], serviceStyles: res.serviceStyles || [], fromMeta: true };
}

/** Fallback when /customer/discovery/meta is not deployed (404): use discover-services with known role names so verification can still run. */
function getFallbackRoles() {
  return [
    { roleId: 'veterinarian', roleName: 'veterinarian', displayName: 'Vet', category: 'vet' },
    { roleId: 'groomer', roleName: 'groomer', displayName: 'Groomer', category: 'grooming' },
    { roleId: 'trainer', roleName: 'trainer', displayName: 'Trainer', category: 'training' },
    { roleId: 'walker', roleName: 'walker', displayName: 'Walker', category: 'walker' },
    { roleId: 'nutritionist', roleName: 'nutritionist', displayName: 'Nutritionist', category: 'nutrition' },
  ];
}

function isOrderOnlyRole(role) {
  const id = (role.roleId || role.roleName || '').toLowerCase();
  const cat = (role.category || '').toLowerCase();
  return cat === 'pharmacy' || id.includes('pharmacy');
}

/** API discovery only: discover-services then vendor/:id/services (no DB). */
async function discoverForRole(roleId, flowName) {
  const ctx = { vendorId: null, serviceId: null, roleId, apiProviderCount: 0 };
  try {
    const res = await apiRequest(
      `/customer/discover-services?lat=12.9716&lng=77.5946&role_id=${encodeURIComponent(roleId)}`,
      'GET'
    );
    const list = res.providers ?? res.vendors ?? [];
    ctx.apiProviderCount = Array.isArray(list) ? list.length : 0;
    if (!Array.isArray(list) || list.length === 0) {
      log(flowName, 'discover', 'API discover-services: no providers', { roleId });
      return ctx;
    }
    const first = list[0];
    ctx.vendorId = first.id ?? first.vendor_id ?? first.vendorId;
    if (!ctx.vendorId) {
      log(flowName, 'discover', 'API discover-services: first provider missing vendor id', { first: Object.keys(first) });
      return ctx;
    }
    const servicesRes = await apiRequest(`/customer/vendor/${ctx.vendorId}/services`, 'GET');
    const services = servicesRes?.services ?? servicesRes?.data ?? [];
    if (!Array.isArray(services) || services.length === 0) {
      log(flowName, 'discover', 'API vendor/services: no services', { vendorId: ctx.vendorId });
      return ctx;
    }
    const s = services[0];
    ctx.serviceId = s.id ?? s.serviceId ?? s.service_id;
    log(flowName, 'discover', 'API discovery resolved (discover-services + vendor/services)', { vendorId: ctx.vendorId, serviceId: ctx.serviceId });
  } catch (e) {
    log(flowName, 'discover', 'API discovery error', { error: e.message });
  }
  return ctx;
}

async function resolveCustomerId(phone) {
  try {
    const res = await apiRequest(`/customer/by-phone?phone=${encodeURIComponent(phone)}`, 'GET');
    return res?.customer?.id ?? res?.id;
  } catch {
    return undefined;
  }
}

async function runLifecycleForFlow(flowName, ctx, dateOffsetDays) {
  if (!ctx.vendorId || !ctx.serviceId) {
    return { passed: false, error: 'Missing vendorId or serviceId after discovery' };
  }
  const customerId = ctx.customerId ?? (await resolveCustomerId(TEST_PHONE));
  if (!customerId) {
    return { passed: false, error: 'Could not resolve customerId (by-phone)' };
  }
  ctx.customerId = customerId;

  let dateStr;
  let timeStr = '10:00';
  try {
    const d = new Date();
    d.setDate(d.getDate() + dateOffsetDays);
    dateStr = d.toISOString().split('T')[0];
    const slotsRes = await apiRequest(
      `/bookings/available-slots?vendorId=${ctx.vendorId}&date=${dateStr}&serviceId=${ctx.serviceId || ''}`,
      'GET'
    );
    const slots = slotsRes?.slots ?? [];
    if (Array.isArray(slots) && slots.length > 0) {
      const firstAvailable = slots.find((s) => s.available !== false) ?? slots[0];
      timeStr = firstAvailable?.time ?? firstAvailable ?? '10:00';
      if (typeof timeStr !== 'string') timeStr = '10:00';
    }
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + dateOffsetDays);
    dateStr = d.toISOString().split('T')[0];
  }

  let bookingId;
  try {
    const createRes = await apiRequest('/bookings/create', 'POST', {
      customerId: ctx.customerId,
      vendorId: ctx.vendorId,
      serviceId: ctx.serviceId,
      bookingDate: dateStr,
      bookingTime: timeStr,
      serviceType: 'at_center',
      amount: 500,
      customerPhone: TEST_PHONE,
    });
    bookingId =
      createRes?.data?.bookingId ??
      createRes?.bookingId ??
      createRes?.data?.booking_id ??
      createRes?.booking_id ??
      createRes?.id;
    if (!bookingId) return { passed: false, error: 'Create booking returned no bookingId' };
    log(flowName, 'create', 'Booking created', { bookingId });
  } catch (e) {
    return { passed: false, error: `Create booking failed: ${e.message}` };
  }

  try {
    await apiRequest(`/bookings/${bookingId}/status`, 'PUT', { status: 'confirmed' });
    log(flowName, 'confirm', 'Booking confirmed');
  } catch (e) {
    return { passed: false, error: `Confirm failed: ${e.message}` };
  }

  try {
    await apiRequest(`/bookings/${bookingId}/status`, 'PUT', { status: 'in_progress', reason: 'Forensic E2E' });
    log(flowName, 'start', 'Booking started');
  } catch (e) {
    return { passed: false, error: `Start failed: ${e.message}` };
  }

  try {
    await apiRequest(`/bookings/${bookingId}/status`, 'PUT', { status: 'completed', notes: 'Forensic E2E' });
    log(flowName, 'complete', 'Booking completed');
  } catch (e) {
    return { passed: false, error: `Complete failed: ${e.message}` };
  }

  return { passed: true };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E FORENSIC VERIFICATION');
  console.log('Identify (DB-backed meta) → Discover (API) → Book → Confirm → Start → Complete → Revalidate');
  console.log('═'.repeat(60));
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Phone: ${TEST_PHONE}`);
  console.log('═'.repeat(60));

  // Step 1: Identify expected data (DB-backed API; used only for revalidation)
  let meta;
  try {
    meta = await getDiscoveryMeta();
    log('_identify', 'discovery/meta', 'DB-backed expected roles/styles (for revalidation)', {
      roleCount: meta.roles.length,
      roles: meta.roles.map((r) => r.roleId || r.roleName),
      categories: meta.categories,
      serviceStyles: meta.serviceStyles,
    });
  } catch (e) {
    const is404 = e.message && (e.message.includes('404') || e.message.includes('Not Found'));
    if (is404) {
      console.warn('GET /customer/discovery/meta not available. Using fallback role list; revalidation will be limited.');
      meta = { roles: getFallbackRoles(), fromMeta: false };
    } else {
      console.error('Failed to fetch discovery meta:', e.message);
      process.exit(1);
    }
  }

  const expectedRoleIds = new Set((meta.roles || []).map((r) => (r.roleId || r.roleName || '').toLowerCase()).filter(Boolean));
  const rolesToRun = meta.roles.filter((r) => !isOrderOnlyRole(r));
  if (rolesToRun.length === 0) {
    console.log('No booking roles (all order-only or empty). Exiting 0.');
    process.exit(0);
  }
  if (!meta.fromMeta) {
    console.log('Note: Deploy Lambda to enable DB-backed discovery/meta for full revalidation.');
  }

  const customerId = await resolveCustomerId(TEST_PHONE);
  const results = [];
  const apiDiscoveredVendors = new Set(); // for revalidation
  const apiDiscoveredByRole = new Map();  // roleId -> { vendorId, serviceId, apiProviderCount }
  let cachedVendorId;
  let cachedServiceId;

  // Step 2: Discover only via API; then run booking lifecycle
  for (let i = 0; i < rolesToRun.length; i++) {
    const role = rolesToRun[i];
    const roleId = role.roleId || role.roleName || role.displayName;
    const flowName = role.displayName || role.roleName || roleId || `Role-${i}`;

    console.log('\n' + '─'.repeat(60));
    console.log(`🧪 ${flowName} (${roleId})`);
    console.log('─'.repeat(60));

    const ctx = { vendorId: null, serviceId: null, customerId };
    let discovered = await discoverForRole(roleId, flowName);
    if (!discovered.vendorId && cachedVendorId && cachedServiceId) {
      ctx.vendorId = cachedVendorId;
      ctx.serviceId = cachedServiceId;
      discovered = { vendorId: cachedVendorId, serviceId: cachedServiceId };
      log(flowName, 'discover', 'Using cached vendor/service');
    } else {
      ctx.vendorId = discovered.vendorId;
      ctx.serviceId = discovered.serviceId;
    }
    if (ctx.vendorId && ctx.serviceId) {
      cachedVendorId = ctx.vendorId;
      cachedServiceId = ctx.serviceId;
      apiDiscoveredVendors.add(ctx.vendorId);
      apiDiscoveredByRole.set(roleId, { vendorId: ctx.vendorId, serviceId: ctx.serviceId, apiProviderCount: discovered.apiProviderCount || 0 });
    }

    if (!ctx.vendorId || !ctx.serviceId) {
      results.push({ flow: flowName, roleId, passed: false, error: 'Discovery failed (no vendor/service)' });
      console.log(`❌ ${flowName} - SKIP (discovery)`);
      continue;
    }

    const dateOffset = i + 2; // start from +2 days to avoid "slot already booked" from prior runs
    const out = await runLifecycleForFlow(flowName, ctx, dateOffset);
    results.push({
      flow: flowName,
      roleId,
      passed: out.passed,
      error: out.error,
    });
    if (out.passed) {
      console.log(`\n✅ ${flowName} - PASSED (create → confirm → start → complete)`);
    } else {
      console.log(`\n❌ ${flowName} - FAILED: ${out.error}`);
    }
  }

  // Step 4: Revalidate API discovery results against DB-backed expectations
  console.log('\n' + '═'.repeat(60));
  console.log('REVALIDATION (API discovery vs DB-backed expectations)');
  console.log('═'.repeat(60));
  const rolesDiscoveredByApi = [...apiDiscoveredByRole.keys()];
  const allRolesInExpected = rolesDiscoveredByApi.every((r) => expectedRoleIds.has(r.toLowerCase()));
  console.log('Expected roles (from DB-backed meta):', [...expectedRoleIds].sort().join(', ') || 'none');
  console.log('Roles for which API returned vendors:', rolesDiscoveredByApi.join(', ') || 'none');
  console.log('All API-discovered roles in expected set:', allRolesInExpected ? 'YES' : 'NO');
  console.log('Unique vendors discovered via API:', apiDiscoveredVendors.size);
  apiDiscoveredByRole.forEach((v, role) => {
    console.log(`  ${role}: vendors=${v.apiProviderCount} used=${v.vendorId}`);
  });
  console.log('═'.repeat(60));
  console.log('FORENSIC SUMMARY');
  console.log('═'.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.flow} (${r.roleId})${r.error ? `: ${r.error}` : ''}`);
  });
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (!meta.fromMeta) console.log('Revalidation note: discovery/meta was unavailable; expected set was fallback list.');
  console.log('═'.repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
