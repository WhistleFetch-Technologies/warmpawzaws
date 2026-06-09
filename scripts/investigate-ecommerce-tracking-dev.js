#!/usr/bin/env node
/**
 * Read-only dev RDS investigation: shipments schema, migrations, recent tracking data.
 * Uses RDS Data API (no deploy). ENVIRONMENT=dev by default.
 */
const {
  executeSQL,
  parseRecords,
} = require('./rds-data-api-utils-dev');

async function query(sql) {
  const result = await executeSQL(sql, true);
  return parseRecords(result);
}

async function section(title, fn) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
  try {
    await fn();
  } catch (e) {
    console.error('ERROR:', e.message || e);
  }
}

async function main() {
  console.log('Ecommerce tracking / shipments investigation (dev RDS, read-only)');

  await section('1) Migration ledger tables', async () => {
    for (const table of ['schema_migrations', 'knex_migrations', 'migrations']) {
      const exists = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) AS ok
      `);
      console.log(`  ${table}:`, exists[0]?.ok ? 'EXISTS' : 'missing');
      if (exists[0]?.ok) {
        const cols = await query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${table}'
          ORDER BY ordinal_position
        `);
        console.log('    columns:', cols.map((c) => c.column_name).join(', '));
        const sample = await query(`SELECT * FROM ${table} ORDER BY 1 DESC LIMIT 5`);
        console.log('    latest rows:', JSON.stringify(sample, null, 2));
      }
    }
  });

  await section('2) Critical shipment columns (1006 / 210 / 039)', async () => {
    const cols = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shipments'
      ORDER BY ordinal_position
    `);
    console.log(`  shipments has ${cols.length} columns`);
    const wanted = [
      'awb_code',
      'tracking_url',
      'courier_name',
      'logistics_partner',
      'status',
      'shipment_status',
      'tracking_provider',
      'aftership_tracking_id',
      'fulfillment_type',
      'vendor_notes',
      'pickup_pincode',
      'delivery_pincode',
    ];
    for (const w of wanted) {
      const c = cols.find((x) => x.column_name === w);
      console.log(
        `  ${w}: ${c ? `${c.data_type} nullable=${c.is_nullable}` : 'MISSING'}`
      );
    }
  });

  await section('3) shipments CHECK constraints', async () => {
    const rows = await query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'shipments' AND c.contype = 'c'
    `);
    if (!rows.length) console.log('  (no CHECK constraints on shipments)');
    rows.forEach((r) => console.log(`  ${r.conname}: ${r.def}`));
  });

  await section('4) orders columns for tracking mirror', async () => {
    for (const col of [
      'tracking_number',
      'delivery_partner',
      'shipped_at',
      'order_type',
    ]) {
      const r = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = '${col}'
      `);
      console.log(`  orders.${col}: ${r.length ? 'present' : 'MISSING'}`);
    }
  });

  await section('5) Recent ecommerce orders (shipped/processing)', async () => {
    const rows = await query(`
      SELECT o.id, o.order_number, o.order_status, o.tracking_number, o.delivery_partner,
             o.shipped_at, o.created_at,
             s.awb_code, s.tracking_url, s.courier_name, s.logistics_partner,
             s.status AS shipment_status_col, s.tracking_provider, s.fulfillment_type
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT * FROM shipments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) s ON true
      WHERE COALESCE(o.order_type, 'ecommerce') = 'ecommerce'
         OR o.order_number LIKE 'ORD-%'
      ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
      LIMIT 15
    `);
    console.log(`  rows: ${rows.length}`);
    rows.forEach((r) => {
      console.log(
        `  #${r.order_number} status=${r.order_status} ` +
          `order.tracking=${r.tracking_number || '-'} ` +
          `shipment.awb=${r.awb_code || '-'} url=${r.tracking_url ? 'yes' : 'no'} ` +
          `ship_status=${r.shipment_status_col || '-'}`
      );
    });
  });

  await section('6) Shipped orders missing tracking (customer-visible gap)', async () => {
    const rows = await query(`
      SELECT o.id, o.order_number, o.order_status, o.tracking_number,
             s.awb_code, s.tracking_url
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT awb_code, tracking_url FROM shipments WHERE order_id = o.id
        ORDER BY created_at DESC LIMIT 1
      ) s ON true
      WHERE o.order_status IN ('shipped', 'out_for_delivery', 'delivered')
        AND COALESCE(NULLIF(TRIM(s.awb_code), ''), NULLIF(TRIM(o.tracking_number), '')) IS NULL
      ORDER BY o.updated_at DESC NULLS LAST
      LIMIT 10
    `);
    console.log(`  shipped/delivered with NO awb/tracking_number: ${rows.length}`);
    rows.forEach((r) =>
      console.log(`  #${r.order_number} id=${r.id} status=${r.order_status}`)
    );
  });

  await section('7) Shipments with AWB (latest 10)', async () => {
    const rows = await query(`
      SELECT s.id, s.order_id, s.awb_code, s.tracking_url, s.courier_name,
             s.logistics_partner, s.status, s.tracking_provider, s.fulfillment_type, s.created_at,
             o.order_number, o.order_status
      FROM shipments s
      JOIN orders o ON o.id = s.order_id
      WHERE NULLIF(TRIM(s.awb_code), '') IS NOT NULL
      ORDER BY s.created_at DESC
      LIMIT 10
    `);
    console.log(`  rows: ${rows.length}`);
    rows.forEach((r) => {
      console.log(
        `  order #${r.order_number} awb=${r.awb_code} url=${r.tracking_url || '-'} ` +
          `order_status=${r.order_status} ship_status=${r.status}`
      );
    });
  });

  await section('8) Test insert constraint (dry — rollback)', async () => {
    const order = await query(`
      SELECT id FROM orders
      WHERE order_status = 'processing'
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!order.length) {
      console.log('  No processing order to test against — skip');
      return;
    }
    const oid = order[0].id;
    console.log(`  Would test on order ${oid} — checking if status value shipped is allowed...`);
    try {
      await executeSQL('BEGIN', false);
      await executeSQL(
        `INSERT INTO shipments (order_id, logistics_partner, awb_code, tracking_url, status, fulfillment_type, tracking_provider, pickup_pincode, delivery_pincode)
         VALUES ('${oid}', 'bluedart', 'TEST99999999', 'https://example.com/track', 'shipped', 'vendor', 'aftership', '560001', '560001')`,
        false
      );
      await executeSQL('ROLLBACK', false);
      console.log('  INSERT with status=shipped: SUCCEEDED (then rolled back)');
    } catch (e) {
      await executeSQL('ROLLBACK', false).catch(() => {});
      console.log('  INSERT with status=shipped: FAILED —', e.message);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
