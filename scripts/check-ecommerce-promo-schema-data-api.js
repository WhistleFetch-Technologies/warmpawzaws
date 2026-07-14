#!/usr/bin/env node
/**
 * Read-only ecommerce promo / discount-engine schema inventory via RDS Data API.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/check-ecommerce-promo-schema-data-api.js
 *   ENVIRONMENT=prod node scripts/check-ecommerce-promo-schema-data-api.js
 */

const { query } = require('./rds-data-api-utils-dev');

const TABLES = [
  'vendor_promotions',
  'ecommerce_admin_promotions',
  'commercial_discount_campaigns',
  'commercial_campaign_promotion_links',
  'commercial_campaign_audit_log',
  'ecommerce_order_settlements',
  'ecommerce_settlement_batches',
  'discount_policy_draft',
  'discount_policy_versions',
  'discount_policy_audit',
  'vendor_commission_config',
  'order_item_commission',
];

async function existsTable(name) {
  const rows = await query(
    `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${name}'`,
  );
  return Number(rows[0]?.cnt ?? rows[0]?.[0] ?? 0) > 0;
}

async function existsColumn(table, column) {
  const rows = await query(
    `SELECT COUNT(*)::int AS cnt FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`,
  );
  return Number(rows[0]?.cnt ?? rows[0]?.[0] ?? 0) > 0;
}

async function main() {
  const env = process.env.ENVIRONMENT || 'dev';
  console.log(`\n=== Ecommerce promo schema check via Data API (${env}) ===\n`);

  const missingMigrations = [];

  console.log('Tables:');
  for (const t of TABLES) {
    const ok = await existsTable(t);
    console.log(`  ${ok ? 'OK  ' : 'MISS'} ${t}`);
  }

  const columns = [
    ['orders', 'promotion_source'],
    ['orders', 'vendor_promotion_amount'],
    ['orders', 'admin_promotion_amount'],
    ['orders', 'vendor_payout_amount'],
    ['promotions', 'discount_domain'],
    ['coupons', 'discount_domain'],
    ['commercial_discount_campaigns', 'discount_domain'],
    ['commercial_discount_campaigns', 'budget_cap'],
    ['vendor_earnings', 'metadata'],
  ];
  console.log('\nColumns:');
  for (const [table, column] of columns) {
    const ok = await existsColumn(table, column);
    console.log(`  ${ok ? 'OK  ' : 'MISS'} ${table}.${column}`);
  }

  if (!(await existsTable('commercial_discount_campaigns'))) {
    missingMigrations.push('1046_commercial_discount_campaigns.sql');
  }
  if (!(await existsColumn('orders', 'promotion_source'))) {
    missingMigrations.push('1055_order_promotion_columns.sql');
  }
  if (!(await existsTable('ecommerce_admin_promotions'))) {
    missingMigrations.push('1063_ecommerce_admin_promotions.sql');
  }
  if (!(await existsTable('ecommerce_order_settlements'))) {
    missingMigrations.push('1064_ecommerce_order_settlements.sql');
  }
  if (!(await existsColumn('vendor_earnings', 'metadata'))) {
    missingMigrations.push('1067_vendor_earnings_settlement_metadata.sql');
  }
  if (!(await existsTable('discount_policy_versions'))) {
    missingMigrations.push('1068_discount_policy_center_v2.sql');
  }
  if (!(await existsColumn('coupons', 'service_category'))) {
    missingMigrations.push('1069_coupons_service_targeting.sql');
  }
  if (
    !(await existsColumn('promotions', 'discount_domain')) ||
    !(await existsColumn('coupons', 'discount_domain'))
  ) {
    missingMigrations.push('1070_promotions_coupons_discount_domain.sql');
  }
  if (
    (await existsTable('commercial_discount_campaigns')) &&
    !(await existsColumn('commercial_discount_campaigns', 'discount_domain'))
  ) {
    missingMigrations.push('1071_commercial_campaigns_discount_domain_budget.sql');
  }

  console.log('\nInferred missing migrations:');
  if (missingMigrations.length === 0) {
    console.log('  (none)');
  } else {
    for (const m of missingMigrations) console.log(`  → ${m}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error('Check failed:', e.message || e);
  process.exit(1);
});
