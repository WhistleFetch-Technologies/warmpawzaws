#!/usr/bin/env node
/**
 * WAPPT groomer gate audit — read-only dev/prod RDS + optional dev API smoke.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/wappt-groomer-gate-audit.js
 *   ENVIRONMENT=dev node scripts/wappt-groomer-gate-audit.js --vendor-id=<uuid>
 *   ENVIRONMENT=dev node scripts/wappt-groomer-gate-audit.js --specialization=full_grooming
 *   ENVIRONMENT=dev node scripts/wappt-groomer-gate-audit.js --api-smoke
 */
const { query } = require('./rds-data-api-utils-dev');

const DEV_API = process.env.WAPPT_DEV_API || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit ? hit.slice(prefix.length + 1).trim() : '';
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

async function auditGroomerCatalogue() {
  console.log('\n=== Groomer WAPPT catalogue rows ===\n');
  const rows = await query(`
    SELECT c.vendor_id,
           COALESCE(v.business_name, v.owner_name) AS name,
           v.status,
           v.is_active,
           c.publish_status,
           c.appointment_fee,
           EXISTS (
             SELECT 1 FROM vendor_services vs
             WHERE vs.vendor_id = v.id
               AND vs.is_enabled = true
               AND vs.service_style IN ('at_home', 'home_visit', 'home')
           ) AS has_at_home_service
    FROM warmpawz_appointments_vendor_catalog c
    JOIN vendors v ON v.id = c.vendor_id
    JOIN roles r ON r.id = v.role_id
    WHERE LOWER(COALESCE(r.name, '')) LIKE '%groom%'
       OR LOWER(COALESCE(r.display_name, '')) LIKE '%groom%'
    ORDER BY name
    LIMIT 50
  `);

  if (!rows.length) {
    console.log('No groomer catalogue rows found.');
    return [];
  }

  for (const row of rows) {
    const visible =
      row.publish_status === 'published' &&
      ['approved', 'active'].includes(String(row.status || '').toLowerCase()) &&
      row.is_active !== false;
    console.log(
      `- ${row.name} (${row.vendor_id}) publish=${row.publish_status} status=${row.status} at_home=${row.has_at_home_service} visible=${visible}`,
    );
  }
  return rows;
}

async function auditVendorGates(vendorId, specialization) {
  if (!vendorId) return;
  console.log(`\n=== Vendor gate audit: ${vendorId} specialization=${specialization || '(none)'} ===\n`);

  const [catalogue] = await query(`
    SELECT c.publish_status, c.appointment_fee,
           v.status, v.is_active, COALESCE(v.business_name, v.owner_name) AS name
    FROM warmpawz_appointments_vendor_catalog c
    JOIN vendors v ON v.id = c.vendor_id
    WHERE c.vendor_id = '${vendorId}'::uuid
    LIMIT 1
  `);

  if (!catalogue) {
    console.log('FAIL Gate1: not in warmpawz_appointments_vendor_catalog');
  } else {
    const pub = catalogue.publish_status === 'published';
    const st = String(catalogue.status || '').toLowerCase();
    const okVendor = ['approved', 'active'].includes(st) && catalogue.is_active !== false;
    console.log(
      pub && okVendor
        ? `OK Gate1: catalogue published, vendor ${catalogue.status}`
        : `FAIL Gate1: publish=${catalogue.publish_status} status=${catalogue.status} active=${catalogue.is_active}`,
    );
  }

  const [styles] = await query(`
    SELECT COUNT(*)::int AS n
    FROM vendor_services vs
    WHERE vs.vendor_id = '${vendorId}'::uuid
      AND vs.is_enabled = true
      AND vs.service_style IN ('at_home', 'home_visit', 'home')
  `);
  console.log(
    styles?.n > 0
      ? `OK Gate3: ${styles.n} enabled at_home vendor_service row(s)`
      : 'FAIL Gate3: no enabled at_home vendor_services — vendor must enable Home Visit services',
  );

  if (specialization) {
    const specs = await query(`
      SELECT specialization FROM vendor_specializations WHERE vendor_id = '${vendorId}'::uuid
    `);
    console.log(`Vendor specializations (${specs.length}):`, specs.map((s) => s.specialization).join(', ') || '(none)');

    const [sm] = await query(`
      SELECT specialization_id, name, display_name
      FROM specialization_master
      WHERE is_active = true
        AND (
          LOWER(TRIM(specialization_id)) = LOWER(TRIM('${specialization.replace(/'/g, "''")}'))
          OR LOWER(TRIM(name)) = LOWER(TRIM('${specialization.replace(/'/g, "''")}'))
        )
      LIMIT 5
    `);
    console.log(
      sm
        ? `Canonical spec: ${sm.specialization_id} (${sm.display_name || sm.name})`
        : `WARN: specialization_master row not found for filter "${specialization}"`,
    );
    console.log(
      specs.length
        ? 'Gate4: verify UUID/slug above matches canonical spec via discovery SQL (run --api-smoke)'
        : 'FAIL Gate4: vendor_specializations empty — vendor must select specializations in profile',
    );
  }
}

async function apiSmoke(specialization) {
  console.log('\n=== Dev API smoke ===\n');
  const base = `${DEV_API}/customer/warmpawz-appointments/discovery/by-category?category=grooming&serviceStyle=at_home&limit=10`;
  const withoutSpec = await fetchJson(base);
  const vendorCount = withoutSpec.body?.vendors?.length ?? withoutSpec.body?.data?.vendors?.length ?? 0;
  console.log(`Without specialization: HTTP ${withoutSpec.status}, vendors=${vendorCount}`);

  if (specialization) {
    const withSpec = await fetchJson(`${base}&specialization=${encodeURIComponent(specialization)}`);
    const specCount = withSpec.body?.vendors?.length ?? withSpec.body?.data?.vendors?.length ?? 0;
    const applied = withSpec.body?.specialization ?? withSpec.body?.meta?.specialization;
    console.log(
      `With specialization=${specialization}: HTTP ${withSpec.status}, vendors=${specCount}, specializationApplied=${applied ?? 'n/a'}`,
    );
  }

  const problems = await fetchJson(`${DEV_API}/public/problems?roleId=groomer`);
  const first = problems.body?.problems?.[0];
  console.log(
    `/public/problems groomer: HTTP ${problems.status}, count=${problems.body?.count ?? 0}, sampleId=${first?.id ?? 'n/a'}`,
  );
}

async function printAdminVendorChecklist() {
  console.log('\n=== Admin / vendor population checklist ===\n');
  console.log('Admin (Warmpawz Appointments → Catalogue):');
  console.log('  1. Create catalogue entry for groomer vendor');
  console.log('  2. Set appointment_fee (slot fee)');
  console.log('  3. Publish entry (draft is invisible to customers)');
  console.log('  4. Ensure vendor status is approved or active');
  console.log('Vendor (Professional Profile):');
  console.log('  1. Select specializations matching customer problem tiles');
  console.log('  2. Enable at_home services in vendor_services if tiles allow Home Visit only');
}

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  const vendorId = argValue('--vendor-id');
  const specialization = argValue('--specialization') || 'full_grooming';
  const apiSmokeFlag = process.argv.includes('--api-smoke');

  console.log(`WAPPT groomer gate audit (${env})`);

  await auditGroomerCatalogue();
  if (vendorId) await auditVendorGates(vendorId, specialization);
  else {
    const inactive = await query(`
      SELECT c.vendor_id, COALESCE(v.business_name, v.owner_name) AS name, v.status
      FROM warmpawz_appointments_vendor_catalog c
      JOIN vendors v ON v.id = c.vendor_id
      JOIN roles r ON r.id = v.role_id
      WHERE c.publish_status = 'published'
        AND LOWER(COALESCE(r.name, '')) LIKE '%groom%'
        AND NOT (
          LOWER(v.status) IN ('approved', 'active')
          AND COALESCE(v.is_active, true) = true
          AND (v.is_deleted IS NOT TRUE)
        )
      LIMIT 10
    `);
    if (inactive.length) {
      console.log('\nPublished groomers NOT customer-visible (fix vendor status or unpublish):');
      for (const row of inactive) {
        console.log(`  - ${row.name} (${row.vendor_id}) status=${row.status}`);
      }
    }
  }

  await printAdminVendorChecklist();

  if (apiSmokeFlag) {
    await apiSmoke(specialization);
  } else {
    console.log('\nTip: add --api-smoke to hit dev discovery API');
  }
}

main().catch((e) => {
  console.error('Audit failed:', e.message);
  process.exit(1);
});
