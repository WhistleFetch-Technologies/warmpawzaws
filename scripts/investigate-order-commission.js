#!/usr/bin/env node
/**
 * Read-only investigation of ecommerce order commission state.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/investigate-order-commission.js --phone 9886729131
 *   ENVIRONMENT=dev node scripts/investigate-order-commission.js --order-id <uuid>
 *
 * Uses direct PostgreSQL when reachable; falls back to RDS Data API (no VPN required).
 */

const { getPool, ENVIRONMENT } = require('./lib/rds-pool');

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

async function investigateViaDataApi(phone, orderIdArg) {
  const { query } = require('./rds-data-api-utils-dev');
  let orderIds = [];
  if (orderIdArg) {
    orderIds = [orderIdArg];
  } else {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const orders = await query(`
      SELECT o.id::text
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.phone LIKE '%${digits}%'
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    orderIds = orders.map((r) => r.id).filter(Boolean);
    if (orderIds.length === 0) {
      const fallback = await query(`
        SELECT o.id::text
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE oi.name ILIKE '%whiskas%tuna%' AND o.subtotal = 310
        ORDER BY o.created_at DESC
        LIMIT 5
      `);
      orderIds = fallback.map((r) => r.id).filter(Boolean);
    }
  }

  if (orderIds.length === 0) {
    console.log('No orders found.');
    return;
  }

  for (const orderId of orderIds) {
    console.log('='.repeat(72));
    console.log('ORDER:', orderId);
    console.log('='.repeat(72));

    const header = await query(`
      SELECT o.id, o.order_number, o.vendor_id::text AS vendor_id, o.subtotal, o.commission_rate,
             o.commission_amount, o.vendor_payout_amount, o.commission_snapshot::text,
             o.order_status, o.payment_status, o.created_at::text,
             c.full_name AS customer_name, c.phone AS customer_phone
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = '${orderId}'::uuid
    `);
    console.log('\n--- Order header ---');
    console.log(JSON.stringify(header[0] ?? null, null, 2));

    const lines = await query(`
      SELECT oi.id::text AS order_item_id, oi.name, oi.total_price, oi.taxable_value,
             p.id::text AS product_id, p.listing_ownership,
             oic.commission_rate, oic.commission_source, oic.commission_amount,
             oic.listing_ownership AS audit_listing_ownership
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN order_item_commission oic ON oic.order_item_id = oi.id
      WHERE oi.order_id = '${orderId}'::uuid
      ORDER BY oi.created_at ASC
    `);
    console.log('\n--- Line items + commission audit ---');
    console.log(JSON.stringify(lines, null, 2));

    const vendorId = header[0]?.vendor_id;
    if (vendorId) {
      const cfg = await query(`
        SELECT commission_model, default_commission_rate,
               own_brand_commission_rate, third_party_commission_rate, updated_at::text
        FROM vendor_commission_config WHERE vendor_id = '${vendorId}'::uuid
      `);
      console.log('\n--- Vendor commission config (current) ---');
      console.log(JSON.stringify(cfg[0] ?? null, null, 2));
    }

    const ledger = await query(`
      SELECT id::text, status, commission_rate, commission_amount,
             vendor_payout_amount, platform_net_amount, created_at::text, updated_at::text
      FROM ecommerce_order_settlements WHERE order_id = '${orderId}'::uuid
    `);
    console.log('\n--- Settlement ledger ---');
    console.log(JSON.stringify(ledger[0] ?? null, null, 2));
    console.log('');
  }
}

async function investigateViaPg(phone, orderIdArg) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    console.log(`Environment: ${ENVIRONMENT}\n`);
    let orderIds = [];
    if (orderIdArg) {
      orderIds = [orderIdArg];
    } else {
      const ordersRes = await client.query(
        `SELECT o.id::text
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE c.phone LIKE $1
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [`%${phone.replace(/\D/g, '').slice(-10)}%`]
      );
      orderIds = ordersRes.rows.map((r) => r.id);
      if (orderIds.length === 0) {
        console.log('No orders found for phone:', phone);
        return;
      }
    }

    for (const orderId of orderIds) {
      console.log('='.repeat(72));
      console.log('ORDER:', orderId);
      console.log('='.repeat(72));

      const headerRes = await client.query(
        `SELECT o.id, o.order_number, o.vendor_id::text, o.subtotal, o.commission_rate,
                o.commission_amount, o.vendor_payout_amount, o.commission_snapshot,
                o.order_status, o.payment_status, o.created_at,
                c.full_name AS customer_name, c.phone AS customer_phone
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE o.id = $1::uuid`,
        [orderId]
      );
      const header = headerRes.rows[0];
      if (!header) {
        console.log('Order not found.\n');
        continue;
      }
      console.log('\n--- Order header ---');
      console.log(JSON.stringify(header, null, 2));

      const linesRes = await client.query(
        `SELECT oi.id::text AS order_item_id, oi.name, oi.total_price, oi.taxable_value,
                p.id::text AS product_id, p.listing_ownership,
                oic.commission_rate, oic.commission_source, oic.commission_amount,
                oic.listing_ownership AS audit_listing_ownership
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN order_item_commission oic ON oic.order_item_id = oi.id
         WHERE oi.order_id = $1::uuid
         ORDER BY oi.created_at ASC`,
        [orderId]
      );
      console.log('\n--- Line items + commission audit ---');
      console.log(JSON.stringify(linesRes.rows, null, 2));

      if (header.vendor_id) {
        const configRes = await client.query(
          `SELECT commission_model, default_commission_rate,
                  own_brand_commission_rate, third_party_commission_rate, updated_at
           FROM vendor_commission_config
           WHERE vendor_id = $1::uuid`,
          [header.vendor_id]
        );
        console.log('\n--- Vendor commission config (current) ---');
        console.log(JSON.stringify(configRes.rows[0] ?? null, null, 2));
      }

      const ledgerRes = await client.query(
        `SELECT id::text, status, commission_rate, commission_amount,
                vendor_payout_amount, platform_net_amount, created_at, updated_at
         FROM ecommerce_order_settlements
         WHERE order_id = $1::uuid`,
        [orderId]
      );
      console.log('\n--- Settlement ledger ---');
      console.log(JSON.stringify(ledgerRes.rows[0] ?? null, null, 2));
      console.log('');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const phone = parseArg('--phone');
  const orderIdArg = parseArg('--order-id');

  if (!phone && !orderIdArg) {
    console.error('Usage: node scripts/investigate-order-commission.js --phone <phone> | --order-id <uuid>');
    process.exit(1);
  }

  try {
    await investigateViaPg(phone, orderIdArg);
  } catch (err) {
    if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED') {
      console.warn('Direct PostgreSQL unreachable — using RDS Data API fallback.\n');
      await investigateViaDataApi(phone, orderIdArg);
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
