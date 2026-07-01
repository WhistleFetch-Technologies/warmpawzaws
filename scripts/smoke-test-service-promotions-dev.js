#!/usr/bin/env node
/**
 * Dev smoke test: service provider promotions stack
 * vendor promo in DB → customer APIs → admin overview API
 */
const { query, executeSQL } = require('./rds-data-api-utils-dev');

const API = process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

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

async function main() {
  console.log('=== Service promotions dev smoke test ===\n');
  console.log(`API: ${API}\n`);

  // 1) Pick an active vet/grooming vendor with at least one service
  const vendors = await query(`
    SELECT v.id::text AS vendor_id, v.business_name, vs.id::text AS service_id, vs.price, vs.service_style
    FROM vendors v
    JOIN vendor_services vs ON vs.vendor_id = v.id
    WHERE v.is_active = true
      AND vs.is_enabled = true
      AND vs.price > 0
    ORDER BY v.updated_at DESC NULLS LAST
    LIMIT 5
  `);

  if (!vendors.length) {
    throw new Error('No suitable dev vendor with services found');
  }

  const row = vendors[0];
  const vendorId = row.vendor_id ?? row[0];
  const vendorName = row.business_name ?? row[1];
  const serviceId = row.service_id ?? row[2];
  const amount = Number(row.price ?? row[3]) || 500;
  const serviceStyle = row.service_style ?? row[4] ?? 'at_center';

  console.log(`Vendor: ${vendorName} (${vendorId})`);
  console.log(`Service: ${serviceId} ₹${amount} style=${serviceStyle}\n`);

  // 2) Create a test service promotion (codeless auto-apply)
  const promoName = `SmokeTest ${new Date().toISOString().slice(0, 19)}`;
  const start = new Date(Date.now() - 3600000).toISOString();
  const end = new Date(Date.now() + 7 * 86400000).toISOString();

  await executeSQL(`
    INSERT INTO vendor_service_promotions (
      vendor_id, name, description, code, promotion_type, discount_type, discount_value,
      min_booking_value, start_date, end_date, is_active, usage_count, target_audience,
      created_at, updated_at
    ) VALUES (
      '${vendorId}'::uuid,
      '${promoName.replace(/'/g, "''")}',
      'Automated smoke test promotion',
      NULL,
      'flash_sale',
      'percentage',
      10,
      NULL,
      '${start}',
      '${end}',
      true,
      0,
      'all',
      NOW(),
      NOW()
    )
  `);

  const created = await query(`
    SELECT id::text FROM vendor_service_promotions
    WHERE vendor_id = '${vendorId}'::uuid AND name = '${promoName.replace(/'/g, "''")}'
    ORDER BY created_at DESC LIMIT 1
  `);
  const promoId = created[0]?.id ?? created[0]?.[0];
  ok(promoId, `Created vendor service promo ${promoId}`);

  // 3) Customer profile offers
  const active = await fetchJson(`/vendors/${vendorId}/active-promotions?type=service`);
  ok(active.status === 200, `GET active-promotions status ${active.status}`);
  const promos = active.body?.promotions || active.body?.data || [];
  const found = Array.isArray(promos) && promos.some((p) => String(p.id) === String(promoId) || p.name === promoName);
  ok(found, 'Promo visible on vendor active-promotions (customer profile)');

  // 4) calculate-booking stack
  const calc = await fetchJson('/promotions/calculate-booking', {
    method: 'POST',
    body: JSON.stringify({
      vendorId,
      serviceIds: [serviceId],
      serviceStyle,
      amount,
    }),
  });
  ok(calc.status === 200 && calc.body?.success !== false, `POST calculate-booking status ${calc.status}`);
  const savings = Number(calc.body?.totalSavings ?? 0);
  ok(savings > 0, `Auto discount ₹${savings} (expected ~10% of ₹${amount})`);
  ok(
    calc.body?.vendorPromotionId || (calc.body?.applied || []).some((a) => a.source === 'vendor'),
    'Vendor promotion applied in calculate-booking'
  );

  // 5) applicable promos with vendorId
  const applicable = await fetchJson(
    `/promotions/applicable?vendorId=${vendorId}&amount=${amount}&serviceStyle=${serviceStyle}&category=vet`
  );
  ok(applicable.status === 200, `GET applicable status ${applicable.status}`);
  const list = applicable.body?.promotions || applicable.body?.data || [];
  ok(Array.isArray(list) && list.length > 0, 'Applicable promos include vendor/platform offers');

  // 6) Admin vendor promotions list (public read may require auth — report status)
  const admin = await fetchJson(
    `/admin/vendor-promotions?category=service&vendorId=${vendorId}`
  );
  if (admin.status === 200) {
    const all = admin.body?.promotions || admin.body?.data || [];
    const adminFound = Array.isArray(all) && all.some((p) => String(p.id) === String(promoId));
    ok(adminFound, 'Promo listed in admin vendor-promotions');
  } else {
    console.log(`  ⚠️  GET /admin/vendor-promotions returned ${admin.status} (auth may be required in UI)`);
  }

  // Cleanup test promo
  await executeSQL(`DELETE FROM vendor_service_promotions WHERE id = '${promoId}'::uuid`);
  console.log(`\n  🧹 Cleaned up test promo ${promoId}`);
  console.log('\n=== Smoke test PASSED ===');
}

main().catch((e) => {
  console.error('\n=== Smoke test FAILED ===');
  console.error(e.message || e);
  process.exit(1);
});
