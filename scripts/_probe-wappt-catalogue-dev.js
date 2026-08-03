#!/usr/bin/env node
/** Read-only RDS Data API probe: WAPPT catalogue vs live vendors on dev. */
const { query } = require('./rds-data-api-utils-dev');

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  console.log(`WAPPT catalogue audit (${env}):\n`);

  const orphans = await query(`
    SELECT c.vendor_id, c.publish_status
    FROM warmpawz_appointments_vendor_catalog c
    LEFT JOIN vendors v ON v.id = c.vendor_id
    WHERE v.id IS NULL OR v.is_deleted = true
    LIMIT 20
  `);
  console.log(`Orphan/deleted vendor catalogue rows: ${orphans.length}`);
  if (orphans.length) console.log(JSON.stringify(orphans, null, 2));

  const inactive = await query(`
    SELECT c.vendor_id,
           COALESCE(v.business_name, v.owner_name) AS name,
           v.status,
           c.publish_status
    FROM warmpawz_appointments_vendor_catalog c
    JOIN vendors v ON v.id = c.vendor_id
    WHERE c.publish_status = 'published'
      AND NOT (
        LOWER(v.status) IN ('approved', 'active')
        AND COALESCE(v.is_active, true) = true
        AND (v.is_deleted IS NOT TRUE)
      )
    LIMIT 20
  `);
  console.log(`\nPublished but vendor not approved/active: ${inactive.length}`);
  if (inactive.length) console.log(JSON.stringify(inactive, null, 2));

  const published = await query(`
    SELECT c.vendor_id,
           COALESCE(v.business_name, v.owner_name) AS name,
           v.city,
           v.address,
           c.appointment_fee,
           c.publish_status
    FROM warmpawz_appointments_vendor_catalog c
    JOIN vendors v ON v.id = c.vendor_id
    WHERE c.publish_status = 'published'
      AND LOWER(v.status) IN ('approved', 'active')
      AND COALESCE(v.is_active, true) = true
      AND (v.is_deleted IS NOT TRUE)
    ORDER BY name
    LIMIT 30
  `);
  console.log(`\nCustomer-visible published catalogue (${published.length} shown):`);
  for (const row of published) {
    const id = String(row.vendor_id || '').slice(0, 8);
    console.log(
      `  - ${row.name} (${id}…) fee=${row.appointment_fee} ${row.city || ''}`,
    );
  }
}

main().catch((e) => {
  console.error('Audit failed:', e.message);
  process.exit(1);
});
