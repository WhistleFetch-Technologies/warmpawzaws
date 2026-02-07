#!/usr/bin/env node
/**
 * ============================================================================
 * SEED: Finance & Settlements Demo Data
 * ============================================================================
 * Seeds payments, settlements, and vendor_earnings so the Finance & Logistics
 * dashboard shows non-zero stats, graphs, and trends.
 *
 * Run after: seed-comprehensive-test-data.js (or ensure vendors/customers exist)
 * Usage: node scripts/seed-finance-settlements-demo.js
 * ============================================================================
 */

const path = require('path');
let Pool;
try {
  Pool = require(path.join(__dirname, '..', 'db', 'node_modules', 'pg')).Pool;
} catch (e) {
  Pool = require('pg').Pool;
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST || process.env.RDS_HOSTNAME,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || process.env.RDS_DB_NAME || 'warmpawz',
      user: process.env.DB_USER || process.env.RDS_USERNAME,
      password: process.env.DB_PASSWORD || process.env.RDS_PASSWORD,
    });

async function seedFinanceDemo() {
  console.log('🌱 Seeding Finance & Settlements demo data...\n');

  // 1. Get vendors and customers
  const vendorsRes = await pool.query(
    `SELECT id, business_name FROM vendors WHERE status IN ('approved','active') LIMIT 5`
  );
  const customersRes = await pool.query(`SELECT id FROM customers LIMIT 1`);
  const vendorIds = vendorsRes.rows.map((r) => r.id);
  const customerId = customersRes.rows[0]?.id;

  if (vendorIds.length === 0) {
    console.log('⚠️  No vendors found. Run seed-comprehensive-test-data.js first.');
    process.exit(1);
  }
  if (!customerId) {
    console.log('⚠️  No customers found. Run seed-comprehensive-test-data.js first.');
    process.exit(1);
  }

  // 2. Insert completed payments (last 30 days) for analytics KPIs
  const paymentCols = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'payments' AND column_name IN ('platform_fee', 'commission_amount', 'vendor_id')`
  );
  const hasPlatformFee = paymentCols.rows.some((r) => r.column_name === 'platform_fee');
  const hasCommissionAmount = paymentCols.rows.some((r) => r.column_name === 'commission_amount');
  const hasVendorId = paymentCols.rows.some((r) => r.column_name === 'vendor_id');

  const amounts = [350, 500, 750, 1200, 450, 890, 600, 1100, 400];
  for (let i = 0; i < 12; i++) {
    const amount = amounts[i % amounts.length];
    const commission = Math.round(amount * 0.05); // 5%
    const vendorId = vendorIds[i % vendorIds.length];
    const daysAgo = i;

    const cols = [
      'id', 'customer_id', 'amount', 'payment_method', 'payment_status',
      ...(hasVendorId ? ['vendor_id'] : []),
      ...(hasPlatformFee ? ['platform_fee'] : []),
      ...(hasCommissionAmount ? ['commission_amount'] : []),
    ];
    const vals = [
      require('crypto').randomUUID(),
      customerId,
      amount,
      'razorpay',
      'completed',
      ...(hasVendorId ? [vendorId] : []),
      ...(hasPlatformFee ? [commission] : []),
      ...(hasCommissionAmount ? [commission] : []),
    ];
    await pool.query(
      `INSERT INTO payments (${cols.join(', ')}, created_at, updated_at)
       VALUES (${vals.map((_, j) => `$${j + 1}`).join(', ')}, CURRENT_DATE - INTERVAL '${daysAgo} days', NOW())
       ON CONFLICT DO NOTHING`,
      vals
    ).catch(() => {}); // Ignore dup/constraint errors
  }
  console.log('✅ Payments seeded (12 completed payments over 30 days)');

  // 3. Insert settlements
  const settlementsCols = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'settlements' AND column_name IN ('vendor_amount', 'net_amount', 'status', 'settlement_status')`
  );
  const hasVendorAmount = settlementsCols.rows.some((r) => r.column_name === 'vendor_amount');
  const hasStatus = settlementsCols.rows.some((r) => r.column_name === 'status');

  for (let i = 0; i < vendorIds.length; i++) {
    const vendorId = vendorIds[i];
    const total = 2000 + i * 1500;
    const commission = Math.round(total * 0.05);
    const net = total - commission;
    const start = new Date();
    start.setDate(start.getDate() - 14);
    const end = new Date();
    end.setDate(end.getDate() - 7);

    const statusCol = hasStatus ? 'status' : 'settlement_status';
    const vendorAmtCol = hasVendorAmount ? 'vendor_amount' : 'net_amount';

    await pool.query(
      `INSERT INTO settlements (vendor_id, total_amount, commission_amount, net_amount, ${vendorAmtCol}, settlement_status, ${statusCol}, settlement_period_start, settlement_period_end, payment_ids, created_at)
       SELECT $1, $2, $3, $4, $4, 'completed', 'completed', $5::date, $6::date, '{}', NOW()
       WHERE NOT EXISTS (SELECT 1 FROM settlements WHERE vendor_id = $1 AND settlement_period_start = $5::date LIMIT 1)`,
      [vendorId, total, commission, net, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    ).catch(() => {});
  }

  // Add pending settlements
  for (let i = 0; i < Math.min(2, vendorIds.length); i++) {
    const vendorId = vendorIds[i];
    const total = 1500 + i * 800;
    const commission = Math.round(total * 0.05);
    const net = total - commission;
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();

    await pool.query(
      `INSERT INTO settlements (vendor_id, total_amount, commission_amount, net_amount, settlement_status, settlement_period_start, settlement_period_end, payment_ids, created_at)
       SELECT $1, $2, $3, $4, 'pending', $5::date, $6::date, '{}', NOW()
       WHERE NOT EXISTS (SELECT 1 FROM settlements WHERE vendor_id = $1 AND settlement_status = 'pending' LIMIT 1)`,
      [vendorId, total, commission, net, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    ).catch(() => {});
  }
  console.log('✅ Settlements seeded (completed + pending)');

  // 4. vendor_earnings if we have bookings
  const bookingsRes = await pool.query(
    `SELECT id, vendor_id, total_amount FROM bookings WHERE status = 'completed' LIMIT 10`
  );
  const veCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'vendor_earnings'`
  );
  if (veCols.rows.length > 0 && bookingsRes.rows.length > 0) {
    for (const b of bookingsRes.rows) {
      const commission = Math.round((b.total_amount || 0) * 0.05);
      const vendorAmt = (b.total_amount || 0) - commission;
      await pool.query(
        `INSERT INTO vendor_earnings (vendor_id, booking_id, amount, commission_amount, total_amount, commission_rate, status, realized_at)
         SELECT $1, $2, $3, $4, $5, 5.00, 'pending', NOW()
         ON CONFLICT DO NOTHING`,
        [b.vendor_id, b.id, vendorAmt, commission, b.total_amount]
      ).catch(() => {});
    }
    console.log('✅ Vendor earnings seeded (from completed bookings)');
  }

  console.log('\n✅ Finance demo data seeded. Refresh Finance & Logistics dashboard to see stats and graphs.');
  await pool.end();
}

seedFinanceDemo().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
