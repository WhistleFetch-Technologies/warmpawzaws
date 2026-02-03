/**
 * Forensic test: Role permissions (admin Catalog & Service / roles config)
 * must match exactly what vendor gets at login (profile + dashboard).
 *
 * Contract:
 * 1. GET /config/roles and GET /config/roles/:id return capabilities from role_permissions (single source of truth).
 * 2. Vendor profile and dashboard return capabilities = role_permissions for vendor's role_id,
 *    filtered only by vendor's type (solo/business) and role's capabilityRules/serviceStyles.
 * 3. Every capability a vendor sees must be in their role's role_permissions (no extra caps).
 *
 * Run: npx ts-node tests/capabilities/forensic-role-permissions-vendor-login.test.ts
 * Or: API_BASE_URL=https://... node --loader ts-node/esm tests/capabilities/forensic-role-permissions-vendor-login.test.ts
 */

const API_BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

interface RoleFromApi {
  id: string;
  name: string;
  display_name?: string;
  roleId?: string;
  roleCode?: string;
  capabilities: string[];
  config?: Record<string, unknown>;
}

interface VendorProfileVendor {
  id: string;
  role_id?: string;
  roleId?: string;
  vendor_type?: string;
  vendorType?: string;
  capabilities?: string[];
  vendorConfiguration?: string;
}

async function getJson<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { headers: headers || {} });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function main() {
  console.log('=== Forensic: Role permissions vs vendor login capabilities ===\n');
  console.log('API_BASE:', API_BASE);

  // --- 1. Load all roles and their capabilities (same as admin "roles in catalog and services") ---
  const listRes = await getJson<{ success: boolean; roles: RoleFromApi[] }>('/config/roles');
  if (!listRes.success || !Array.isArray(listRes.roles)) {
    throw new Error('GET /config/roles did not return success or roles array');
  }

  const roleIdToCapabilities = new Map<string, string[]>();
  const roleIdToName = new Map<string, string>();

  for (const r of listRes.roles) {
    const id = r.id || (r as any).roleId;
    const caps = r.capabilities || [];
    roleIdToCapabilities.set(id, caps);
    roleIdToName.set(id, r.display_name || r.name || r.roleCode || id);
  }

  console.log('Roles loaded:', listRes.roles.length);
  for (const [id, caps] of roleIdToCapabilities) {
    console.log(`  - ${roleIdToName.get(id)} (${id}): ${caps.length} capabilities`);
  }

  // --- 2. For each role, GET /config/roles/:id must return same capabilities ---
  let sameRoleById = 0;
  let sameRoleByIdFail = 0;
  for (const r of listRes.roles) {
    const id = r.id || (r as any).roleId;
    const listCaps = roleIdToCapabilities.get(id) || [];
    try {
      const byIdRes = await getJson<{ success: boolean; capabilities?: string[] }>(`/config/roles/${id}`);
      const byIdCaps = byIdRes.capabilities || [];
      const listSet = new Set(listCaps);
      const byIdSet = new Set(byIdCaps);
      const same = listSet.size === byIdSet.size && [...listSet].every((c) => byIdSet.has(c));
      if (same) {
        sameRoleById++;
      } else {
        sameRoleByIdFail++;
        console.error(`  [FAIL] Role ${roleIdToName.get(id)}: list has ${listCaps.length}, by-id has ${byIdCaps.length}; list-only: ${listCaps.filter((c) => !byIdSet.has(c)).join(', ') || 'none'}; by-id-only: ${byIdCaps.filter((c) => !listSet.has(c)).join(', ') || 'none'}`);
      }
    } catch (e: any) {
      sameRoleByIdFail++;
      console.error(`  [FAIL] Role ${id}: ${e.message}`);
    }
  }
  console.log('\nGET /config/roles vs GET /config/roles/:id consistency:', sameRoleById, 'ok', sameRoleByIdFail, 'fail');

  // --- 3. Vendor profile/dashboard capabilities must be subset of role permissions ---
  // We need at least one vendor per role to test. Use env or skip if no vendors.
  const testVendorIds = (process.env.TEST_VENDOR_IDS || '').split(',').filter(Boolean);
  if (testVendorIds.length === 0) {
    console.log('\nNo TEST_VENDOR_IDS set; skipping vendor profile/dashboard subset checks.');
    console.log('Set TEST_VENDOR_IDS=id1,id2 (and optional AUTH_HEADER="Bearer ...") to run vendor checks.');
    return;
  }

  let vendorSubsetOk = 0;
  let vendorSubsetFail = 0;
  for (const vendorId of testVendorIds) {
    try {
      const headers: Record<string, string> = {};
      if (process.env.AUTH_HEADER) headers['Authorization'] = process.env.AUTH_HEADER;

      const profileRes = await getJson<{ success: boolean; vendor?: VendorProfileVendor }>(
        `/vendor/${vendorId}/profile`,
        headers
      );
      const vendor = profileRes.vendor;
      if (!vendor) {
        console.warn(`  [SKIP] Vendor ${vendorId}: no vendor in profile`);
        continue;
      }

      const roleId = vendor.role_id || vendor.roleId;
      if (!roleId) {
        console.warn(`  [SKIP] Vendor ${vendorId}: no role_id`);
        continue;
      }

      const roleCaps = roleIdToCapabilities.get(roleId) || [];
      const vendorCaps = vendor.capabilities || [];
      // Allow solo-added caps (per capability-filter: platform_catalog_services, professional_profile)
      const soloAdditions = ['platform_catalog_services', 'professional_profile'];
      const allowedSet = new Set([...roleCaps, ...(vendor.vendor_type === 'solo' || vendor.vendorType === 'solo' ? soloAdditions : [])]);
      const extra = vendorCaps.filter((c) => !allowedSet.has(c));
      if (extra.length > 0) {
        vendorSubsetFail++;
        console.error(`  [FAIL] Vendor ${vendorId} (role ${roleIdToName.get(roleId)}): profile has capabilities not in role (or solo additions): ${extra.join(', ')}`);
      } else {
        vendorSubsetOk++;
        console.log(`  [OK] Vendor ${vendorId}: ${vendorCaps.length} capabilities ⊆ role (${roleCaps.length})`);
      }
    } catch (e: any) {
      vendorSubsetFail++;
      console.error(`  [FAIL] Vendor ${vendorId}: ${e.message}`);
    }
  }
  console.log('\nVendor profile capabilities ⊆ role permissions:', vendorSubsetOk, 'ok', vendorSubsetFail, 'fail');

  // --- 4. Optional: same check for dashboard endpoint ---
  let dashboardSubsetOk = 0;
  let dashboardSubsetFail = 0;
  for (const vendorId of testVendorIds) {
    try {
      const headers: Record<string, string> = {};
      if (process.env.AUTH_HEADER) headers['Authorization'] = process.env.AUTH_HEADER;

      const dashRes = await getJson<{ success: boolean; vendor?: { capabilities?: string[]; role_id?: string; roleId?: string }; stats?: unknown }>(
        `/vendor/dashboard/${vendorId}`,
        headers
      );
      const vendor = (dashRes as any).vendor;
      const caps = vendor?.capabilities || (dashRes as any).capabilities || [];
      const roleId = vendor?.role_id || vendor?.roleId || (dashRes as any).roleId;
      if (!roleId || !caps) {
        console.warn(`  [SKIP] Dashboard ${vendorId}: no role_id or capabilities`);
        continue;
      }

      const roleCaps = roleIdToCapabilities.get(roleId) || [];
      const isSolo = vendor?.vendor_type === 'solo' || vendor?.vendorType === 'solo' || (dashRes as any).vendor?.vendorConfiguration === 'solo';
      const soloAdditions = ['platform_catalog_services', 'professional_profile'];
      const allowedSet = new Set([...roleCaps, ...(isSolo ? soloAdditions : [])]);
      const extra = caps.filter((c: string) => !allowedSet.has(c));
      if (extra.length > 0) {
        dashboardSubsetFail++;
        console.error(`  [FAIL] Dashboard ${vendorId}: capabilities not in role (or solo additions): ${extra.join(', ')}`);
      } else {
        dashboardSubsetOk++;
      }
    } catch (e: any) {
      dashboardSubsetFail++;
      console.error(`  [FAIL] Dashboard ${vendorId}: ${e.message}`);
    }
  }
  console.log('Vendor dashboard capabilities ⊆ role permissions:', dashboardSubsetOk, 'ok', dashboardSubsetFail, 'fail');

  const totalFails = sameRoleByIdFail + vendorSubsetFail + dashboardSubsetFail;
  if (totalFails > 0) {
    process.exit(1);
  }
  console.log('\nAll forensic checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
