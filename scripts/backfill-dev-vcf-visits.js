/**
 * Dev-only: backfill V/C/F visit cells from completed paid bookings and captured Pay Bills.
 * Keyed by booking_id / payment id so a second run cannot double-count.
 *
 *   ENVIRONMENT=dev node scripts/backfill-dev-vcf-visits.js
 */
const { query, executeSQL, ENVIRONMENT } = require('./rds-data-api-utils-dev');

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function emptyCells() {
  return {
    tele: { count: 0, lastAt: null },
    appointment: { count: 0, lastAt: null },
    paybill: { count: 0, lastAt: null },
  };
}

function classify(style) {
  const t = String(style || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  if (['tele', 'video_consultation', 'video', 'online', 'online_consultation'].includes(t)) return 'tele';
  if (['appointment', 'at_center', 'at_clinic', 'at_home', 'home_visit', 'clinic', 'center'].includes(t)) {
    return 'appointment';
  }
  return null;
}

async function alreadyWritten(userId, referenceId) {
  const rows = await query(`
    SELECT id::text AS id
    FROM customer_behaviour_events
    WHERE user_id = '${esc(userId)}'
      AND event_type = 'VCF_VISIT'
      AND payload->>'referenceId' = '${esc(referenceId)}'
    LIMIT 1
  `);
  return rows.length > 0;
}

async function bump(userId, channel, vendorId, categoryId, roleId, referenceId, at) {
  if (await alreadyWritten(userId, referenceId)) return false;
  const existing = await query(`
    SELECT overall::text AS overall, services::text AS services
    FROM customer_behaviour_profiles
    WHERE user_id = '${esc(userId)}'
    LIMIT 1
  `);
  let services = {};
  let overall = {};
  if (existing.length) {
    try {
      services = JSON.parse(existing[0].services || '{}');
      overall = JSON.parse(existing[0].overall || '{}');
    } catch {
      services = {};
    }
  }
  const profile = services.vcf || { platform: emptyCells(), categories: {}, vendors: {} };
  profile.platform = profile.platform || emptyCells();
  profile.categories = profile.categories || {};
  profile.vendors = profile.vendors || {};
  const bumpCell = (cell) => ({ count: Number(cell?.count || 0) + 1, lastAt: at });
  profile.platform[channel] = bumpCell(profile.platform[channel]);
  if (categoryId) {
    profile.categories[categoryId] = { ...(profile.categories[categoryId] || emptyCells()) };
    profile.categories[categoryId][channel] = bumpCell(profile.categories[categoryId][channel]);
  }
  if (vendorId) {
    profile.vendors[vendorId] = {
      categoryId: categoryId || profile.vendors[vendorId]?.categoryId || '',
      roleId: roleId || profile.vendors[vendorId]?.roleId || '',
      ...(profile.vendors[vendorId] || emptyCells()),
    };
    profile.vendors[vendorId][channel] = bumpCell(profile.vendors[vendorId][channel]);
  }
  services.vcf = profile;
  const payload = JSON.stringify({
    referenceId,
    channel,
    vendorId: vendorId || null,
    categoryId: categoryId || null,
    roleId: roleId || null,
  }).replace(/'/g, "''");
  const servicesJson = JSON.stringify(services).replace(/'/g, "''");
  const overallJson = JSON.stringify(overall).replace(/'/g, "''");
  await executeSQL(`
    INSERT INTO customer_behaviour_events (user_id, event_type, service_key, payload)
    VALUES ('${esc(userId)}', 'VCF_VISIT', '${esc(channel)}', '${payload}'::jsonb)
  `);
  if (existing.length) {
    await executeSQL(`
      UPDATE customer_behaviour_profiles
      SET services = '${servicesJson}'::jsonb, overall = '${overallJson}'::jsonb, updated_at = NOW()
      WHERE user_id = '${esc(userId)}'
    `);
  } else {
    await executeSQL(`
      INSERT INTO customer_behaviour_profiles (user_id, overall, services)
      VALUES ('${esc(userId)}', '${overallJson}'::jsonb, '${servicesJson}'::jsonb)
    `);
  }
  return true;
}

async function main() {
  if (ENVIRONMENT !== 'dev') {
    console.error('Refusing to run unless ENVIRONMENT=dev');
    process.exit(1);
  }

  const bookings = await query(`
    SELECT b.id::text AS id,
           b.customer_id::text AS customer_id,
           b.vendor_id::text AS vendor_id,
           b.service_type,
           b.service_category,
           b.completed_at,
           v.role_id::text AS role_id
    FROM bookings b
    LEFT JOIN vendors v ON v.id = b.vendor_id
    WHERE b.status = 'completed'
      AND COALESCE(b.payment_status, '') IN ('', 'paid', 'completed', 'partially_paid', 'success')
    ORDER BY b.completed_at ASC NULLS LAST
    LIMIT 5000
  `);
  let wrote = 0;
  let skipped = 0;
  for (const row of bookings) {
    const channel = classify(row.service_type);
    if (!channel || !row.customer_id) {
      skipped += 1;
      continue;
    }
    const ok = await bump(
      row.customer_id,
      channel,
      row.vendor_id,
      null,
      row.role_id,
      row.id,
      row.completed_at || new Date().toISOString()
    );
    if (ok) wrote += 1;
    else skipped += 1;
  }

  const pays = await query(`
    SELECT p.id::text AS id,
           p.customer_id::text AS customer_id,
           p.vendor_id::text AS vendor_id,
           p.created_at,
           v.role_id::text AS role_id
    FROM payments p
    LEFT JOIN vendors v ON v.id = p.vendor_id
    WHERE p.payment_status = 'completed'
      AND COALESCE(p.payment_type, p.gateway, '') ILIKE '%wpay%'
    ORDER BY p.created_at ASC
    LIMIT 5000
  `).catch(() => []);
  for (const row of pays) {
    if (!row.customer_id) {
      skipped += 1;
      continue;
    }
    const ok = await bump(
      row.customer_id,
      'paybill',
      row.vendor_id,
      null,
      row.role_id,
      row.id,
      row.created_at || new Date().toISOString()
    );
    if (ok) wrote += 1;
    else skipped += 1;
  }

  console.log(JSON.stringify({ wrote, skipped, bookings: bookings.length, pays: pays.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
