#!/usr/bin/env node
/**
 * Apply db/migrations/1085_payment_attempt_safety.sql to DEV RDS only (Data API).
 * Refuses any environment other than dev. Never run against prod.
 *
 *   ENVIRONMENT=dev node scripts/apply-migration-1085-dev-only.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query, ENVIRONMENT, CLUSTER_IDENTIFIER } = require('./rds-data-api-utils-dev');

async function main() {
  if (ENVIRONMENT !== 'dev') {
    throw new Error(`Refusing: this script may only run with ENVIRONMENT=dev (got ${ENVIRONMENT})`);
  }

  const file = path.join(__dirname, '..', 'db', 'migrations', '1085_payment_attempt_safety.sql');
  const sql = fs.readFileSync(file, 'utf8');
  const stmts = splitPostgresStatements(sql);

  const before = await query('SELECT COUNT(*)::int AS n FROM payments');
  const refundsBefore = await query('SELECT COUNT(*)::int AS n FROM refunds');
  const refundCols = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='refunds'
      AND column_name IN ('rejection_reason','refund_status','payment_id')
  `);
  const colNames = refundCols.map((r) => r.column_name);
  if (!colNames.includes('rejection_reason') || !colNames.includes('refund_status')) {
    throw new Error(`refunds table missing required columns: ${JSON.stringify(colNames)}`);
  }

  for (let i = 0; i < stmts.length; i++) {
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(stmts[i].slice(0, 160).replace(/\n/g, ' '));
    await executeSQL(stmts[i], false);
  }

  const after = await query('SELECT COUNT(*)::int AS n FROM payments');
  const refundsAfter = await query('SELECT COUNT(*)::int AS n FROM refunds');
  const schema = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema='public' AND table_name='razorpay_webhook_events') AS webhook_table_exists,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_payments_one_active_per_booking') AS idx_booking,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_payments_one_active_per_shop_order') AS idx_shop,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_payments_razorpay_order_id_unique') AS idx_rzp,
      (SELECT COUNT(*)::int FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_refunds_one_active_per_payment') AS idx_refund
  `);
  const remainingDups = await query(`
    SELECT COUNT(*)::int AS n FROM (
      SELECT booking_id FROM payments
      WHERE booking_id IS NOT NULL
        AND LOWER(COALESCE(payment_status,'')) IN ('pending','processing')
      GROUP BY booking_id HAVING COUNT(*) > 1
    ) x
  `);
  const failedSuperseded = await query(`
    SELECT COUNT(*)::int AS n FROM payments
    WHERE failure_reason = 'superseded_active_attempt'
  `);

  console.log(JSON.stringify({
    payments_after: after[0]?.n,
    refunds_after: refundsAfter[0]?.n,
    payments_deleted: (before[0]?.n || 0) - (after[0]?.n || 0),
    schema: schema[0],
    remaining_dup_booking_attempts: remainingDups[0]?.n,
    superseded_failed_rows: failedSuperseded[0]?.n,
  }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
