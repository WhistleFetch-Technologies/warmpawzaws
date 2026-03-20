const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env.local') });

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'warmpawz',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
  if (config.host === 'localhost' || config.host === '127.0.0.1') {
    config.ssl = false;
  }
  return config;
};

async function investigatePharmacyOrder(pharmacyId) {
  const pool = new Pool(getDbConfig());

  console.log('🔍 Investigating Pharmacy Orders in Database');
  console.log('===========================================');
  console.log(`📝 Pharmacy ID: ${pharmacyId}`);
  console.log('');

  try {
    console.log('🔗 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');

    // 1️⃣ All pharmacy orders (recent)
    console.log('\n1️⃣ Recent Pharmacy Orders (Last 10):');
    const allOrdersRes = await pool.query(
      `SELECT 
        id, 
        status, 
        pharmacy_id, 
        customer_id, 
        customer_phone,
        created_at, 
        accepted_at
      FROM pharmacy_orders 
      ORDER BY created_at DESC 
      LIMIT 10`
    );
    if (allOrdersRes.rows.length > 0) {
      console.log(JSON.stringify(allOrdersRes.rows, null, 2));
    } else {
      console.log('   No pharmacy orders found.');
    }

    // 2️⃣ Orders for this specific pharmacy
    console.log(`\n2️⃣ Orders for Pharmacy ${pharmacyId}:`);
    const pharmacyOrdersRes = await pool.query(
      `SELECT 
        id, 
        status, 
        pharmacy_id, 
        customer_id, 
        customer_phone,
        created_at, 
        accepted_at,
        subtotal,
        delivery_fee,
        total_amount
      FROM pharmacy_orders 
      WHERE pharmacy_id = $1
      ORDER BY created_at DESC`,
      [pharmacyId]
    );
    if (pharmacyOrdersRes.rows.length > 0) {
      console.log(JSON.stringify(pharmacyOrdersRes.rows, null, 2));
    } else {
      console.log(`   No orders found for pharmacy ${pharmacyId}.`);
    }

    // 3️⃣ Orders with status filter (what the endpoint is querying)
    console.log(`\n3️⃣ Orders with Status Filter (confirmed,invoice_generated,payment_confirmed,preparing,dispatched):`);
    const statusFilterRes = await pool.query(
      `SELECT 
        id, 
        status, 
        pharmacy_id, 
        customer_id,
        created_at, 
        accepted_at
      FROM pharmacy_orders 
      WHERE pharmacy_id = $1
        AND status = ANY($2::text[])
      ORDER BY created_at DESC`,
      [pharmacyId, ['confirmed', 'invoice_generated', 'payment_confirmed', 'preparing', 'dispatched']]
    );
    if (statusFilterRes.rows.length > 0) {
      console.log(JSON.stringify(statusFilterRes.rows, null, 2));
    } else {
      console.log(`   No orders found with those statuses for pharmacy ${pharmacyId}.`);
    }

    // 4️⃣ Check what statuses exist for this pharmacy
    console.log(`\n4️⃣ All Statuses for Pharmacy ${pharmacyId}:`);
    const statusesRes = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM pharmacy_orders 
       WHERE pharmacy_id = $1
       GROUP BY status
       ORDER BY count DESC`,
      [pharmacyId]
    );
    if (statusesRes.rows.length > 0) {
      console.log(JSON.stringify(statusesRes.rows, null, 2));
    } else {
      console.log(`   No orders found for pharmacy ${pharmacyId}.`);
    }

    // 5️⃣ Check pharmacy_broadcasts to see if order was accepted
    console.log(`\n5️⃣ Pharmacy Broadcasts for Pharmacy ${pharmacyId}:`);
    const broadcastsRes = await pool.query(
      `SELECT 
        pb.id,
        pb.order_id,
        pb.pharmacy_id,
        pb.status as broadcast_status,
        pb.response_time,
        po.status as order_status,
        po.pharmacy_id as order_pharmacy_id
      FROM pharmacy_broadcasts pb
      LEFT JOIN pharmacy_orders po ON po.id = pb.order_id
      WHERE pb.pharmacy_id = $1
      ORDER BY pb.created_at DESC
      LIMIT 10`,
      [pharmacyId]
    );
    if (broadcastsRes.rows.length > 0) {
      console.log(JSON.stringify(broadcastsRes.rows, null, 2));
    } else {
      console.log(`   No broadcasts found for pharmacy ${pharmacyId}.`);
    }

    // 6️⃣ Check if pharmacy_orders table structure
    console.log(`\n6️⃣ Pharmacy Orders Table Structure:`);
    const tableInfoRes = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'pharmacy_orders'
       ORDER BY ordinal_position`
    );
    if (tableInfoRes.rows.length > 0) {
      console.log(JSON.stringify(tableInfoRes.rows, null, 2));
    }

  } catch (error) {
    console.error('❌ Database operation failed:', error);
  } finally {
    await pool.end();
    console.log('\n✨ Done!');
  }
}

const pharmacyId = process.argv[2];

if (!pharmacyId) {
  console.error('Usage: node investigate-pharmacy-order.js <pharmacyId>');
  process.exit(1);
}

investigatePharmacyOrder(pharmacyId);
