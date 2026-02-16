const { Pool } = require('pg');

async function checkReferralCodeExists() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const referralCode = 'VREFCA45O7N4';
    const phone = '4667995735';

    console.log('Checking if referral code exists...\n');
    
    // Check all referrals with this code
    const allReferrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referral_code = $1
       ORDER BY created_at DESC`,
      [referralCode]
    );

    console.log(`Found ${allReferrals.rows.length} referral record(s) with code ${referralCode}:\n`);
    allReferrals.rows.forEach((ref, i) => {
      console.log(`${i + 1}. Referral ID: ${ref.id}`);
      console.log(`   Referrer: ${ref.referrer_vendor_id}`);
      console.log(`   Referred Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Created: ${new Date(ref.created_at).toLocaleString()}\n`);
    });

    // Check if there's a referral for this specific phone
    const normalizedPhone = phone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    const phoneReferrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1
       ORDER BY created_at DESC`,
      [fullPhone]
    );

    console.log(`\nFound ${phoneReferrals.rows.length} referral record(s) for phone ${fullPhone}:\n`);
    phoneReferrals.rows.forEach((ref, i) => {
      console.log(`${i + 1}. Code: ${ref.referral_code}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Created: ${new Date(ref.created_at).toLocaleString()}\n`);
    });

    // Get referrer vendor ID from any referral with this code
    if (allReferrals.rows.length > 0) {
      const referrerVendorId = allReferrals.rows[0].referrer_vendor_id;
      console.log(`Referrer Vendor ID: ${referrerVendorId}\n`);
      
      const vendor = await pool.query(
        `SELECT id, business_name FROM vendors WHERE id = $1`,
        [referrerVendorId]
      );
      
      if (vendor.rows.length > 0) {
        console.log(`Referrer: ${vendor.rows[0].business_name}\n`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkReferralCodeExists();
