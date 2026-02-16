const { Pool } = require('pg');

async function findCorrectReferrer() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const newVendorId = '57d23549-1ee4-4f81-9c7a-b4a96b6a073d';
    const phone = '2343478356';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FINDING CORRECT REFERRER');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Get all referral codes and their owners
    console.log('All referral codes and their owners:\n');
    const allReferrals = await pool.query(
      `SELECT vr.*, v.business_name, v.phone as vendor_phone
       FROM vendor_referrals vr
       LEFT JOIN vendors v ON vr.referrer_vendor_id = v.id
       ORDER BY vr.created_at DESC
       LIMIT 10`
    );

    allReferrals.rows.forEach((ref, i) => {
      console.log(`${i + 1}. Code: ${ref.referral_code}`);
      console.log(`   Owner: ${ref.business_name || ref.vendor_phone || ref.referrer_vendor_id}`);
      console.log(`   Owner ID: ${ref.referrer_vendor_id}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Referred Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`   Referred Vendor: ${ref.referred_vendor_id || 'NULL'}`);
      console.log('');
    });

    // Check which referral code should have been used
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  WHICH REFERRAL CODE DID YOU USE?');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Please check the referral codes above and tell me which one you used.');
    console.log('The referrer vendor (owner of the code) should be DIFFERENT from the new vendor.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

findCorrectReferrer();
