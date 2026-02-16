const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function check() {
  const testPhone = '9876543210';
  
  console.log(`Checking customer with phone: ${testPhone}\n`);
  
  // Check customers table
  const customers = await pool.query(
    `SELECT id, phone, full_name FROM customers WHERE phone = $1`,
    [testPhone]
  );
  console.log(`Customers found: ${customers.rows.length}`);
  if (customers.rows.length > 0) {
    console.log(JSON.stringify(customers.rows[0], null, 2));
  }
  
  // Check customer_identity
  const identities = await pool.query(
    `SELECT id, phone, customer_id FROM customer_identity WHERE phone = $1`,
    [testPhone]
  );
  console.log(`\nCustomer identities found: ${identities.rows.length}`);
  if (identities.rows.length > 0) {
    console.log(JSON.stringify(identities.rows[0], null, 2));
  }
  
  // Check if customer has referral code
  if (customers.rows.length > 0) {
    const customerId = customers.rows[0].id;
    const referrals = await pool.query(
      `SELECT * FROM customer_referrals WHERE referrer_customer_id = $1 LIMIT 1`,
      [customerId]
    );
    console.log(`\nReferral codes found: ${referrals.rows.length}`);
    if (referrals.rows.length > 0) {
      console.log(JSON.stringify(referrals.rows[0], null, 2));
    }
  }
  
  await pool.end();
}

check().catch(console.error);
