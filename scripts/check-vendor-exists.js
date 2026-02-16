const { Pool } = require('pg');

async function checkVendor() {
  const vendorId = 'bcff4da9-99b1-401f-ab62-5d70526331ec';
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log(`Checking vendor: ${vendorId}\n`);

    // Check vendors table
    const vendorResult = await pool.query(
      `SELECT id, business_name, owner_name, phone, status, is_active, created_at 
       FROM vendors 
       WHERE id = $1`,
      [vendorId]
    );
    console.log('In vendors table:');
    console.log(JSON.stringify(vendorResult.rows, null, 2));

    // Check vendor_identity table
    const identityResult = await pool.query(
      `SELECT id, vendor_id, phone, onboarding_status, created_at 
       FROM vendor_identity 
       WHERE id = $1 OR vendor_id = $1`,
      [vendorId]
    );
    console.log('\nIn vendor_identity table:');
    console.log(JSON.stringify(identityResult.rows, null, 2));

    // Check by text comparison (in case of type mismatch)
    const textResult = await pool.query(
      `SELECT id, vendor_id, phone, onboarding_status 
       FROM vendor_identity 
       WHERE id::text = $1 OR vendor_id::text = $1`,
      [vendorId]
    );
    console.log('\nIn vendor_identity (text comparison):');
    console.log(JSON.stringify(textResult.rows, null, 2));

    // Check vendor_onboarding_applications
    const appResult = await pool.query(
      `SELECT id, vendor_identity_id, status, created_at 
       FROM vendor_onboarding_applications 
       WHERE id::text = $1 OR vendor_identity_id::text = $1`,
      [vendorId]
    );
    console.log('\nIn vendor_onboarding_applications:');
    console.log(JSON.stringify(appResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkVendor();
