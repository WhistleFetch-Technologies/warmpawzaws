#!/usr/bin/env node
/**
 * Dev smoke: vet vendor + custom boarding service must use boarding GST (~18%), not vet 0%.
 *
 * Inserts a temporary custom vendor_services row via RDS, calls POST /tax/calculate,
 * asserts gstRate > 0 for boarding custom and ~0 for catalog veterinary (when available),
 * then cleans up.
 *
 * Requires AWS credentials for RDS Data API. Deployed Lambda must include the GST fix
 * (resolve service category before vet role short-circuit) for this smoke to pass.
 *
 * Usage:
 *   API_BASE=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com node scripts/smoke-test-custom-service-gst-dev.js
 */
const { query, executeSQL } = require('./rds-data-api-utils-dev');

const API = process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const SMOKE_NAME = `Smoke GST Custom Boarding ${new Date().toISOString().slice(0, 19)}`;

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log(`  ✅ ${msg}`);
}

function cell(row, key, idx) {
  if (row == null) return undefined;
  if (typeof row === 'object' && !Array.isArray(row) && key in row) return row[key];
  if (Array.isArray(row)) return row[idx];
  return row[key];
}

async function main() {
  console.log('=== Custom-service GST (vet → boarding) dev smoke ===\n');
  console.log(`API: ${API}\n`);

  let customServiceId = null;
  let baseServiceId = null;

  try {
    // 1) Vet-role vendor
    const vendors = await query(`
      SELECT v.id::text AS vendor_id, v.business_name, r.name AS role_name
      FROM vendors v
      JOIN roles r ON r.id = v.role_id
      WHERE v.is_active = true
        AND LOWER(TRIM(r.name)) IN (
          'vet_clinic', 'veterinarian', 'vet_solo', 'vet',
          'veterinary_clinic', 'solo_vet', 'pet_clinic'
        )
      ORDER BY v.updated_at DESC NULLS LAST
      LIMIT 5
    `);
    if (!vendors.length) throw new Error('No active vet-role vendor found on dev RDS');

    const vendorId = cell(vendors[0], 'vendor_id', 0);
    const vendorName = cell(vendors[0], 'business_name', 1);
    const roleName = cell(vendors[0], 'role_name', 2);
    ok(vendorId, `Vet vendor ${vendorName} (${vendorId}) role=${roleName}`);

    // 2) Boarding catalogue category UUID + display name
    const cats = await query(`
      SELECT id::text AS id, name, category_id AS slug
      FROM service_categories
      WHERE (
        LOWER(TRIM(COALESCE(category_id, ''))) IN ('boarding', 'pet_boarding', 'pet-boarding')
        OR LOWER(TRIM(name)) LIKE '%boarding%'
      )
      ORDER BY
        CASE
          WHEN LOWER(TRIM(COALESCE(category_id, ''))) IN ('boarding', 'pet_boarding') THEN 0
          ELSE 1
        END
      LIMIT 1
    `);
    if (!cats.length) throw new Error('No boarding service_categories row found');
    const boardingCategoryId = cell(cats[0], 'id', 0);
    const boardingName = cell(cats[0], 'name', 1) || 'Boarding';
    const boardingSlug = cell(cats[0], 'slug', 2) || 'boarding';
    ok(boardingCategoryId, `Boarding category ${boardingName} (${boardingSlug}) id=${boardingCategoryId}`);

    // 3) Insert base services row + custom vendor_services (mirrors custom create)
    await executeSQL(`
      INSERT INTO services (id, name, description, category, price, duration_minutes, is_active, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        '${SMOKE_NAME.replace(/'/g, "''")}',
        'Automated GST smoke custom boarding',
        '${String(boardingName).replace(/'/g, "''")}',
        1000,
        60,
        true,
        NOW(),
        NOW()
      )
    `);

    const baseRows = await query(`
      SELECT id::text AS id FROM services
      WHERE name = '${SMOKE_NAME.replace(/'/g, "''")}'
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `);
    baseServiceId = cell(baseRows[0], 'id', 0);
    ok(baseServiceId, `Created base services row ${baseServiceId}`);

    await executeSQL(`
      INSERT INTO vendor_services (
        id, vendor_id, service_id, service_name, category, category_id,
        service_style, price, custom_price, duration_minutes, custom_duration,
        is_enabled, publish_status, is_custom_service, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        '${vendorId}'::uuid,
        '${baseServiceId}'::uuid,
        '${SMOKE_NAME.replace(/'/g, "''")}',
        '${String(boardingName).replace(/'/g, "''")}',
        '${boardingCategoryId}'::uuid,
        'at_center',
        1000,
        1000,
        60,
        60,
        true,
        'published',
        true,
        NOW(),
        NOW()
      )
    `);

    const vsRows = await query(`
      SELECT id::text AS id FROM vendor_services
      WHERE vendor_id = '${vendorId}'::uuid
        AND service_name = '${SMOKE_NAME.replace(/'/g, "''")}'
        AND is_custom_service = true
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `);
    customServiceId = cell(vsRows[0], 'id', 0);
    ok(customServiceId, `Created custom boarding vendor_service ${customServiceId}`);

    // 4) Tax calculate — boarding custom must NOT be 0%
    const taxBoarding = await fetchJson('/tax/calculate', {
      method: 'POST',
      body: JSON.stringify({
        vendorId,
        customerLocation: { state: 'Karnataka', city: 'Bangalore' },
        vendorLocation: { state: 'Karnataka', city: 'Bangalore' },
        items: [
          {
            type: 'service',
            serviceId: customServiceId,
            amount: 1000,
            quantity: 1,
            serviceStyle: 'at_center',
            category: boardingName,
          },
        ],
      }),
    });
    ok(taxBoarding.status === 200, `POST /tax/calculate (boarding custom) status ${taxBoarding.status}`);
    const boardingItem = (taxBoarding.body?.items || taxBoarding.body?.taxBreakdown || [])[0];
    const boardingRate = Number(
      boardingItem?.gstRate ?? boardingItem?.gst_rate ?? taxBoarding.body?.items?.[0]?.gstRate ?? NaN
    );
    ok(Number.isFinite(boardingRate), `Boarding custom gstRate parsed: ${boardingRate}`);
    ok(
      boardingRate > 0,
      `Boarding custom GST rate ${boardingRate}% (expected > 0, typically 18 — not vet 0%)`
    );

    // 5) Negative control: catalog veterinary service on same vendor → ~0%
    const vetSvcs = await query(`
      SELECT vs.id::text AS id
      FROM vendor_services vs
      JOIN service_catalog sc ON sc.id = vs.service_id
      WHERE vs.vendor_id = '${vendorId}'::uuid
        AND vs.is_enabled = true
        AND COALESCE(vs.is_custom_service, false) = false
        AND (
          LOWER(TRIM(COALESCE(sc.category_id, ''))) IN ('veterinary', 'vet')
          OR LOWER(TRIM(COALESCE(sc.category_name, ''))) LIKE '%vet%'
        )
      LIMIT 1
    `);
    if (vetSvcs.length) {
      const vetServiceId = cell(vetSvcs[0], 'id', 0);
      const taxVet = await fetchJson('/tax/calculate', {
        method: 'POST',
        body: JSON.stringify({
          vendorId,
          customerLocation: { state: 'Karnataka', city: 'Bangalore' },
          vendorLocation: { state: 'Karnataka', city: 'Bangalore' },
          items: [
            {
              type: 'service',
              serviceId: vetServiceId,
              amount: 1000,
              quantity: 1,
              serviceStyle: 'at_center',
            },
          ],
        }),
      });
      ok(taxVet.status === 200, `POST /tax/calculate (catalog vet) status ${taxVet.status}`);
      const vetItem = (taxVet.body?.items || [])[0];
      const vetRate = Number(vetItem?.gstRate ?? vetItem?.gst_rate ?? NaN);
      ok(Number.isFinite(vetRate), `Catalog vet gstRate parsed: ${vetRate}`);
      ok(vetRate === 0, `Catalog veterinary GST rate ${vetRate}% (expected 0 for vet roles)`);
    } else {
      console.log('  ⚠️  No catalog veterinary service on vendor — skipped negative control');
    }

    console.log('\n=== Smoke test PASSED ===');
  } finally {
    if (customServiceId) {
      try {
        await executeSQL(`DELETE FROM vendor_services WHERE id = '${customServiceId}'::uuid`);
        console.log(`\n  🧹 Cleaned up vendor_services ${customServiceId}`);
      } catch (e) {
        console.warn('  ⚠️  Cleanup vendor_services failed:', e.message || e);
      }
    }
    if (baseServiceId) {
      try {
        await executeSQL(`DELETE FROM services WHERE id = '${baseServiceId}'::uuid`);
        console.log(`  🧹 Cleaned up services ${baseServiceId}`);
      } catch (e) {
        console.warn('  ⚠️  Cleanup services failed:', e.message || e);
      }
    }
  }
}

main().catch((e) => {
  console.error('\n=== Smoke test FAILED ===');
  console.error(e.message || e);
  process.exit(1);
});
