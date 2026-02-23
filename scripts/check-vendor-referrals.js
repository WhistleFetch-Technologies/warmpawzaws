const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'warmpawz-dev-db.cluster-cqjqgqjqgqjq.ap-south-1.rds.amazonaws.com',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'warmpawz_dev',
  user: process.env.DB_USER || 'warmpawz_admin',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

const vendorId = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';

async function checkReferrals() {
  try {
    console.log(`\n🔍 Checking referrals for vendor: ${vendorId}\n`);

    // Check all referrals by this vendor
    const referrals = await pool.query(
      `SELECT 
        vr.*,
        v.business_name as referred_vendor_name,
        v.phone as referred_vendor_phone
       FROM vendor_referrals vr
       LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
       WHERE vr.referrer_vendor_id = $1
       ORDER BY vr.created_at DESC`,
      [vendorId]
    );

    console.log(`📊 Total Referrals Found: ${referrals.rows.length}\n`);

    if (referrals.rows.length > 0) {
      console.log('📋 Referral Details:');
      console.log('='.repeat(100));
      referrals.rows.forEach((ref, index) => {
        console.log(`\n${index + 1}. Referral ID: ${ref.id}`);
        console.log(`   Referred Phone: ${ref.referred_phone}`);
        console.log(`   Referral Code: ${ref.referral_code}`);
        console.log(`   Status: ${ref.status}`);
        console.log(`   Referred Vendor ID: ${ref.referred_vendor_id || 'N/A'}`);
        console.log(`   Referred Vendor Name: ${ref.referred_vendor_name || 'N/A'}`);
        console.log(`   Created At: ${ref.created_at}`);
        console.log(`   Applied At: ${ref.applied_at || 'N/A'}`);
        console.log(`   Approved At: ${ref.approved_at || 'N/A'}`);
      });
    } else {
      console.log('❌ No referrals found for this vendor');
    }

    // Check if vendor exists
    const vendorCheck = await pool.query(
      `SELECT id, business_name, phone FROM vendors WHERE id = $1`,
      [vendorId]
    );

    if (vendorCheck.rows.length > 0) {
      console.log(`\n✅ Vendor exists: ${vendorCheck.rows[0].business_name} (${vendorCheck.rows[0].phone})`);
    } else {
      console.log(`\n❌ Vendor not found in database`);
    }

    // Check total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM vendor_referrals WHERE referrer_vendor_id = $1`,
      [vendorId]
    );
    console.log(`\n📈 Total Referrals Count: ${countResult.rows[0].total}`);

  } catch (error) {
    console.error('❌ Error checking referrals:', error);
  } finally {
    await pool.end();
  }
}

checkReferrals();
