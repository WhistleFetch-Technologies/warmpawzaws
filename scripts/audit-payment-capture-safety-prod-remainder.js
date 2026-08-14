#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { query, getClusterInfo } = require('./rds-data-api-utils-dev');

const SECTIONS = {
  B: `SELECT p.order_id::text, COUNT(*)::int AS n,
      json_agg(json_build_object('id', p.id::text, 'status', p.payment_status, 'razorpay_order_id', p.razorpay_order_id, 'amount', p.amount, 'created_at', p.created_at) ORDER BY p.created_at DESC)::text AS attempts
      FROM payments p WHERE p.order_id IS NOT NULL AND p.booking_id IS NULL AND p.pharmacy_order_id IS NULL
      AND LOWER(COALESCE(p.payment_status,'')) IN ('pending','processing')
      GROUP BY p.order_id HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC LIMIT 50`,
  B_unsafe: `WITH ranked AS (SELECT p.order_id, p.id, p.razorpay_order_id, ROW_NUMBER() OVER (PARTITION BY p.order_id ORDER BY p.created_at DESC NULLS LAST, p.id DESC) rn FROM payments p WHERE p.order_id IS NOT NULL AND p.booking_id IS NULL AND p.pharmacy_order_id IS NULL AND LOWER(COALESCE(p.payment_status,'')) IN ('pending','processing')), grp AS (SELECT order_id FROM ranked GROUP BY order_id HAVING COUNT(*)>1) SELECT COUNT(*)::int AS n FROM ranked r JOIN grp g ON g.order_id=r.order_id WHERE r.rn=1 AND (r.razorpay_order_id IS NULL OR BTRIM(r.razorpay_order_id)='') AND EXISTS (SELECT 1 FROM ranked o WHERE o.order_id=r.order_id AND o.rn>1 AND o.razorpay_order_id IS NOT NULL AND BTRIM(o.razorpay_order_id)<>'')`,
  C: `SELECT p.razorpay_order_id, COUNT(*)::int AS n, json_agg(json_build_object('id', p.id::text, 'status', p.payment_status, 'booking_id', p.booking_id::text, 'order_id', p.order_id::text, 'amount', p.amount, 'created_at', p.created_at, 'razorpay_payment_id', p.razorpay_payment_id) ORDER BY p.created_at)::text AS rows FROM payments p WHERE p.razorpay_order_id IS NOT NULL AND BTRIM(p.razorpay_order_id)<>'' GROUP BY p.razorpay_order_id HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC LIMIT 50`,
  D: `SELECT r.payment_id::text, COUNT(*)::int AS n, json_agg(json_build_object('id', r.id::text, 'status', r.refund_status, 'amount', r.refund_amount, 'razorpay_refund_id', r.razorpay_refund_id) ORDER BY r.requested_at DESC)::text AS refunds FROM refunds r WHERE r.payment_id IS NOT NULL AND LOWER(COALESCE(r.refund_status,'')) NOT IN ('failed','rejected') GROUP BY r.payment_id HAVING COUNT(*)>1 LIMIT 50`,
  cancelled_paid_bk: `SELECT COUNT(*)::int AS n FROM bookings b WHERE LOWER(COALESCE(b.status,''))='cancelled' AND LOWER(COALESCE(b.payment_status,'')) IN ('paid','completed')`,
  cancelled_paid_shop: `SELECT COUNT(*)::int AS n FROM orders o WHERE LOWER(COALESCE(o.order_status,''))='cancelled' AND LOWER(COALESCE(o.payment_status,'')) IN ('paid','completed') AND LOWER(COALESCE(o.order_type,'ecommerce')) IN ('ecommerce','shop','shop_order')`,
  multi_cap_bk: `SELECT p.booking_id::text, COUNT(*)::int AS n, json_agg(json_build_object('id', p.id::text, 'status', p.payment_status, 'amount', p.amount, 'razorpay_order_id', p.razorpay_order_id, 'razorpay_payment_id', p.razorpay_payment_id, 'created_at', p.created_at) ORDER BY p.created_at)::text AS captures FROM payments p WHERE p.booking_id IS NOT NULL AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid') AND p.razorpay_payment_id IS NOT NULL GROUP BY p.booking_id HAVING COUNT(*)>1 LIMIT 50`,
  multi_cap_shop: `SELECT p.order_id::text, COUNT(*)::int AS n FROM payments p WHERE p.order_id IS NOT NULL AND p.booking_id IS NULL AND p.pharmacy_order_id IS NULL AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid') AND p.razorpay_payment_id IS NOT NULL GROUP BY p.order_id HAVING COUNT(*)>1 LIMIT 50`,
  shop_no_refund: `SELECT COUNT(*)::int AS n FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.booking_id IS NULL AND p.pharmacy_order_id IS NULL AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid') AND p.razorpay_payment_id IS NOT NULL AND LOWER(COALESCE(o.order_status,''))='cancelled' AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.payment_id=p.id AND LOWER(COALESCE(r.refund_status,'')) IN ('completed','processed','approved','pending','processing'))`,
  shop_no_refund_samples: `SELECT p.id::text AS payment_id, p.order_id::text, p.amount::text, p.razorpay_order_id, p.razorpay_payment_id, o.order_status, o.order_number FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.booking_id IS NULL AND p.pharmacy_order_id IS NULL AND LOWER(COALESCE(p.payment_status,'')) IN ('completed','paid') AND p.razorpay_payment_id IS NOT NULL AND LOWER(COALESCE(o.order_status,''))='cancelled' AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.payment_id=p.id AND LOWER(COALESCE(r.refund_status,'')) IN ('completed','processed','approved','pending','processing')) LIMIT 10`,
};

async function main() {
  await getClusterInfo();
  const out = {};
  for (const [k, sql] of Object.entries(SECTIONS)) {
    const rows = await query(sql);
    out[k] = rows.map((r) => {
      const o = { ...r };
      for (const key of ['attempts', 'rows', 'refunds', 'captures']) {
        if (typeof o[key] === 'string') {
          try {
            o[key] = JSON.parse(o[key]);
          } catch {
            /* leave */
          }
        }
      }
      return o;
    });
    console.log(JSON.stringify({ section: k, n: out[k].length, rows: out[k] }));
  }
  const dest = path.join(__dirname, '.audit-prod-payment-safety.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ wrote: dest }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
