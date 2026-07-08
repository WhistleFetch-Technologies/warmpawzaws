#!/usr/bin/env node
const { query } = require('./rds-data-api-utils-dev');
const BID = 'e8584dfb-3fd0-4c9b-abe0-275cd89cecbb';
const VID = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c';
const PID = '4414ddd5-bb70-408b-8951-971fa094f404';

async function main() {
  const vtsCols = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'vendor_tier_subscriptions' ORDER BY ordinal_position`);
  console.log('VTS_COLS', JSON.stringify(vtsCols));

  const vts = await query(`
    SELECT vts.*, vt.tier_name, vt.commission_rate, vt.display_name
    FROM vendor_tier_subscriptions vts
    JOIN vendor_tiers vt ON vt.id = vts.tier_id
    WHERE vts.vendor_id = '${VID}'::uuid
    ORDER BY vts.created_at DESC LIMIT 5`);
  console.log('VENDOR_TIER_SUBSCRIPTIONS', JSON.stringify(vts));

  const veCols = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'vendor_earnings' ORDER BY ordinal_position`);
  console.log('VE_COLS', JSON.stringify(veCols));

  const ve = await query(`
    SELECT * FROM vendor_earnings WHERE booking_id = '${BID}'::uuid`);
  console.log('VENDOR_EARNINGS_FULL', JSON.stringify(ve));

  const promoCols = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'promotions' ORDER BY ordinal_position`);
  console.log('PROMO_COLS', JSON.stringify(promoCols));

  const promo = await query(`SELECT * FROM promotions WHERE id = '${PID}'::uuid`);
  console.log('PROMOTION_FULL', JSON.stringify(promo));

  const settlements = await query(`
    SELECT * FROM settlements WHERE booking_id = '${BID}'::uuid LIMIT 5`);
  console.log('SETTLEMENTS', JSON.stringify(settlements));

  const tierMatch = await query(`
    SELECT vt.id, vt.tier_name, vt.commission_rate, v.tier AS vendor_tier_text
    FROM vendors v
    LEFT JOIN vendor_tiers vt ON vt.is_active = true
      AND TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name))
    WHERE v.id = '${VID}'::uuid`);
  console.log('TIER_MATCH', JSON.stringify(tierMatch));

  const defaultTier = await query(`
    SELECT id, tier_name, commission_rate, is_default FROM vendor_tiers
    WHERE is_active = true AND (is_default = true OR LOWER(tier_name) = 'bronze')
    ORDER BY is_default DESC LIMIT 1`);
  console.log('DEFAULT_TIER', JSON.stringify(defaultTier));

  const svc = await query(`
    SELECT vs.id, vs.service_name, vs.service_id, s.category
    FROM vendor_services vs
    LEFT JOIN services s ON s.id = vs.service_id
    WHERE vs.id = '5301c1b8-e603-4892-a101-49d8983c7f4f'::uuid`);
  console.log('SERVICE', JSON.stringify(svc));

  const vendorRole = await query(`
    SELECT id, role_id, category FROM vendors WHERE id = '${VID}'::uuid`);
  console.log('VENDOR_ROLE', JSON.stringify(vendorRole));
}

main().catch((e) => { console.error(e); process.exit(1); });
