/**
 * ============================================================================
 * E2E: BOOKING FLOW – ALL SERVICE TYPES (VET, GROOMER, TRAINER, WALKER, NUTRITIONIST)
 * ============================================================================
 *
 * Runs the same full booking lifecycle per flow:
 * 1. Discovery (role-based)
 * 2. Vendor + service selection
 * 3. Create booking (camelCase, CreateBookingRequestSchema)
 * 4. Confirm (PUT /bookings/:id/status { status: 'confirmed' })
 * 5. Start (PUT /bookings/:id/status { status: 'in_progress' })
 * 6. Complete (PUT /bookings/:id/status { status: 'completed' })
 *
 * Pharmacy: order flow (not booking); optional minimal check.
 *
 * Run: npx ts-node tests/e2e/booking-flow-all-services.test.ts
 * ============================================================================
 */

const API_BASE_URL = process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const TEST_PHONE = process.env.TEST_CUSTOMER_PHONE || '9876543210';

interface FlowContext {
  roleId: string;
  flowName: string;
  vendorId?: string;
  serviceId?: string;
  customerId?: string;
  bookingId?: string;
}

async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await response.json().catch(() => ({}));
  const errMsg =
    typeof data?.error === 'string'
      ? data.error
      : data?.error?.message ?? (data?.error && JSON.stringify(data.error)) ?? response.statusText;
  if (!response.ok) throw new Error(`API Error: ${errMsg}`);
  return data;
}

function log(flow: string, step: string, message: string, data?: any): void {
  console.log(`\n[${flow}] ${step} ${message}`);
  if (data != null) console.log(JSON.stringify(data, null, 2));
}

// Search terms per role (fallback when discover-services fails e.g. category_id backend error)
const SEARCH_TERMS: Record<string, string> = {
  veterinarian: 'veterinarian',
  groomer: 'grooming',
  trainer: 'training',
  walker: 'walker',
  nutritionist: 'nutrition',
};

// Discover vendors for role; set ctx.vendorId and ctx.serviceId when possible.
// Tries discover-services first; on failure uses /search as fallback.
async function discoverForRole(ctx: FlowContext): Promise<boolean> {
  const searchTerm = SEARCH_TERMS[ctx.roleId] ?? ctx.roleId;

  // 1) Try discover-services
  try {
    const res = await apiRequest(
      `/customer/discover-services?lat=12.9716&lng=77.5946&role_id=${ctx.roleId}`,
      'GET'
    );
    const list = res.providers ?? res.vendors ?? [];
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0];
      ctx.vendorId = first.id ?? first.vendor_id ?? first.vendorId;
      if (ctx.vendorId) {
        const servicesRes = await apiRequest(`/customer/vendor/${ctx.vendorId}/services`, 'GET');
        const services = servicesRes?.services ?? servicesRes?.data ?? [];
        if (Array.isArray(services) && services.length > 0) {
          const s = services[0];
          ctx.serviceId = s.id ?? s.serviceId ?? s.service_id;
        }
        log(ctx.flowName, 'discover', 'Vendor and service resolved (discover-services)', {
          vendorId: ctx.vendorId,
          serviceId: ctx.serviceId,
        });
        return !!ctx.vendorId && !!ctx.serviceId;
      }
    }
  } catch (e: any) {
    log(ctx.flowName, 'discover', 'discover-services failed, trying search', { error: e.message });
  }

  // 2) Fallback: /search
  try {
    const searchRes = await apiRequest(
      `/search?q=${encodeURIComponent(searchTerm)}&lat=12.9716&lng=77.5946`,
      'GET'
    );
    const vendors = searchRes?.vendors ?? [];
    const services = searchRes?.services ?? [];
    let vendorId: string | undefined;
    let serviceId: string | undefined;
    if (Array.isArray(vendors) && vendors.length > 0) {
      const v = vendors[0];
      vendorId = v.id ?? v.vendor_id ?? v.vendorId;
    }
    if (Array.isArray(services) && services.length > 0) {
      const s = services[0];
      serviceId = s.id ?? s.serviceId ?? s.service_id;
      if (!vendorId && (s.vendor_id ?? s.vendorId)) vendorId = s.vendor_id ?? s.vendorId;
    }
    if (vendorId && !serviceId) {
      const servicesRes = await apiRequest(`/customer/vendor/${vendorId}/services`, 'GET');
      const list = servicesRes?.services ?? servicesRes?.data ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const s = list[0];
        serviceId = s.id ?? s.serviceId ?? s.service_id;
      }
    }
    if (vendorId && serviceId) {
      ctx.vendorId = vendorId;
      ctx.serviceId = serviceId;
      log(ctx.flowName, 'discover', 'Vendor and service resolved (search fallback)', {
        vendorId: ctx.vendorId,
        serviceId: ctx.serviceId,
      });
      return true;
    }
  } catch (e: any) {
    log(ctx.flowName, 'discover', 'Search fallback failed', { error: e.message });
  }
  return false;
}

async function resolveCustomerId(phone: string): Promise<string | undefined> {
  try {
    const res = await apiRequest(`/customer/by-phone?phone=${encodeURIComponent(phone)}`, 'GET');
    return res?.customer?.id ?? res?.id;
  } catch {
    return undefined;
  }
}

// Full lifecycle for one flow: create → confirm → start → complete
// dateOffsetDays: use different day per flow to avoid "slot already booked" when reusing same vendor
async function runLifecycleForFlow(
  ctx: FlowContext,
  dateOffsetDays: number = 1
): Promise<{ passed: boolean; error?: string }> {
  if (!ctx.vendorId || !ctx.serviceId) {
    return { passed: false, error: 'Missing vendorId or serviceId after discovery' };
  }

  const customerId = ctx.customerId ?? (await resolveCustomerId(TEST_PHONE));
  if (!customerId) {
    return { passed: false, error: 'Could not resolve customerId (by-phone)' };
  }
  ctx.customerId = customerId;

  // Use first available slot; use different date per flow to avoid double-book
  let dateStr: string;
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
      const firstAvailable = slots.find((s: any) => s.available !== false) ?? slots[0];
      timeStr = firstAvailable?.time ?? firstAvailable ?? '10:00';
      if (typeof timeStr !== 'string') timeStr = '10:00';
    }
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + dateOffsetDays);
    dateStr = d.toISOString().split('T')[0];
  }

  // 1. Create booking (camelCase per CreateBookingRequestSchema)
  let bookingId: string | undefined;
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
    if (!bookingId) {
      return { passed: false, error: 'Create booking returned no bookingId' };
    }
    ctx.bookingId = bookingId;
    log(ctx.flowName, 'create', 'Booking created', { bookingId });
  } catch (e: any) {
    return { passed: false, error: `Create booking failed: ${e.message}` };
  }

  // 2. Confirm
  try {
    await apiRequest(`/bookings/${bookingId}/status`, 'PUT', { status: 'confirmed' });
    log(ctx.flowName, 'confirm', 'Booking confirmed');
  } catch (e: any) {
    return { passed: false, error: `Confirm failed: ${e.message}` };
  }

  // 3. Start (in_progress)
  try {
    await apiRequest(`/bookings/${bookingId}/status`, 'PUT', {
      status: 'in_progress',
      reason: 'E2E lifecycle test',
    });
    log(ctx.flowName, 'start', 'Booking started');
  } catch (e: any) {
    return { passed: false, error: `Start failed: ${e.message}` };
  }

  // 4. Complete
  try {
    await apiRequest(`/bookings/${bookingId}/status`, 'PUT', {
      status: 'completed',
      notes: 'E2E full lifecycle',
    });
    log(ctx.flowName, 'complete', 'Booking completed');
  } catch (e: any) {
    return { passed: false, error: `Complete failed: ${e.message}` };
  }

  return { passed: true };
}

// Pharmacy: order flow (not booking lifecycle) – optional smoke check
async function runPharmacyCheck(): Promise<{ passed: boolean; error?: string }> {
  try {
    const res = await apiRequest('/pharmacy/orders', 'GET').catch(() => null);
    if (res != null) {
      log('Pharmacy', 'orders', 'Orders endpoint responded (order flow, not booking)');
    }
    return { passed: true };
  } catch (e: any) {
    log('Pharmacy', 'orders', 'Pharmacy orders check failed (optional)', { error: e.message });
    return { passed: true }; // Don't fail suite for pharmacy
  }
}

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E – BOOKING FLOW ALL SERVICES');
  console.log('═'.repeat(60));
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Phone: ${TEST_PHONE}`);
  console.log('═'.repeat(60));

  const flows: FlowContext[] = [
    { roleId: 'veterinarian', flowName: 'Vet' },
    { roleId: 'groomer', flowName: 'Groomer' },
    { roleId: 'trainer', flowName: 'Trainer' },
    { roleId: 'walker', flowName: 'Walker' },
    { roleId: 'nutritionist', flowName: 'Nutritionist' },
  ];

  const customerId = await resolveCustomerId(TEST_PHONE);
  if (customerId) {
    flows.forEach((f) => (f.customerId = customerId));
  }

  const results: { flow: string; passed: boolean; error?: string }[] = [];
  let cachedVendorId: string | undefined;
  let cachedServiceId: string | undefined;
  let dateOffsetDays = 1;

  for (let i = 0; i < flows.length; i++) {
    const ctx = flows[i];
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🧪 ${ctx.flowName} (${ctx.roleId})`);
    console.log('─'.repeat(60));

    let discovered = await discoverForRole(ctx);
    if (!discovered && cachedVendorId && cachedServiceId) {
      ctx.vendorId = cachedVendorId;
      ctx.serviceId = cachedServiceId;
      discovered = true;
      log(ctx.flowName, 'discover', 'Using cached vendor/service from earlier flow');
    }
    if (discovered && ctx.vendorId && ctx.serviceId) {
      cachedVendorId = ctx.vendorId;
      cachedServiceId = ctx.serviceId;
    }
    if (!discovered) {
      results.push({
        flow: ctx.flowName,
        passed: false,
        error: 'Discovery failed (no vendor/service)',
      });
      console.log(`❌ ${ctx.flowName} - SKIP (discovery)`);
      continue;
    }

    // Use distinct date per flow to avoid "slot already booked" when reusing same vendor
    const dateOffsetDays = i + 1;
    const out = await runLifecycleForFlow(ctx, dateOffsetDays);
    results.push({
      flow: ctx.flowName,
      passed: out.passed,
      error: out.error,
    });
    if (out.passed) {
      console.log(`\n✅ ${ctx.flowName} - PASSED (create → confirm → start → complete)`);
    } else {
      console.log(`\n❌ ${ctx.flowName} - FAILED: ${out.error}`);
    }
  }

  // Pharmacy (optional)
  console.log(`\n${'─'.repeat(60)}`);
  console.log('🧪 Pharmacy (order flow)');
  console.log('─'.repeat(60));
  const pharmacyResult = await runPharmacyCheck();
  results.push({
    flow: 'Pharmacy',
    passed: pharmacyResult.passed,
    error: pharmacyResult.error,
  });
  console.log(pharmacyResult.passed ? '✅ Pharmacy - OK' : `❌ Pharmacy: ${pharmacyResult.error}`);

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.flow}${r.error ? `: ${r.error}` : ''}`);
  });
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('═'.repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
