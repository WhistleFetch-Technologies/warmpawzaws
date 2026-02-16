const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    // Check all loyalty-related tables
    const tablesResult = await pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND (table_name LIKE '%loyalty%' OR table_name LIKE '%wallet%')
       ORDER BY table_name`
    );

    console.log('Loyalty & Wallet Related Tables:');
    console.log(JSON.stringify(tablesResult.rows, null, 2));

    // Check customer_loyalty_points schema
    const customerLoyaltySchema = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns 
       WHERE table_name = 'customer_loyalty_points'
       ORDER BY ordinal_position`
    );
    console.log('\n\ncustomer_loyalty_points schema:');
    console.log(JSON.stringify(customerLoyaltySchema.rows, null, 2));

    // Check if vendor_loyalty_points exists
    const vendorLoyaltyCheck = await pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name = 'vendor_loyalty_points'`
    );
    console.log('\n\nvendor_loyalty_points table exists:', vendorLoyaltyCheck.rows.length > 0);

    // Check loyalty_transactions schema
    const loyaltyTxSchema = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns 
       WHERE table_name = 'loyalty_transactions'
       ORDER BY ordinal_position`
    );
    console.log('\n\nloyalty_transactions schema:');
    console.log(JSON.stringify(loyaltyTxSchema.rows, null, 2));

    // Check customer_wallets schema
    const walletSchema = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns 
       WHERE table_name = 'customer_wallets'
       ORDER BY ordinal_position`
    );
    console.log('\n\ncustomer_wallets schema:');
    console.log(JSON.stringify(walletSchema.rows, null, 2));

    // Check foreign keys on customer_loyalty_points
    const fkResult = await pool.query(
      `SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'customer_loyalty_points' 
        AND tc.constraint_type = 'FOREIGN KEY'`
    );
    console.log('\n\nForeign Keys on customer_loyalty_points:');
    console.log(JSON.stringify(fkResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
