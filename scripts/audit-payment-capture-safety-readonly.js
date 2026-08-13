#!/usr/bin/env node
/**
 * READ-ONLY payment-capture-safety audit against RDS.
 *
 *   ENVIRONMENT=prod node scripts/audit-payment-capture-safety-readonly.js
 *   ENVIRONMENT=dev  node scripts/audit-payment-capture-safety-readonly.js
 *
 * Sets default_transaction_read_only = on. SELECT only. No INSERT/UPDATE/DELETE.
 */
const { getPool, ENVIRONMENT } = require('./lib/rds-pool');

function preview(rows, n = 15) {
  return rows.slice(0, n);
}

async function main() {
  if (!['dev', 'prod'].includes(ENVIRONMENT)) {
    throw new Error(`Refusing: ENVIRONMENT must be dev or prod, got ${ENVIRONMENT}`);
  }
  console.log(JSON.stringify({ phase: 'start', environment: ENVIRONMENT, readOnly: true }));

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');

    const who = await client.query(
      `SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS host`
    );
    console.log(JSON.stringify({ section: 'connection', ...who.rows[0], environment: ENVIRONMENT }));

    const schema = await client.query(`
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
    console.log(JSON.stringify({ section: 'schema_indexes', ...schema.rows[0] }));

    const paymentCount = await client.query(`SELECT COUNT(*)::int AS n FROM payments`);
    console.log(JSON.stringify({ section: 'payments_total', ...paymentCount.rows[0] }));

    const dupBooking = await client.query(`
      SELECT p.booking_id::text,
             COUNT(*)::int AS n,
             json_agg(json_build_object(
               'id', p.id::text,
               'status', p.payment_status,
               'razorpay_order_id', p.razorpay_order_id,
               'razorpay_payment_id', p.razorpay_payment_id,
               'amount', p.amount,
               'created_at', p.created_at,
               'has_rzp_order', (p.razorpay_order_id IS NOT NULL AND BTRIM(p.razorpay_order_id) <> '')
             ) ORDER BY p.created_at DESC NULLS LAST, p.id DESC) AS attempts
      FROM payments p
      WHERE p.booking_id IS NOT NULL
        AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
      GROUP BY p.booking_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);
    console.log(JSON.stringify({
      section: 'A_dup_active_booking_attempts',
      count_groups: dupBooking.rowCount,
      rows: preview(dupBooking.rows),
    }));

    const keepVsHasOrder = await client.query(`
      WITH ranked AS (
        SELECT p.booking_id, p.id, p.razorpay_order_id, p.created_at,
               ROW_NUMBER() OVER (
                 PARTITION BY p.booking_id
                 ORDER BY p.created_at DESC NULLS LAST, p.id DESC
               ) AS rn
        FROM payments p
        WHERE p.booking_id IS NOT NULL
          AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
      ),
      grp AS (
        SELECT booking_id FROM ranked GROUP BY booking_id HAVING COUNT(*) > 1
      )
      SELECT COUNT(*)::int AS unsafe_keep_newest_without_order
      FROM ranked r
      JOIN grp g ON g.booking_id = r.booking_id
      WHERE r.rn = 1
        AND (r.razorpay_order_id IS NULL OR BTRIM(r.razorpay_order_id) = '')
        AND EXISTS (
          SELECT 1 FROM ranked o
          WHERE o.booking_id = r.booking_id
            AND o.rn > 1
            AND o.razorpay_order_id IS NOT NULL
            AND BTRIM(o.razorpay_order_id) <> ''
        )
    `);
    console.log(JSON.stringify({
      section: 'A_keep_newest_drops_live_rzp_order',
      ...keepVsHasOrder.rows[0],
    }));

    const dupShop = await client.query(`
      SELECT p.order_id::text,
             COUNT(*)::int AS n,
             json_agg(json_build_object(
               'id', p.id::text,
               'status', p.payment_status,
               'razorpay_order_id', p.razorpay_order_id,
               'razorpay_payment_id', p.razorpay_payment_id,
               'amount', p.amount,
               'created_at', p.created_at,
               'has_rzp_order', (p.razorpay_order_id IS NOT NULL AND BTRIM(p.razorpay_order_id) <> '')
             ) ORDER BY p.created_at DESC NULLS LAST, p.id DESC) AS attempts
      FROM payments p
      WHERE p.order_id IS NOT NULL
        AND p.booking_id IS NULL
        AND p.pharmacy_order_id IS NULL
        AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
      GROUP BY p.order_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);
    console.log(JSON.stringify({
      section: 'B_dup_active_shop_attempts',
      count_groups: dupShop.rowCount,
      rows: preview(dupShop.rows),
    }));

    const shopKeepUnsafe = await client.query(`
      WITH ranked AS (
        SELECT p.order_id, p.id, p.razorpay_order_id, p.created_at,
               ROW_NUMBER() OVER (
                 PARTITION BY p.order_id
                 ORDER BY p.created_at DESC NULLS LAST, p.id DESC
               ) AS rn
        FROM payments p
        WHERE p.order_id IS NOT NULL
          AND p.booking_id IS NULL
          AND p.pharmacy_order_id IS NULL
          AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
      ),
      grp AS (
        SELECT order_id FROM ranked GROUP BY order_id HAVING COUNT(*) > 1
      )
      SELECT COUNT(*)::int AS unsafe_keep_newest_without_order
      FROM ranked r
      JOIN grp g ON g.order_id = r.order_id
      WHERE r.rn = 1
        AND (r.razorpay_order_id IS NULL OR BTRIM(r.razorpay_order_id) = '')
        AND EXISTS (
          SELECT 1 FROM ranked o
          WHERE o.order_id = r.order_id
            AND o.rn > 1
            AND o.razorpay_order_id IS NOT NULL
            AND BTRIM(o.razorpay_order_id) <> ''
        )
    `);
    console.log(JSON.stringify({
      section: 'B_keep_newest_drops_live_rzp_order',
      ...shopKeepUnsafe.rows[0],
    }));

    const dupRzp = await client.query(`
      SELECT p.razorpay_order_id,
             COUNT(*)::int AS n,
             json_agg(json_build_object(
               'id', p.id::text,
               'status', p.payment_status,
               'booking_id', p.booking_id::text,
               'order_id', p.order_id::text,
               'pharmacy_order_id', p.pharmacy_order_id::text,
               'amount', p.amount,
               'created_at', p.created_at,
               'razorpay_payment_id', p.razorpay_payment_id
             ) ORDER BY
               CASE WHEN LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid') THEN 0 ELSE 1 END,
               p.created_at DESC NULLS LAST, p.id DESC
             ) AS rows
      FROM payments p
      WHERE p.razorpay_order_id IS NOT NULL
        AND BTRIM(p.razorpay_order_id) <> ''
      GROUP BY p.razorpay_order_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);
    console.log(JSON.stringify({
      section: 'C_dup_razorpay_order_id',
      count_groups: dupRzp.rowCount,
      rows: preview(dupRzp.rows),
    }));

    const dupRefunds = await client.query(`
      SELECT r.payment_id::text,
             COUNT(*)::int AS n,
             json_agg(json_build_object(
               'id', r.id::text,
               'status', r.refund_status,
               'amount', r.refund_amount,
               'razorpay_refund_id', r.razorpay_refund_id,
               'requested_at', r.requested_at
             ) ORDER BY r.requested_at DESC NULLS LAST, r.id DESC) AS refunds
      FROM refunds r
      WHERE r.payment_id IS NOT NULL
        AND LOWER(COALESCE(r.refund_status, '')) NOT IN ('failed', 'rejected')
      GROUP BY r.payment_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);
    console.log(JSON.stringify({
      section: 'D_dup_active_refunds',
      count_groups: dupRefunds.rowCount,
      rows: preview(dupRefunds.rows),
    }));

    const cancelledPaidBookings = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM bookings b
      WHERE LOWER(COALESCE(b.status,'')) = 'cancelled'
        AND LOWER(COALESCE(b.payment_status,'')) IN ('paid','completed')
    `);
    const cancelledPaidBookingSamples = await client.query(`
      SELECT b.id::text, b.status, b.payment_status, b.cancellation_reason,
             b.cancelled_at, b.total_amount, b.created_at, b.updated_at
      FROM bookings b
      WHERE LOWER(COALESCE(b.status,'')) = 'cancelled'
        AND LOWER(COALESCE(b.payment_status,'')) IN ('paid','completed')
      ORDER BY b.updated_at DESC NULLS LAST
      LIMIT 20
    `);
    console.log(JSON.stringify({
      section: 'anomaly_cancelled_paid_bookings',
      count: cancelledPaidBookings.rows[0].n,
      samples: cancelledPaidBookingSamples.rows,
    }));

    const cancelledPaidOrders = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM orders o
      WHERE LOWER(COALESCE(o.order_status,'')) = 'cancelled'
        AND LOWER(COALESCE(o.payment_status,'')) IN ('paid','completed')
        AND LOWER(COALESCE(o.order_type,'ecommerce')) IN ('ecommerce','shop','shop_order')
    `);
    const cancelledPaidOrderSamples = await client.query(`
      SELECT o.id::text, o.order_number, o.order_status, o.payment_status,
             o.cancellation_reason, o.total_amount, o.created_at, o.updated_at
      FROM orders o
      WHERE LOWER(COALESCE(o.order_status,'')) = 'cancelled'
        AND LOWER(COALESCE(o.payment_status,'')) IN ('paid','completed')
        AND LOWER(COALESCE(o.order_type,'ecommerce')) IN ('ecommerce','shop','shop_order')
      ORDER BY o.updated_at DESC NULLS LAST
      LIMIT 20
    `);
    console.log(JSON.stringify({
      section: 'anomaly_cancelled_paid_shop_orders',
      count: cancelledPaidOrders.rows[0].n,
      samples: cancelledPaidOrderSamples.rows,
    }));

    const multiCaptureBookings = await client.query(`
      SELECT p.booking_id::text,
             COUNT(*)::int AS n,
             json_agg(json_build_object(
               'id', p.id::text,
               'status', p.payment_status,
               'amount', p.amount,
               'razorpay_order_id', p.razorpay_order_id,
               'razorpay_payment_id', p.razorpay_payment_id,
               'created_at', p.created_at,
               'completed_at', p.completed_at
             ) ORDER BY p.created_at) AS captures
      FROM payments p
      WHERE p.booking_id IS NOT NULL
        AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid')
        AND p.razorpay_payment_id IS NOT NULL
      GROUP BY p.booking_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);
    console.log(JSON.stringify({
      section: 'anomaly_multi_capture_bookings',
      count_groups: multiCaptureBookings.rowCount,
      rows: preview(multiCaptureBookings.rows),
    }));

    const multiCaptureOrders = await client.query(`
      SELECT p.order_id::text,
             COUNT(*)::int AS n,
             json_agg(json_build_object(
               'id', p.id::text,
               'status', p.payment_status,
               'amount', p.amount,
               'razorpay_order_id', p.razorpay_order_id,
               'razorpay_payment_id', p.razorpay_payment_id,
               'created_at', p.created_at,
               'completed_at', p.completed_at
             ) ORDER BY p.created_at) AS captures
      FROM payments p
      WHERE p.order_id IS NOT NULL
        AND p.booking_id IS NULL
        AND p.pharmacy_order_id IS NULL
        AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid')
        AND p.razorpay_payment_id IS NOT NULL
      GROUP BY p.order_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);
    console.log(JSON.stringify({
      section: 'anomaly_multi_capture_shop_orders',
      count_groups: multiCaptureOrders.rowCount,
      rows: preview(multiCaptureOrders.rows),
    }));

    const capturedNoFulfillNoRefundBookings = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid')
        AND p.razorpay_payment_id IS NOT NULL
        AND LOWER(COALESCE(b.status,'')) = 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM refunds r
          WHERE r.payment_id = p.id
            AND LOWER(COALESCE(r.refund_status,'')) IN ('completed','processed','approved','pending','processing')
        )
    `);
    const capturedNoFulfillSamples = await client.query(`
      SELECT p.id::text AS payment_id, p.booking_id::text, p.amount,
             p.razorpay_order_id, p.razorpay_payment_id, p.payment_status,
             b.status AS booking_status, b.cancellation_reason, p.created_at, p.completed_at
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid')
        AND p.razorpay_payment_id IS NOT NULL
        AND LOWER(COALESCE(b.status,'')) = 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM refunds r
          WHERE r.payment_id = p.id
            AND LOWER(COALESCE(r.refund_status,'')) IN ('completed','processed','approved','pending','processing')
        )
      ORDER BY p.completed_at DESC NULLS LAST
      LIMIT 20
    `);
    console.log(JSON.stringify({
      section: 'anomaly_captured_cancelled_no_refund_bookings',
      count: capturedNoFulfillNoRefundBookings.rows[0].n,
      samples: capturedNoFulfillSamples.rows,
    }));

    const capturedNoFulfillOrders = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE p.booking_id IS NULL
        AND p.pharmacy_order_id IS NULL
        AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid')
        AND p.razorpay_payment_id IS NOT NULL
        AND LOWER(COALESCE(o.order_status,'')) = 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM refunds r
          WHERE r.payment_id = p.id
            AND LOWER(COALESCE(r.refund_status,'')) IN ('completed','processed','approved','pending','processing')
        )
    `);
    console.log(JSON.stringify({
      section: 'anomaly_captured_cancelled_no_refund_shop',
      count: capturedNoFulfillOrders.rows[0].n,
    }));

    const pharmacyPendingDups = await client.query(`
      SELECT COUNT(*)::int AS n FROM (
        SELECT pharmacy_order_id
        FROM payments
        WHERE pharmacy_order_id IS NOT NULL
          AND LOWER(COALESCE(payment_status,'')) IN ('pending','processing')
        GROUP BY pharmacy_order_id
        HAVING COUNT(*) > 1
      ) x
    `);
    console.log(JSON.stringify({
      section: 'pharmacy_dup_active_attempts',
      ...pharmacyPendingDups.rows[0],
    }));

    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
