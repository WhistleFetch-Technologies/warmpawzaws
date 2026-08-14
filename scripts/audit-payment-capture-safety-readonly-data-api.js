#!/usr/bin/env node
/**
 * READ-ONLY payment-capture-safety audit via RDS Data API.
 *
 *   ENVIRONMENT=prod node scripts/audit-payment-capture-safety-readonly-data-api.js
 *   ENVIRONMENT=dev  node scripts/audit-payment-capture-safety-readonly-data-api.js
 *
 * SELECT only. No INSERT/UPDATE/DELETE. Does not run migration 1085.
 */
const { query, getClusterInfo, ENVIRONMENT, CLUSTER_IDENTIFIER, DATABASE_NAME } = require('./rds-data-api-utils-dev');

function preview(rows, n = 15) {
  return rows.slice(0, n);
}

const QUERIES = {
  schema_indexes: `
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
  `,
  payments_total: `SELECT COUNT(*)::int AS n FROM payments`,
  A_dup_active_booking_attempts: `
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
           ) ORDER BY p.created_at DESC NULLS LAST, p.id DESC)::text AS attempts
    FROM payments p
    WHERE p.booking_id IS NOT NULL
      AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
    GROUP BY p.booking_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `,
  A_keep_newest_drops_live_rzp_order: `
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
  `,
  B_dup_active_shop_attempts: `
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
           ) ORDER BY p.created_at DESC NULLS LAST, p.id DESC)::text AS attempts
    FROM payments p
    WHERE p.order_id IS NOT NULL
      AND p.booking_id IS NULL
      AND p.pharmacy_order_id IS NULL
      AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
    GROUP BY p.order_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `,
  B_keep_newest_drops_live_rzp_order: `
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
  `,
  C_dup_razorpay_order_id: `
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
           )::text AS rows
    FROM payments p
    WHERE p.razorpay_order_id IS NOT NULL
      AND BTRIM(p.razorpay_order_id) <> ''
    GROUP BY p.razorpay_order_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `,
  D_dup_active_refunds: `
    SELECT r.payment_id::text,
           COUNT(*)::int AS n,
           json_agg(json_build_object(
             'id', r.id::text,
             'status', r.refund_status,
             'amount', r.refund_amount,
             'razorpay_refund_id', r.razorpay_refund_id,
             'requested_at', r.requested_at
           ) ORDER BY r.requested_at DESC NULLS LAST, r.id DESC)::text AS refunds
    FROM refunds r
    WHERE r.payment_id IS NOT NULL
      AND LOWER(COALESCE(r.refund_status, '')) NOT IN ('failed', 'rejected')
    GROUP BY r.payment_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `,
  anomaly_cancelled_paid_bookings_count: `
    SELECT COUNT(*)::int AS n
    FROM bookings b
    WHERE LOWER(COALESCE(b.status,'')) = 'cancelled'
      AND LOWER(COALESCE(b.payment_status,'')) IN ('paid','completed')
  `,
  anomaly_cancelled_paid_bookings_samples: `
    SELECT b.id::text, b.status, b.payment_status, b.cancellation_reason,
           b.cancelled_at::text, b.total_amount::text, b.created_at::text, b.updated_at::text
    FROM bookings b
    WHERE LOWER(COALESCE(b.status,'')) = 'cancelled'
      AND LOWER(COALESCE(b.payment_status,'')) IN ('paid','completed')
    ORDER BY b.updated_at DESC NULLS LAST
    LIMIT 20
  `,
  anomaly_cancelled_paid_shop_orders_count: `
    SELECT COUNT(*)::int AS n
    FROM orders o
    WHERE LOWER(COALESCE(o.order_status,'')) = 'cancelled'
      AND LOWER(COALESCE(o.payment_status,'')) IN ('paid','completed')
      AND LOWER(COALESCE(o.order_type,'ecommerce')) IN ('ecommerce','shop','shop_order')
  `,
  anomaly_cancelled_paid_shop_orders_samples: `
    SELECT o.id::text, o.order_number, o.order_status, o.payment_status,
           o.cancellation_reason, o.total_amount::text, o.created_at::text, o.updated_at::text
    FROM orders o
    WHERE LOWER(COALESCE(o.order_status,'')) = 'cancelled'
      AND LOWER(COALESCE(o.payment_status,'')) IN ('paid','completed')
      AND LOWER(COALESCE(o.order_type,'ecommerce')) IN ('ecommerce','shop','shop_order')
    ORDER BY o.updated_at DESC NULLS LAST
    LIMIT 20
  `,
  anomaly_multi_capture_bookings: `
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
           ) ORDER BY p.created_at)::text AS captures
    FROM payments p
    WHERE p.booking_id IS NOT NULL
      AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid')
      AND p.razorpay_payment_id IS NOT NULL
    GROUP BY p.booking_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `,
  anomaly_multi_capture_shop_orders: `
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
           ) ORDER BY p.created_at)::text AS captures
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
  `,
  anomaly_captured_cancelled_no_refund_bookings_count: `
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
  `,
  anomaly_captured_cancelled_no_refund_bookings_samples: `
    SELECT p.id::text AS payment_id, p.booking_id::text, p.amount::text,
           p.razorpay_order_id, p.razorpay_payment_id, p.payment_status,
           b.status AS booking_status, b.cancellation_reason,
           p.created_at::text, p.completed_at::text
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
  `,
  anomaly_captured_cancelled_no_refund_shop: `
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
  `,
  pharmacy_dup_active_attempts: `
    SELECT COUNT(*)::int AS n FROM (
      SELECT pharmacy_order_id
      FROM payments
      WHERE pharmacy_order_id IS NOT NULL
        AND LOWER(COALESCE(payment_status,'')) IN ('pending','processing')
      GROUP BY pharmacy_order_id
      HAVING COUNT(*) > 1
    ) x
  `,
};

async function main() {
  if (!['dev', 'prod'].includes(ENVIRONMENT)) {
    throw new Error(`Refusing: ENVIRONMENT must be dev or prod, got ${ENVIRONMENT}`);
  }
  const info = await getClusterInfo();
  console.log(JSON.stringify({
    phase: 'start',
    environment: ENVIRONMENT,
    cluster: CLUSTER_IDENTIFIER,
    database: DATABASE_NAME,
    clusterArn: info.clusterArn,
    httpEndpointEnabled: info.httpEndpointEnabled,
    readOnly: true,
    mutations: 'MUST BE ZERO',
  }));

  for (const [section, sql] of Object.entries(QUERIES)) {
    console.log(JSON.stringify({ section, sql: sql.trim() }));
    const rows = await query(sql.trim());
    const parsed = rows.map((row) => {
      const out = { ...row };
      for (const key of ['attempts', 'rows', 'refunds', 'captures']) {
        if (typeof out[key] === 'string') {
          try {
            out[key] = JSON.parse(out[key]);
          } catch {
            /* leave string */
          }
        }
      }
      return out;
    });
    console.log(JSON.stringify({
      section,
      count_groups: parsed.length,
      rows: preview(parsed),
    }));
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
