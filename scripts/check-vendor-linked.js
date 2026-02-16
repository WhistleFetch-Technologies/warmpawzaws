const { Pool } = require('pg');

async function checkVendor() {
  const vendorIdentityId = 'bcff4da9-99b1-401f-ab62-5d70526331ec';
  const vendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283';
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log(`Checking vendor_id: ${vendorId}\n`);

    // Check if vendor exists with the vendor_id from vendor_identity
    const vendorResult = await pool.query(
      `SELECT id, business_name, owner_name, phone, status, is_active, created_at 
       FROM vendors 
       WHERE id = $1`,
      [vendorId]
    );
    console.log('Vendor with vendor_id from vendor_identity:');
    console.log(JSON.stringify(vendorResult.rows, null, 2));

    // Check vendor_identity details
    const identityResult = await pool.query(
      `SELECT id, vendor_id, phone, onboarding_status, selected_role_id, created_at 
       FROM vendor_identity 
       WHERE id = $1`,
      [vendorIdentityId]
    );
    console.log('\nVendor identity details:');
    console.log(JSON.stringify(identityResult.rows, null, 2));

    // Check if vendor exists by phone
    const phoneResult = await pool.query(
      `SELECT id, business_name, phone 
       FROM vendors 
       WHERE phone = '2142352132' OR phone = '+2142352132' OR phone = '+12142352132'`,
      []
    );
    console.log('\nVendor by phone (2142352132):');
    console.log(JSON.stringify(phoneResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkVendor();
