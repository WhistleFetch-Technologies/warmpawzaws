const { Pool } = require('pg');

async function cleanup() {
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283';
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('Cleaning up vendor data from customer tables...\n');

    // Check if vendor ID exists in customers table
    const customerCheck = await pool.query(
      `SELECT id FROM customers WHERE id = $1`,
      [referrerVendorId]
    );

    if (customerCheck.rows.length === 0) {
      console.log('Vendor ID does not exist in customers table, cleaning up...\n');

      // Delete from customer_loyalty_points
      const deleted1 = await pool.query(
        `DELETE FROM customer_loyalty_points WHERE customer_id = $1`,
        [referrerVendorId]
      );
      console.log(`Deleted ${deleted1.rowCount} records from customer_loyalty_points`);

      // Delete from loyalty_transactions
      const deleted2 = await pool.query(
        `DELETE FROM loyalty_transactions WHERE customer_id = $1`,
        [referrerVendorId]
      );
      console.log(`Deleted ${deleted2.rowCount} records from loyalty_transactions`);

      // Get wallet ID first
      const walletCheck = await pool.query(
        `SELECT id FROM customer_wallets WHERE customer_id = $1`,
        [referrerVendorId]
      );

      if (walletCheck.rows.length > 0) {
        const walletId = walletCheck.rows[0].id;

        // Delete wallet transactions
        const deleted3 = await pool.query(
          `DELETE FROM wallet_transactions WHERE wallet_id = $1`,
          [walletId]
        );
        console.log(`Deleted ${deleted3.rowCount} records from wallet_transactions`);

        // Delete wallet
        const deleted4 = await pool.query(
          `DELETE FROM customer_wallets WHERE id = $1`,
          [walletId]
        );
        console.log(`Deleted ${deleted4.rowCount} records from customer_wallets`);
      }

      console.log('\n✅ Cleanup completed');
    } else {
      console.log('Vendor ID exists in customers table, skipping cleanup');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

cleanup();
