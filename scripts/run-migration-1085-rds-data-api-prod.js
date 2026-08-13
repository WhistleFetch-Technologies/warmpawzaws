#!/usr/bin/env node
/**
 * Run migration 1085 on PROD via RDS Data API ExecuteStatement (statement-by-statement).
 *
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='prod'; node scripts/run-migration-1085-rds-data-api-prod.js
 */
const fs = require('fs');
const path = require('path');
const { splitPostgresStatements, executeSQL, query } = require('./rds-data-api-utils-dev');

const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  'db',
  'migrations',
  '1085_payment_attempt_safety.sql',
);

async function main() {
  if ((process.env.ENVIRONMENT || '').toLowerCase() !== 'prod') {
    console.error("Set ENVIRONMENT=prod before running this script.");
    process.exit(1);
  }

  const started = new Date().toISOString();
  console.log(`MIGRATION_START=${started}`);

  const before = await query(`
    SELECT
      (SELECT COUNT(*)::text FROM payments) AS payments_n,
      (SELECT COUNT(*)::text FROM bookings) AS bookings_n,
      (SELECT COUNT(*)::text FROM refunds) AS refunds_n,
      (SELECT COUNT(*)::text FROM payments
        WHERE LOWER(COALESCE(payment_status,'')) IN ('pending','processing')) AS active_payments_n,
      (SELECT COUNT(*)::text FROM payments
        WHERE LOWER(COALESCE(payment_status,'')) = 'failed'
          AND failure_reason = 'superseded_active_attempt') AS superseded_failed_n
  `);
  console.log('BEFORE', JSON.stringify(before));

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const stmts = splitPostgresStatements(sql);
  console.log(`\nMigration 1085 — ${stmts.length} statement(s) on PROD via RDS Data API\n`);

  for (let i = 0; i < stmts.length; i++) {
    const preview = stmts[i].slice(0, 160).replace(/\s+/g, ' ');
    console.log(`--- ${i + 1} / ${stmts.length} ---`);
    console.log(preview + (stmts[i].length > 160 ? '...' : ''));
    const result = await executeSQL(stmts[i], false);
    console.log(`OK (recordsUpdated=${result?.numberOfRecordsUpdated ?? 'n/a'})`);
  }

  console.log('\n=== Post-migration verification ===');
  const schema = await query(`
    SELECT
      (SELECT COUNT(*)::text FROM information_schema.tables
        WHERE table_schema='public' AND table_name='razorpay_webhook_events') AS webhook_table_exists,
      (SELECT COUNT(*)::text FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_payments_one_active_per_booking') AS idx_booking,
      (SELECT COUNT(*)::text FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_payments_one_active_per_shop_order') AS idx_shop,
      (SELECT COUNT(*)::text FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_payments_razorpay_order_id_unique') AS idx_rzp,
      (SELECT COUNT(*)::text FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_refunds_one_active_per_payment') AS idx_refund
  `);
  console.log('SCHEMA', JSON.stringify(schema));

  const after = await query(`
    SELECT
      (SELECT COUNT(*)::text FROM payments) AS payments_n,
      (SELECT COUNT(*)::text FROM bookings) AS bookings_n,
      (SELECT COUNT(*)::text FROM refunds) AS refunds_n,
      (SELECT COUNT(*)::text FROM payments
        WHERE LOWER(COALESCE(payment_status,'')) IN ('pending','processing')) AS active_payments_n,
      (SELECT COUNT(*)::text FROM payments
        WHERE LOWER(COALESCE(payment_status,'')) = 'failed'
          AND failure_reason = 'superseded_active_attempt') AS superseded_failed_n
  `);
  console.log('AFTER', JSON.stringify(after));

  const remainingDupBookings = await query(`
    SELECT COUNT(*)::text AS n FROM (
      SELECT booking_id FROM payments
      WHERE booking_id IS NOT NULL
        AND LOWER(COALESCE(payment_status,'')) IN ('pending','processing')
      GROUP BY booking_id HAVING COUNT(*) > 1
    ) x
  `);
  const remainingDupShop = await query(`
    SELECT COUNT(*)::text AS n FROM (
      SELECT order_id FROM payments
      WHERE order_id IS NOT NULL AND booking_id IS NULL AND pharmacy_order_id IS NULL
        AND LOWER(COALESCE(payment_status,'')) IN ('pending','processing')
      GROUP BY order_id HAVING COUNT(*) > 1
    ) x
  `);
  const remainingDupRzp = await query(`
    SELECT COUNT(*)::text AS n FROM (
      SELECT razorpay_order_id FROM payments
      WHERE razorpay_order_id IS NOT NULL AND BTRIM(razorpay_order_id) <> ''
      GROUP BY razorpay_order_id HAVING COUNT(*) > 1
    ) x
  `);
  const remainingDupRefunds = await query(`
    SELECT COUNT(*)::text AS n FROM (
      SELECT payment_id FROM refunds
      WHERE payment_id IS NOT NULL
        AND LOWER(COALESCE(refund_status,'')) IN ('pending','processing')
      GROUP BY payment_id HAVING COUNT(*) > 1
    ) x
  `);
  const cancelledPaid = await query(`
    SELECT COUNT(*)::text AS n FROM bookings
    WHERE LOWER(COALESCE(status,'')) = 'cancelled'
      AND LOWER(COALESCE(payment_status,'')) IN ('paid','completed')
  `);
  const completedRefundMulti = await query(`
    SELECT COUNT(*)::text AS n FROM (
      SELECT payment_id FROM refunds
      WHERE payment_id IS NOT NULL
        AND LOWER(COALESCE(refund_status,'')) IN ('completed','approved','processed','success')
      GROUP BY payment_id HAVING COUNT(*) > 1
    ) x
  `);

  console.log('REMAINING_DUP_ACTIVE_BOOKING', JSON.stringify(remainingDupBookings));
  console.log('REMAINING_DUP_ACTIVE_SHOP', JSON.stringify(remainingDupShop));
  console.log('REMAINING_DUP_RZP_ORDER', JSON.stringify(remainingDupRzp));
  console.log('REMAINING_DUP_ACTIVE_REFUND', JSON.stringify(remainingDupRefunds));
  console.log('HISTORICAL_CANCELLED_PAID_UNCHANGED', JSON.stringify(cancelledPaid));
  console.log('HISTORICAL_MULTI_COMPLETED_REFUNDS_UNCHANGED', JSON.stringify(completedRefundMulti));

  const ended = new Date().toISOString();
  console.log(`MIGRATION_END=${ended}`);
  console.log('\nMigration 1085 complete on PROD.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});
