const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function check() {
  console.log('Checking customer_wallets schema...');
  const wallets = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'customer_wallets' AND column_name = 'customer_id'
  `);
  console.log('customer_wallets.customer_id:', wallets.rows[0]?.data_type || 'NOT FOUND');
  
  console.log('\nChecking loyalty_transactions schema...');
  const loyalty = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'loyalty_transactions' AND column_name = 'customer_id'
  `);
  console.log('loyalty_transactions.customer_id:', loyalty.rows[0]?.data_type || 'NOT FOUND');
  
  await pool.end();
}

check().catch(console.error);
