const { Pool } = require('pg');

async function findShreeshaVendor() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('Finding Shreesha\'s Vet Solo vendor...\n');

    // Search by business name
    const vendors = await pool.query(
      `SELECT id, business_name, owner_name, phone FROM vendors 
       WHERE business_name ILIKE '%shreesha%' 
       OR owner_name ILIKE '%shreesha%'`
    );

    console.log(`Found ${vendors.rows.length} vendor(s):\n`);
    vendors.rows.forEach((v, i) => {
      console.log(`${i + 1}. ID: ${v.id}`);
      console.log(`   Name: ${v.business_name || v.owner_name}`);
      console.log(`   Phone: ${v.phone}\n`);
    });

    // Check referral code owner
    const referral = await pool.query(
      `SELECT vr.*, v.business_name, v.phone
       FROM vendor_referrals vr
       LEFT JOIN vendors v ON vr.referrer_vendor_id = v.id
       WHERE vr.referral_code = 'VREFCA45O7N4'`
    );

    if (referral.rows.length > 0) {
      console.log('Referral code VREFCA45O7N4 owner:');
      console.log(`  Vendor ID: ${referral.rows[0].referrer_vendor_id}`);
      console.log(`  Business Name: ${referral.rows[0].business_name || 'NULL'}`);
      console.log(`  Phone: ${referral.rows[0].phone || 'NULL'}\n`);
    }

    // Check both vendor IDs
    const vendorIds = ['250a0ba2-823e-4bd7-a943-d509e5eb4655', '8dc26f50-0ebe-4b33-91d4-f6d58402ca45'];
    for (const vid of vendorIds) {
      const v = await pool.query(
        `SELECT id, business_name, owner_name, phone FROM vendors WHERE id = $1`,
        [vid]
      );
      if (v.rows.length > 0) {
        console.log(`Vendor ${vid}:`);
        console.log(`  Name: ${v.rows[0].business_name || v.rows[0].owner_name}`);
        console.log(`  Phone: ${v.rows[0].phone}\n`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

findShreeshaVendor();
