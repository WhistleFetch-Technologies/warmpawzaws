#!/usr/bin/env node
const { query } = require('./rds-data-api-utils-dev');
const BID = 'e8584dfb-3fd0-4c9b-abe0-275cd89cecbb';
const VID = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c';

async function main() {
  const booking = await query(`
    SELECT id, status, payment_status, base_price, total_amount, discount_amount,
           promotion_id, coupon_code, notes, created_at, completed_at,
           vendor_id, customer_id, service_id
    FROM bookings WHERE id = '${BID}'::uuid`);
  console.log('BOOKING', JSON.stringify(booking));

  const vendor = await query(`
    SELECT id, business_name, tier, commission_percentage, commission_rate,
           commission_tier_id, current_tier_id, tier_subscription_id
    FROM vendors WHERE id = '${VID}'::uuid`);
  console.log('VENDOR', JSON.stringify(vendor));

  const vts = await query(`
    SELECT vts.id, vts.status, vts.expires_at, vts.tier_id, vts.created_at,
           vt.tier_name, vt.commission_rate, vt.display_name
    FROM vendor_tier_subscriptions vts
    JOIN vendor_tiers vt ON vt.id = vts.tier_id
    WHERE vts.vendor_id = '${VID}'::uuid
    ORDER BY vts.created_at DESC LIMIT 5`);
  console.log('VENDOR_TIER_SUBSCRIPTIONS', JSON.stringify(vts));

  const tierMatch = await query(`
    SELECT vt.id, vt.tier_name, vt.commission_rate
    FROM vendors v
    LEFT JOIN vendor_tiers vt ON vt.is_active = true
      AND TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name))
    WHERE v.id = '${VID}'::uuid`);
  console.log('TIER_NAME_MATCH', JSON.stringify(tierMatch));

  const defaultTier = await query(`
    SELECT id, tier_name, commission_rate, is_default FROM vendor_tiers
    WHERE is_active = true AND (is_default = true OR LOWER(tier_name) = 'bronze')
    ORDER BY is_default DESC LIMIT 1`);
  console.log('DEFAULT_TIER', JSON.stringify(defaultTier));
}

main().catch((e) => { console.error(e); process.exit(1); });
