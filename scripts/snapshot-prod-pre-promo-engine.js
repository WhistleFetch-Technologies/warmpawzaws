/**
 * READ-ONLY snapshot of the prod config that the feature-guest-user build depends on,
 * taken before the promo-engine-v1 cutover so a rollback can be verified/restored.
 *
 *   $env:ENVIRONMENT='prod'; $env:AWS_PROFILE='cursor-agent'; node scripts/snapshot-prod-pre-promo-engine.js
 */
const fs = require('fs');
const path = require('path');
const { query } = require('./rds-data-api-utils-dev');

const TABLES = {
  admin_settings_wpay: `
    SELECT setting_category, setting_key, setting_value::text AS setting_value, is_active,
           created_at::text AS created_at, updated_at::text AS updated_at
    FROM admin_settings WHERE setting_category = 'wpay' ORDER BY setting_key`,
  warmpawz_pay_merchant_pricing: `
    SELECT id::text AS id, vendor_id::text AS vendor_id, catalogue_id::text AS catalogue_id,
           discount_type, discount_value::text AS discount_value, status,
           effective_from::text AS effective_from, effective_until::text AS effective_until,
           platform_withhold_percent::text AS platform_withhold_percent, tier_id::text AS tier_id,
           updated_at::text AS updated_at
    FROM warmpawz_pay_merchant_pricing ORDER BY vendor_id`,
  warmpawz_appointments_vendor_catalog_fees: `
    SELECT id::text AS id, vendor_id::text AS vendor_id, appointment_fee::text AS appointment_fee,
           updated_at::text AS updated_at
    FROM warmpawz_appointments_vendor_catalog ORDER BY vendor_id`,
  service_categories_vendor_roles: `
    SELECT id::text AS id, category_id, name, vendor_roles::text AS vendor_roles, is_active, display_order
    FROM service_categories ORDER BY display_order NULLS LAST, id`,
};

async function main() {
  if (process.env.ENVIRONMENT !== 'prod') throw new Error('Set ENVIRONMENT=prod');
  const takenAt = new Date().toISOString();
  const out = { takenAt, environment: 'prod', tables: {} };
  for (const [name, sql] of Object.entries(TABLES)) {
    out.tables[name] = await query(sql);
  }
  const dir = path.join(__dirname, '..', 'prodscripts', 'snapshots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `pre-promo-engine-${takenAt.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  const counts = Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, v.length]));
  console.log(JSON.stringify({ file, counts }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
