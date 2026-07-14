#!/usr/bin/env node
/** Read-only investigation queries for booking e8584dfb — do not commit. */
const { query } = require('./rds-data-api-utils-dev');
const BID = 'e8584dfb-3fd0-4c9b-abe0-275cd89cecbb';
const VID = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c';
const PROMO = '4414ddd5-bb70-408b-8951-971fa094f404';

async function q(label, sql) {
  try {
    const rows = await query(sql);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  } catch (e) {
    console.log(`\n=== ${label} (ERROR) ===`);
    console.log(String(e.message || e));
    return [];
  }
}

async function main() {
  await q('BOOKING FULL', `
    SELECT id, status, payment_status, base_price, total_amount, discount_amount,
           promotion_id, coupon_code, platform_fee, tax_amount, gst_amount,
           notes, created_at, completed_at, vendor_id, customer_id, service_id
    FROM bookings WHERE id = '${BID}'::uuid`);

  await q('PAYMENTS', `
    SELECT id, amount, total_amount, payment_status, payment_method, discount_amount,
           razorpay_order_id, razorpay_payment_id, created_at, completed_at
    FROM payments WHERE booking_id = '${BID}'::uuid ORDER BY created_at`);

  await q('PROMOTION_USAGES', `
    SELECT * FROM promotion_usages WHERE booking_id = '${BID}'::uuid`);

  await q('COUPON_USAGES', `
    SELECT * FROM coupon_usages WHERE booking_id = '${BID}'::uuid`);

  await q('VET PROMOTION', `
    SELECT id, name, usage_count, usage_limit, max_uses, discount_type, discount_value,
           min_order_amount, published, is_active, created_at
    FROM promotions WHERE id = '${PROMO}'::uuid`);

  await q('VENDOR_EARNINGS', `
    SELECT id, vendor_id, booking_id, amount, commission_amount, total_amount,
           commission_rate, status, realized_at, metadata::text, created_at
    FROM vendor_earnings WHERE booking_id = '${BID}'::uuid`);

  await q('SETTLEMENTS', `
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'settlements' ORDER BY ordinal_position`);

  await q('SETTLEMENTS ROWS', `
    SELECT * FROM settlements WHERE booking_id = '${BID}'::uuid LIMIT 5`);

  await q('VENDOR CORE', `
    SELECT id, business_name, commission_percentage, pending_payout, total_earnings,
           subscription_tier, tier, role_id
    FROM vendors WHERE id = '${VID}'::uuid`);

  await q('VENDOR COLS', `
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'vendors' ORDER BY ordinal_position`);

  await q('VENDOR SUBSCRIPTIONS', `
    SELECT * FROM vendor_subscriptions WHERE vendor_id = '${VID}'::uuid
    ORDER BY created_at DESC LIMIT 5`);

  await q('VENDOR_TIERS TABLE', `
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'vendor_tiers' ORDER BY ordinal_position LIMIT 30`);

  await q('VENDOR TIER LINK', `
    SELECT vt.* FROM vendor_tiers vt LIMIT 5`);

  await q('COMMISSION POLICIES', `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%commission%' OR table_name ILIKE '%tier%'`);

  await q('VENDOR SERVICE', `
    SELECT id, price, custom_price, service_name FROM vendor_services
    WHERE id = '5301c1b8-e603-4892-a101-49d8983c7f4f'::uuid`);

  await q('PROMO USAGES BY PROMO', `
    SELECT COUNT(*) AS cnt FROM promotion_usages
    WHERE promotion_id = '${PROMO}'::uuid`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
