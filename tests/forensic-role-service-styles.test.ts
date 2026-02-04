/**
 * Forensic test: Role & Service Styles rollout validation
 *
 * Validates:
 * - Phase 0: Canonical sources; strict toggle; no permissive fallbacks in responses.
 * - Phase 1: Backend returns serviceStyles as canonical codes only (at_home, at_center, tele);
 *            serviceStylesLabels separate; frontend normalizer does not default unknown to at_center.
 * - Phase 2: GET /service-catalog/role/:roleId without serviceStyle filters by allowed styles;
 *            GET /vendor/:vendorId/services main list only allowed styles, disallowedLegacy separate.
 *
 * Run:
 *   API_BASE_URL=<backend-with-fix> npx ts-node tests/forensic-role-service-styles.test.ts
 *   TEST_VENDOR_ID=<uuid> ...  (to run vendor services check)
 * Frontend normalizer: cd apps/vendor-web && npm test -- --testPathPattern=forensic
 */

const API_BASE = process.env.API_BASE_URL || process.env.API_ENDPOINT || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const CANONICAL_CODES = ['at_home', 'at_center', 'tele'];
const LABEL_STRINGS = ['At Home', 'At Center', 'Tele Consultation', 'At center', 'At home'];

async function getJson<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[FAIL] ${message}`);
}

// --- Unit-style: normalizer contract (no at_center default for unknown) ---
// We test by validating API responses; for frontend normalizer we assert canonical-only in API.
function isCanonicalOnly(arr: unknown): arr is string[] {
  if (!Array.isArray(arr)) return false;
  return arr.every((s) => typeof s === 'string' && CANONICAL_CODES.includes(s));
}

function hasNoLabelStrings(arr: unknown): boolean {
  if (!Array.isArray(arr)) return true;
  return !arr.some((s) => typeof s === 'string' && LABEL_STRINGS.includes(s));
}

async function main(): Promise<void> {
  console.log('=== Forensic: Role & Service Styles rollout ===\n');
  console.log('API_BASE:', API_BASE);

  let passed = 0;
  let failed = 0;

  // --- 1. GET /config/roles: serviceStyles canonical only; serviceStylesLabels separate ---
  try {
    const listRes = await getJson<{ success: boolean; roles: any[] }>('/config/roles');
    assert(listRes.success && Array.isArray(listRes.roles), 'GET /config/roles returns success and roles array');

    for (const r of listRes.roles) {
      const styles = r.serviceStyles;
      assert(
        styles === undefined || isCanonicalOnly(styles),
        `Role ${r.name}: serviceStyles must be canonical codes only, got ${JSON.stringify(styles)}`
      );
      assert(
        styles === undefined || hasNoLabelStrings(styles),
        `Role ${r.name}: serviceStyles must not contain label strings`
      );
      if (styles && styles.length > 0 && r.serviceStylesLabels) {
        assert(
          typeof r.serviceStylesLabels === 'object' && !Array.isArray(r.serviceStylesLabels),
          `Role ${r.name}: serviceStylesLabels must be object (map) when present`
        );
      }
    }
    console.log('[PASS] GET /config/roles: serviceStyles canonical only, no labels in serviceStyles');
    passed++;
  } catch (e: any) {
    console.error('[FAIL] GET /config/roles:', e.message);
    if (e.message.includes('canonical codes only') || e.message.includes('label strings')) {
      console.error('       Ensure API_BASE_URL points to a backend with Phase 1 roles.ts (canonical serviceStyles).');
    }
    failed++;
  }

  // --- 2. GET /config/roles/:id: serviceStyles canonical; serviceStylesLabels; updated_at ---
  try {
    const listRes = await getJson<{ success: boolean; roles: any[] }>('/config/roles');
    if (listRes.roles?.length > 0) {
      const firstId = listRes.roles[0].id || listRes.roles[0].roleId;
      const byIdRes = await getJson<any>(`/config/roles/${firstId}`);
      assert(isCanonicalOnly(byIdRes.serviceStyles), 'GET /config/roles/:id serviceStyles canonical only');
      assert(hasNoLabelStrings(byIdRes.serviceStyles), 'GET /config/roles/:id serviceStyles no label strings');
      if (byIdRes.serviceStyles?.length > 0) {
        assert(
          byIdRes.serviceStylesLabels && typeof byIdRes.serviceStylesLabels === 'object',
          'GET /config/roles/:id has serviceStylesLabels when serviceStyles present'
        );
      }
      console.log('[PASS] GET /config/roles/:id: serviceStyles canonical, serviceStylesLabels separate');
      passed++;
    } else {
      console.log('[SKIP] GET /config/roles/:id: no roles to test');
    }
  } catch (e: any) {
    console.error('[FAIL] GET /config/roles/:id:', e.message);
    failed++;
  }

  // --- 3. GET /service-catalog/role/:roleId without serviceStyle: only allowed styles returned ---
  try {
    const listRes = await getJson<{ success: boolean; roles: any[] }>('/config/roles');
    const walkerLike = listRes.roles?.find(
      (r: any) =>
        (r.name || '').toLowerCase().includes('walker') ||
        (r.name || '').toLowerCase().includes('walk') ||
        ((r.serviceStyles || []) as string[]).length === 1 && (r.serviceStyles as string[])[0] === 'at_home'
    );
    const roleId = walkerLike?.id || walkerLike?.roleId || walkerLike?.name || 'walker';
    const catalogRes = await getJson<{ success: boolean; services: any[]; serviceStyles: string[] }>(
      `/service-catalog/role/${encodeURIComponent(roleId)}`
    );
    assert(catalogRes.success !== false, 'GET /service-catalog/role/:roleId success');
    assert(Array.isArray(catalogRes.serviceStyles), 'response has serviceStyles array');
    assert(isCanonicalOnly(catalogRes.serviceStyles), 'response serviceStyles canonical only');

    const allowedSet = new Set(catalogRes.serviceStyles || []);
    const services = catalogRes.services || [];
    for (const s of services) {
      const style = s.serviceStyle || s.service_style || 'all';
      if (style !== 'all' && style != null) {
        assert(allowedSet.has(style), `Catalog service has style ${style} which is in allowed ${[...allowedSet]}`);
      }
    }
    console.log('[PASS] GET /service-catalog/role/:roleId (no query): serviceStyles canonical; services only in allowed styles');
    passed++;
  } catch (e: any) {
    console.error('[FAIL] GET /service-catalog/role/:roleId:', e.message);
    failed++;
  }

  // --- 4. GET /vendor/:vendorId/services: allowedServiceStyles; services only allowed; disallowedLegacy ---
  const testVendorId = process.env.TEST_VENDOR_ID || '';
  if (testVendorId) {
    try {
      const vendorRes = await getJson<any>(`/vendor/${testVendorId}/services`);
      assert(vendorRes.success !== false, 'GET /vendor/:id/services success');
      assert(Array.isArray(vendorRes.allowedServiceStyles), 'response has allowedServiceStyles array');
      assert(isCanonicalOnly(vendorRes.allowedServiceStyles), 'allowedServiceStyles canonical only');
      assert(Array.isArray(vendorRes.disallowedLegacy), 'response has disallowedLegacy array');

      const allowedSet = new Set(vendorRes.allowedServiceStyles || []);
      const mainServices = vendorRes.services || vendorRes.allServices || [];
      for (const s of mainServices) {
        const style = s.serviceStyle || s.service_style;
        if (style) assert(allowedSet.has(style), `Vendor service in main list has style ${style} in allowed`);
      }
      console.log('[PASS] GET /vendor/:id/services: allowedServiceStyles canonical; main list only allowed; disallowedLegacy present');
      passed++;
    } catch (e: any) {
      console.error('[FAIL] GET /vendor/:id/services:', e.message);
      failed++;
    }
  } else {
    console.log('[SKIP] GET /vendor/:id/services: set TEST_VENDOR_ID to run');
  }

  console.log('\n=== Summary ===');
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
