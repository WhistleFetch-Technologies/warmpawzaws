#!/usr/bin/env node
/**
 * Re-resolve order commission via RDS Data API (no direct PostgreSQL / VPN).
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/re-resolve-order-commission-data-api.js --phone 9886729131 --dry-run
 *   ENVIRONMENT=dev node scripts/re-resolve-order-commission-data-api.js --order-id <uuid>
 */
const { query } = require('./rds-data-api-utils-dev');

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function normalizeRate(raw) {
  const n = parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? n : null;
}

async function sqlOne(sql) {
  const rows = await query(sql);
  return rows[0] ?? null;
}

async function resolveProductCommission(vendorId, productId, categoryId) {
  const config = await sqlOne(`
    SELECT commission_model, default_commission_rate,
           own_brand_commission_rate, third_party_commission_rate
    FROM vendor_commission_config WHERE vendor_id = '${vendorId}'::uuid LIMIT 1
  `);

  if (config?.commission_model === 'ownership' && productId) {
    const prod = await sqlOne(
      `SELECT listing_ownership FROM products WHERE id = '${productId}'::uuid LIMIT 1`
    );
    const ownership = prod?.listing_ownership;
    if (ownership === 'own_brand') {
      const rate = normalizeRate(config.own_brand_commission_rate);
      if (rate != null) return { rate, source: 'vendor_own_brand', listingOwnership: ownership };
    } else if (ownership === 'third_party') {
      const rate = normalizeRate(config.third_party_commission_rate);
      if (rate != null) return { rate, source: 'vendor_third_party', listingOwnership: ownership };
    }
  }

  if (config?.commission_model === 'category' && categoryId) {
    const cat = await sqlOne(`
      SELECT commission_rate FROM vendor_category_commission_rates
      WHERE vendor_id = '${vendorId}'::uuid AND category_id = '${categoryId}'::uuid AND is_active = true LIMIT 1
    `);
    const rate = normalizeRate(cat?.commission_rate);
    if (rate != null) return { rate, source: 'vendor_category', listingOwnership: null };
  }

  const vendorDefault = normalizeRate(config?.default_commission_rate);
  if (vendorDefault != null) return { rate: vendorDefault, source: 'vendor_default', listingOwnership: null };

  if (categoryId) {
    const catDef = await sqlOne(
      `SELECT default_commission_rate FROM ecommerce_categories WHERE id = '${categoryId}'::uuid LIMIT 1`
    );
    const rate = normalizeRate(catDef?.default_commission_rate);
    if (rate != null) return { rate, source: 'category_default', listingOwnership: null };
  }

  const platform = await sqlOne(
    `SELECT default_rate FROM ecommerce_commission_settings WHERE setting_key = 'default' LIMIT 1`
  );
  const platformRate = normalizeRate(platform?.default_rate);
  if (platformRate != null) return { rate: platformRate, source: 'platform_default', listingOwnership: null };

  throw new Error('Commission rate could not be resolved');
}

async function resolveOrderId(phone, orderIdArg) {
  if (orderIdArg) return orderIdArg;
  const digits = phone.replace(/\D/g, '').slice(-10);
  const row = await sqlOne(`
    SELECT o.id::text AS id FROM orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE c.phone LIKE '%${digits}%'
    ORDER BY o.created_at DESC LIMIT 1
  `);
  if (row?.id) return row.id;
  const fallback = await sqlOne(`
    SELECT o.id::text AS id FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.name ILIKE '%whiskas%tuna%' AND o.subtotal = 310
    ORDER BY o.created_at DESC LIMIT 1
  `);
  if (!fallback?.id) throw new Error(`No order found for phone ${phone}`);
  return fallback.id;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const phone = parseArg('--phone');
  const orderIdArg = parseArg('--order-id');

  const orderId = await resolveOrderId(phone || '', orderIdArg);
  const order = await sqlOne(`
    SELECT id::text, vendor_id::text, subtotal, vendor_promotion_amount, commission_rate,
           commission_amount, vendor_payout_amount, commission_snapshot::text
    FROM orders WHERE id = '${orderId}'::uuid
  `);
  if (!order?.vendor_id) throw new Error(`Order ${orderId} not found`);

  const lines = await query(`
    SELECT oi.id::text AS order_item_id, oi.product_id::text AS product_id,
           p.category_id::text AS category_id,
           COALESCE(oi.taxable_value, oi.total_price) AS line_subtotal
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = '${orderId}'::uuid
    ORDER BY oi.created_at ASC
  `);

  let totalCommission = 0;
  let orderSubtotal = 0;
  const lineBreakdown = [];
  for (const line of lines) {
    const subtotal = roundMoney(line.line_subtotal);
    if (subtotal <= 0) continue;
    orderSubtotal += subtotal;
    const resolved = await resolveProductCommission(
      order.vendor_id,
      line.product_id,
      line.category_id
    );
    const lineCommission = roundMoney((subtotal * resolved.rate) / 100);
    totalCommission += lineCommission;
    lineBreakdown.push({
      productId: line.product_id,
      categoryId: line.category_id,
      rate: resolved.rate,
      commission: lineCommission,
      source: resolved.source,
      listingOwnership: resolved.listingOwnership,
    });
  }

  const snap = {
    effectiveRate: orderSubtotal > 0 ? roundMoney((totalCommission / orderSubtotal) * 100) : 0,
    commissionAmount: roundMoney(totalCommission),
    orderSubtotal: roundMoney(orderSubtotal),
    lineBreakdown,
    resolvedAt: new Date().toISOString(),
  };

  const vendorPromo = Number(order.vendor_promotion_amount) || 0;
  const subtotal = Number(order.subtotal) || 0;
  const vendorPayout = Math.max(0, roundMoney(subtotal - vendorPromo - snap.commissionAmount));

  console.log('Order:', orderId);
  console.log('Vendor:', order.vendor_id);
  console.log('\n--- Before ---');
  console.log(
    JSON.stringify(
      {
        commission_rate: order.commission_rate,
        commission_amount: order.commission_amount,
        vendor_payout_amount: order.vendor_payout_amount,
        commission_snapshot: order.commission_snapshot,
      },
      null,
      2
    )
  );
  console.log('\n--- After (preview) ---');
  console.log(JSON.stringify(snap, null, 2));
  console.log('vendor_payout_amount:', vendorPayout);

  if (dryRun) {
    console.log('\nDry-run complete. Re-run without --dry-run to apply.');
    return;
  }

  const snapJson = JSON.stringify(snap).replace(/'/g, "''");
  await query(`
    UPDATE orders SET
      commission_rate = ${snap.effectiveRate},
      commission_amount = ${snap.commissionAmount},
      vendor_payout_amount = ${vendorPayout},
      commission_snapshot = '${snapJson}'::jsonb,
      updated_at = NOW()
    WHERE id = '${orderId}'::uuid
  `);

  for (let i = 0; i < lineBreakdown.length; i++) {
    const line = lineBreakdown[i];
    const orderItemId = lines[i]?.order_item_id;
    if (!orderItemId) continue;
    await query(`
      INSERT INTO order_item_commission (
        order_item_id, product_id, commission_rate, commission_amount,
        commission_source, listing_ownership, resolved_at
      ) VALUES (
        '${orderItemId}'::uuid,
        ${line.productId ? `'${line.productId}'::uuid` : 'NULL'},
        ${line.rate}, ${line.commission}, '${line.source}',
        ${line.listingOwnership ? `'${line.listingOwnership}'` : 'NULL'},
        NOW()
      )
      ON CONFLICT (order_item_id) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        commission_rate = EXCLUDED.commission_rate,
        commission_amount = EXCLUDED.commission_amount,
        commission_source = EXCLUDED.commission_source,
        listing_ownership = EXCLUDED.listing_ownership,
        resolved_at = NOW()
    `);
  }

  const ledger = await sqlOne(`
    SELECT id::text, status FROM ecommerce_order_settlements WHERE order_id = '${orderId}'::uuid
  `);
  if (ledger?.id) {
    if (ledger.status !== 'pending_batch' && !force) {
      console.log('\nSettlement ledger sync skipped:', `ledger_status_${ledger.status}`);
    } else {
      const promotionSource = await sqlOne(
        `SELECT promotion_source, vendor_promotion_amount, admin_promotion_amount, subtotal
         FROM orders WHERE id = '${orderId}'::uuid`
      );
      const promo = promotionSource?.promotion_source;
      const discount =
        promo === 'vendor'
          ? Number(promotionSource.vendor_promotion_amount) || 0
          : promo === 'admin'
            ? Number(promotionSource.admin_promotion_amount) || 0
            : 0;
      const merchandise = Number(promotionSource.subtotal) || 0;
      const customerPayable = Math.max(0, merchandise - discount);
      let vendorPayoutLedger = Math.max(0, merchandise - snap.commissionAmount);
      let platformNet = snap.commissionAmount;
      if (promo === 'vendor') {
        vendorPayoutLedger = Math.max(0, customerPayable - snap.commissionAmount);
        platformNet = snap.commissionAmount;
      } else if (promo === 'admin') {
        platformNet = snap.commissionAmount - discount;
      }
      await query(`
        UPDATE ecommerce_order_settlements SET
          commission_rate = ${snap.effectiveRate},
          commission_amount = ${snap.commissionAmount},
          vendor_payout_amount = ${roundMoney(vendorPayoutLedger)},
          platform_net_amount = ${roundMoney(platformNet)},
          updated_at = NOW()
        WHERE order_id = '${orderId}'::uuid
      `);
      console.log('\nSettlement ledger updated.');
    }
  }

  console.log('\nCommission re-resolve applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
