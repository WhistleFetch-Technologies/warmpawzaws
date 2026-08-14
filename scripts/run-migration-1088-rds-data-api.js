/**
 * Run migration 1088 on the environment in ENVIRONMENT (prod|dev) via RDS Data API.
 * Usage (PowerShell): $env:ENVIRONMENT='dev'; node scripts/run-migration-1088-rds-data-api.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

async function main() {
  const env = (process.env.ENVIRONMENT || '').toLowerCase();
  if (env !== 'prod' && env !== 'dev') {
    console.error("Set ENVIRONMENT=prod (or dev) before running this script.");
    process.exit(1);
  }

  const migrationFile = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '1088_product_category_links_and_rules.sql'
  );
  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`MIGRATION_START=${new Date().toISOString()}`);
  console.log(`Environment: ${env}`);
  console.log(`Migration 1088 — ${stmts.length} statement(s) via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})\n`);
  }

  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('product_category_links', 'ecommerce_category_rules')
    ORDER BY table_name
  `);
  console.log('VERIFY_TABLES', JSON.stringify(tables));
  if (!tables || tables.length < 2) {
    throw new Error('Expected product_category_links and ecommerce_category_rules after migration');
  }

  const rules = await query(`
    SELECT c.name AS subcategory, cardinality(r.include_keywords) AS include_count
    FROM ecommerce_category_rules r
    INNER JOIN ecommerce_categories c ON c.id = r.subcategory_id
    ORDER BY c.name
  `);
  console.log('VERIFY_RULES', JSON.stringify(rules, null, 2));

  const linkCount = await query(`
    SELECT COUNT(*)::int AS cnt FROM product_category_links
  `);
  console.log('VERIFY_LINK_COUNT', JSON.stringify(linkCount));

  const parentNorm = await query(`
    SELECT
      COUNT(*) FILTER (
        WHERE p.category_id IN (
          SELECT id FROM ecommerce_categories WHERE parent_category_id = pf.id
        )
      )::int AS still_on_child,
      COUNT(*) FILTER (WHERE p.category_id = pf.id)::int AS on_parent
    FROM products p
    CROSS JOIN LATERAL (
      SELECT id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1
    ) pf
  `);
  console.log('VERIFY_PET_FOOD_NORMALIZE', JSON.stringify(parentNorm));

  console.log('Migration 1088 complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
