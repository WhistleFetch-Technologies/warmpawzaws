const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function test() {
  const testPhone = '9876543210';
  const uatUserId = 'uat-customer-user';
  
  console.log('Testing customer ID resolution...\n');
  
  // Test 1: Direct phone lookup
  console.log('[1] Testing direct phone lookup...');
  try {
    const result1 = await pool.query(
      `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
      [testPhone]
    );
    console.log(`    Result: ${result1.rows.length > 0 ? result1.rows[0].id : 'NOT FOUND'}`);
  } catch (e) {
    console.log(`    Error: ${e.message}`);
  }
  
  // Test 2: customer_identity lookup
  console.log('\n[2] Testing customer_identity lookup...');
  try {
    const result2 = await pool.query(
      `SELECT customer_id FROM customer_identity WHERE phone = $1 AND customer_id IS NOT NULL LIMIT 1`,
      [testPhone]
    );
    console.log(`    Result: ${result2.rows.length > 0 ? result2.rows[0].customer_id : 'NOT FOUND'}`);
  } catch (e) {
    console.log(`    Error: ${e.message}`);
  }
  
  // Test 3: Test with customer_referrals query
  console.log('\n[3] Testing customer_referrals query with customer ID...');
  try {
    const customerId = '0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b';
    const result3 = await pool.query(
      `SELECT COUNT(*) as count FROM customer_referrals WHERE referrer_customer_id = $1::uuid`,
      [customerId]
    );
    console.log(`    Result: ${result3.rows[0].count}`);
  } catch (e) {
    console.log(`    Error: ${e.message}`);
  }
  
  // Test 4: Test with string (not UUID) - this should fail
  console.log('\n[4] Testing customer_referrals query with non-UUID string...');
  try {
    const result4 = await pool.query(
      `SELECT COUNT(*) as count FROM customer_referrals WHERE referrer_customer_id = $1::uuid`,
      [uatUserId]
    );
    console.log(`    Result: ${result4.rows[0].count}`);
  } catch (e) {
    console.log(`    Error (expected): ${e.message}`);
  }
  
  await pool.end();
}

test().catch(console.error);
