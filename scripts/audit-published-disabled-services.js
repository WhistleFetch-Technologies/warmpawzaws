#!/usr/bin/env node
/**
 * READ-ONLY audit: published vendor_services rows hidden from customer (is_enabled = false).
 *
 * Uses RDS Data API (no VPC/pg direct connect required).
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/audit-published-disabled-services.js
 *   ENVIRONMENT=prod node scripts/audit-published-disabled-services.js
 *
 * After migration 1087_sync_published_vendor_services_enabled.sql, published_disabled should be 0.
 */

const { query } = require('./rds-data-api-utils-dev');

const PUBLISHED_DISABLED_SQL = `
  SELECT COUNT(*)::bigint AS count
  FROM vendor_services
  WHERE publish_status IN ('published', 'auto_published')
    AND is_enabled = false
`;

const PUBLISHED_VISIBLE_SQL = `
  SELECT COUNT(*)::bigint AS count
  FROM vendor_services
  WHERE publish_status IN ('published', 'auto_published')
    AND is_enabled = true
`;

const TOP_VENDORS_SQL = `
  SELECT v.business_name, v.id::text AS vendor_id, COUNT(*)::bigint AS hidden_count
  FROM vendor_services vs
  JOIN vendors v ON v.id = vs.vendor_id
  WHERE vs.publish_status IN ('published', 'auto_published')
    AND vs.is_enabled = false
  GROUP BY v.id, v.business_name
  ORDER BY hidden_count DESC
  LIMIT 15
`;

async function main() {
  const env = (process.env.ENVIRONMENT || 'dev').toLowerCase();
  console.log(`\n📊 Published vs customer-visible vendor_services (${env}) via RDS Data API\n`);

  const disabledRows = await query(PUBLISHED_DISABLED_SQL);
  const visibleRows = await query(PUBLISHED_VISIBLE_SQL);
  const vendors = await query(TOP_VENDORS_SQL);

  const disabled = Number(disabledRows[0]?.count ?? 0);
  const visible = Number(visibleRows[0]?.count ?? 0);

  console.log(`Published + disabled (hidden from customer): ${disabled}`);
  console.log(`Published + enabled (customer-visible):       ${visible}`);

  if (vendors.length > 0) {
    console.log('\nTop vendors with published-but-disabled services:');
    for (const row of vendors) {
      console.log(`  - ${row.business_name || row.vendor_id}: ${row.hidden_count}`);
    }
  } else {
    console.log('\nNo published-but-disabled rows found.');
  }

  console.log('\nExpected after migration 1087: published_disabled = 0\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
