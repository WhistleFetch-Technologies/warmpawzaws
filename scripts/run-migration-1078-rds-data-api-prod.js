#!/usr/bin/env node
/**
 * Run migration 1078 on PROD via RDS Data API ExecuteStatement (statement-by-statement).
 *
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='prod'; node scripts/run-migration-1078-rds-data-api-prod.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1078_decouple_meal_plans_from_products.sql'
);

async function main() {
  if ((process.env.ENVIRONMENT || '').toLowerCase() !== 'prod') {
    console.error("Set ENVIRONMENT=prod before running this script.");
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`Migration 1078 — ${stmts.length} statement(s) on PROD via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 140).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 140 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})`);
  }

  console.log('\n=== Post-migration verification ===');
  const summary = await query(`
    SELECT
      (SELECT COUNT(*)::text FROM meal_plans) AS meal_plans_total,
      (SELECT COUNT(*)::text FROM products
        WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
      ) AS meal_category_products,
      (SELECT COUNT(*)::text FROM meal_plans mp
        WHERE EXISTS (SELECT 1 FROM products p WHERE p.id = mp.id)
      ) AS meal_plans_with_product_twin
  `);
  console.log(summary);

  const veg = await query(`
    SELECT id::text, COALESCE(plan_name, name) AS name,
           price_per_meal::text AS price, is_active::text AS is_active
    FROM meal_plans
    WHERE id = '5b52297e-2f2b-4c3a-8448-7a5c91ed62ec'::uuid
  `);
  console.log('\nVeg Bowl meal_plans (must stay ₹10 / active):', veg);

  const chicken = await query(`
    SELECT id::text, COALESCE(plan_name, name) AS name,
           price_per_meal::text AS price, is_active::text AS is_active
    FROM meal_plans
    WHERE id = 'cb660631-f7f8-4735-9ce1-90c0654e15e4'::uuid
  `);
  console.log('Chicken Bowl Test now in meal_plans:', chicken);

  const orders = await query(`
    SELECT COUNT(*)::text AS meal_orders_total,
           COUNT(*) FILTER (
             WHERE EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = meal_orders.meal_plan_id)
           )::text AS still_have_meal_plan
    FROM meal_orders
  `);
  console.log('meal_orders integrity:', orders);

  console.log('\nMigration 1078 complete on PROD.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});
