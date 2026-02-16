const { Pool } = require('pg');

async function checkBothVendorIds() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const vendorIds = [
      '250a0ba2-823e-4bd7-a943-d509e5eb4655', // User is checking this
      '8dc26f50-0ebe-4b33-91d4-f6d58402ca45'  // Referral code owner
    ];

    console.log('Checking both vendor IDs...\n');

    for (const vid of vendorIds) {
      const vendor = await pool.query(
        `SELECT id, business_name, owner_name, phone FROM vendors WHERE id = $1`,
        [vid]
      );

      if (vendor.rows.length > 0) {
        console.log(`Vendor ${vid}:`);
        console.log(`  Name: ${vendor.rows[0].business_name || vendor.rows[0].owner_name}`);
        console.log(`  Phone: ${vendor.rows[0].phone}\n`);

        // Check wallet
        const wallet = await pool.query(
          `SELECT vw.balance, vlp.total_points
           FROM vendor_wallets vw
           LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
           WHERE vw.vendor_id = $1`,
          [vid]
        );

        if (wallet.rows.length > 0) {
          console.log(`  Wallet: ₹${wallet.rows[0].balance || 0}`);
          console.log(`  Points: ${wallet.rows[0].total_points || 0}\n`);
        } else {
          console.log(`  No wallet found\n`);
        }
      } else {
        console.log(`Vendor ${vid}: NOT FOUND\n`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkBothVendorIds();
