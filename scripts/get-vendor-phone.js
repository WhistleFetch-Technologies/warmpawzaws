const { Pool } = require('pg');

async function getVendorPhone() {
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283'; // Taruna Infosoft
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const vendor = await pool.query(
      `SELECT id, business_name, owner_name, phone, email FROM vendors WHERE id = $1`,
      [referrerVendorId]
    );

    if (vendor.rows.length > 0) {
      const v = vendor.rows[0];
      console.log('Vendor Details:');
      console.log(`  ID: ${v.id}`);
      console.log(`  Business Name: ${v.business_name || 'N/A'}`);
      console.log(`  Owner Name: ${v.owner_name || 'N/A'}`);
      console.log(`  Phone: ${v.phone || 'N/A'}`);
      console.log(`  Email: ${v.email || 'N/A'}`);
      console.log(`\n📱 Phone Number: ${v.phone || 'Not found'}`);
    } else {
      console.log('Vendor not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

getVendorPhone();
