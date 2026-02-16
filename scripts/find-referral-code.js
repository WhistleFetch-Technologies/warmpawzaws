const { Pool } = require('pg');

async function findReferralCode() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const phone = '2343478356';
    const vendorIdentityId = 'ae70b9fd-23a7-4396-8f63-bb8d2d835ffe';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FINDING REFERRAL CODE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check all recent vendor_referrals
    console.log('1️⃣  Checking all recent vendor_referrals...\n');
    const allReferrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       ORDER BY created_at DESC
       LIMIT 20`
    );

    console.log(`   Found ${allReferrals.rows.length} recent referral(s):\n`);
    allReferrals.rows.forEach((ref, i) => {
      console.log(`${i + 1}. Code: ${ref.referral_code}`);
      console.log(`   Referrer: ${ref.referrer_vendor_id}`);
      console.log(`   Phone: ${ref.referred_phone}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Created: ${new Date(ref.created_at).toLocaleString()}\n`);
    });

    // Check if there's a referral with this phone in any format
    console.log('2️⃣  Searching for phone in all formats...\n');
    const phoneVariations = [
      phone,
      `+91${phone}`,
      `+${phone}`,
      phone.replace(/\D/g, ''),
      `91${phone}`,
    ];

    for (const phoneVar of phoneVariations) {
      const result = await pool.query(
        `SELECT * FROM vendor_referrals WHERE referred_phone = $1`,
        [phoneVar]
      );
      if (result.rows.length > 0) {
        console.log(`   ✅ Found with phone format: ${phoneVar}`);
        result.rows.forEach(ref => {
          console.log(`      Code: ${ref.referral_code}, Status: ${ref.status}`);
        });
      }
    }
    console.log('');

    // Check vendor_identity creation logs (check if referral code was in the request)
    console.log('3️⃣  Checking vendor_identity creation time...\n');
    const identity = await pool.query(
      `SELECT id, phone, created_at, metadata
       FROM vendor_identity 
       WHERE id = $1`,
      [vendorIdentityId]
    );

    if (identity.rows.length > 0) {
      const vi = identity.rows[0];
      console.log(`   Created at: ${new Date(vi.created_at).toLocaleString()}`);
      console.log(`   Phone: ${vi.phone}\n`);

      // Check referrals created around the same time
      const createdTime = new Date(vi.created_at);
      const beforeTime = new Date(createdTime.getTime() - 5 * 60 * 1000); // 5 minutes before
      const afterTime = new Date(createdTime.getTime() + 5 * 60 * 1000); // 5 minutes after

      console.log('4️⃣  Checking referrals created around the same time...\n');
      const nearbyReferrals = await pool.query(
        `SELECT * FROM vendor_referrals 
         WHERE created_at BETWEEN $1 AND $2
         ORDER BY created_at DESC`,
        [beforeTime, afterTime]
      );

      console.log(`   Found ${nearbyReferrals.rows.length} referral(s) created around that time:\n`);
      nearbyReferrals.rows.forEach((ref, i) => {
        console.log(`${i + 1}. Code: ${ref.referral_code}`);
        console.log(`   Referrer: ${ref.referrer_vendor_id}`);
        console.log(`   Phone: ${ref.referred_phone}`);
        console.log(`   Status: ${ref.status}`);
        console.log(`   Created: ${new Date(ref.created_at).toLocaleString()}\n`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  NEXT STEPS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('If a referral code was used but not found:');
    console.log('1. The referral code might not have been provided during registration');
    console.log('2. The referral code might have been provided but not processed');
    console.log('3. We need to manually link the referral and process it\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

findReferralCode();
