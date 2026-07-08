#!/usr/bin/env node
/**
 * Investigate booking settlement by partial UUID prefix.
 * Usage: ENVIRONMENT=dev|prod node scripts/_tmp-query-booking-settlement.js bad7f2e7
 */
const { query } = require('./rds-data-api-utils-dev');

const PREFIX = (process.argv[2] || 'bad7f2e7').replace(/'/g, "''");
const ENV = process.env.ENVIRONMENT || 'dev';

async function main() {
  console.log(`Environment: ${ENV}\nPrefix: ${PREFIX}\n`);

  const bookings = await query(`
    SELECT b.id, b.status, b.payment_status, b.total_amount, b.base_price, b.discount_amount,
           b.vendor_id, b.customer_id, b.service_id, b.notes,
           b.created_at, b.completed_at,
           vs.service_name, v.business_name AS vendor_name,
           c.full_name AS customer_name
    FROM bookings b
    LEFT JOIN vendor_services vs ON vs.id = b.service_id
    LEFT JOIN vendors v ON v.id = b.vendor_id
    LEFT JOIN customers c ON c.id = b.customer_id
    WHERE b.id::text LIKE '${PREFIX}%'
    ORDER BY b.created_at DESC
    LIMIT 5
  `);

  if (!bookings.length) {
    console.log('No bookings found.');
    return;
  }

  for (const row of bookings) {
    const cols = bookings.length && Array.isArray(bookings[0]) ? null : null;
    // query returns array of arrays from rds-data-api-utils
    const b = Object.fromEntries(
      [
        'id', 'status', 'payment_status', 'total_amount', 'base_price', 'discount_amount',
        'vendor_id', 'customer_id', 'service_id', 'notes', 'created_at', 'completed_at',
        'service_name', 'vendor_name', 'customer_name',
      ].map((k, i) => [k, row[i]])
    );

    const id = b.id;
    console.log('=== BOOKING ===');
    console.log(JSON.stringify(b, null, 2));

    const payments = await query(`
      SELECT id, amount, payment_status, payment_method, discount_amount, coupon_code,
             razorpay_order_id, razorpay_payment_id, wallet_amount_used, loyalty_points_used,
             created_at, completed_at
      FROM payments WHERE booking_id = '${id}'::uuid ORDER BY created_at DESC
    `);

    let earnings = [];
    try {
      earnings = await query(`
        SELECT id, vendor_id, booking_id, gross_amount, commission_rate, commission_amount,
               net_amount, status, settlement_id, metadata::text, realized_at, created_at
        FROM vendor_earnings WHERE booking_id = '${id}'::uuid ORDER BY created_at DESC
      `);
    } catch (e) {
      try {
        earnings = await query(`
          SELECT * FROM vendor_earnings WHERE booking_id = '${id}'::uuid ORDER BY created_at DESC
        `);
      } catch (e2) {
        earnings = [{ error: e2.message }];
      }
    }

    let settlements = [];
    try {
      settlements = await query(`
        SELECT id, vendor_id, booking_id, total_amount, commission_rate, commission_amount,
               net_amount, vendor_amount, settlement_status, status, metadata::text, created_at
        FROM settlements WHERE booking_id = '${id}'::uuid ORDER BY created_at DESC
      `);
    } catch (e) {
      settlements = [{ error: e.message }];
    }

    let walletTx = [];
    try {
      walletTx = await query(`
        SELECT id, transaction_type, amount, balance_after, description, reference_type, reference_id, created_at
        FROM vendor_wallet_transactions
        WHERE reference_id = '${id}' OR description ILIKE '%${PREFIX}%'
        ORDER BY created_at DESC LIMIT 10
      `);
    } catch (e) {
      walletTx = [{ error: e.message }];
    }

    console.log('\n=== PAYMENTS ===');
    console.log(JSON.stringify(payments, null, 2));
    console.log('\n=== VENDOR_EARNINGS ===');
    console.log(JSON.stringify(earnings, null, 2));
    console.log('\n=== SETTLEMENTS ===');
    console.log(JSON.stringify(settlements, null, 2));
    console.log('\n=== VENDOR_WALLET_TRANSACTIONS ===');
    console.log(JSON.stringify(walletTx, null, 2));

    const tier = await query(`
      SELECT v.id, v.business_name, vt.tier_name, vt.commission_rate
      FROM vendors v
      LEFT JOIN vendor_tiers vt ON vt.id = v.tier_id
      WHERE v.id = '${b.vendor_id}'::uuid
    `);
    console.log('\n=== VENDOR TIER ===');
    console.log(JSON.stringify(tier, null, 2));

    const promoFields = await query(`
      SELECT promotion_id, coupon_code, platform_fee, tax_amount, gst_amount
      FROM bookings WHERE id = '${id}'::uuid
    `).catch(() => []);
    console.log('\n=== BOOKING PROMO FIELDS ===');
    console.log(JSON.stringify(promoFields, null, 2));

    console.log('\n---\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
