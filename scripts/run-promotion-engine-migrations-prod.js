#!/usr/bin/env node
/**
 * Run promotion-engine migrations on prod (or dev) via RDS Data API, statement-by-statement.
 * Usage: ENVIRONMENT=prod node scripts/run-promotion-engine-migrations-prod.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';

const PROMOTION_MIGRATIONS = [
  '204_vendor_promotions_tables.sql',
  '1030_service_promotions_platform_alignment.sql',
  '1055_promotions_applicable_to.sql',
  '1055_order_promotion_columns.sql',
  '1056_promotions_max_uses_columns.sql',
  '1057_coupons_max_discount_amount.sql',
  '1046_commercial_discount_campaigns.sql',
  '1063_ecommerce_admin_promotions.sql',
  '1064_ecommerce_order_settlements.sql',
];

async function tableExists(name) {
  const rows = await query(
    `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${name}'`
  );
  const row = rows[0];
  const cnt = row?.cnt ?? row?.[0] ?? 0;
  return Number(cnt) > 0;
}

async function runMigrationFile(filename) {
  const filePath = path.join(__dirname, '..', 'db', 'migrations', filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`SKIP missing file: ${filename}`);
    return { file: filename, status: 'missing' };
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`\n=== ${filename} (${stmts.length} statements) ===`);
  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].replace(/\s+/g, ' ').slice(0, 72);
    console.log(`  [${i + 1}/${stmts.length}] ${preview}...`);
    await executeSQL(stmts[i], false);
  }
  return { file: filename, status: 'ok', statements: stmts.length };
}

async function main() {
  console.log(`Promotion engine migrations — ENVIRONMENT=${ENVIRONMENT}\n`);

  const before = {
    vendor_service_promotions: await tableExists('vendor_service_promotions'),
    commercial_discount_campaigns: await tableExists('commercial_discount_campaigns'),
    promotions_applicable_to: (
      await query(
        `SELECT COUNT(*)::int AS cnt FROM information_schema.columns
         WHERE table_schema='public' AND table_name='promotions' AND column_name='applicable_to'`
      )
    ),
  };
  console.log('Before:', JSON.stringify(before));

  const results = [];
  for (const file of PROMOTION_MIGRATIONS) {
    try {
      results.push(await runMigrationFile(file));
    } catch (err) {
      console.error(`FAILED ${file}:`, err.message || err);
      results.push({ file, status: 'failed', error: String(err.message || err) });
    }
  }

  const after = {
    vendor_service_promotions: await tableExists('vendor_service_promotions'),
    promotion_usages: await tableExists('promotion_usages'),
    commercial_discount_campaigns: await tableExists('commercial_discount_campaigns'),
    commercial_campaign_promotion_links: await tableExists('commercial_campaign_promotion_links'),
  };
  console.log('\nAfter:', JSON.stringify(after));
  console.log('\nSummary:', JSON.stringify(results, null, 2));

  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
