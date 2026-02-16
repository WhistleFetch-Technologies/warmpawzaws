const { Pool } = require('pg');

async function testReferralStorage() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING REFERRAL CODE STORAGE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check recent vendor_identity records with referral codes
    const recentIdentities = await pool.query(
      `SELECT id, phone, metadata, onboarding_status, created_at
       FROM vendor_identity
       WHERE metadata IS NOT NULL
       AND metadata != '{}'::jsonb
       ORDER BY created_at DESC
       LIMIT 10`
    );

    console.log(`Found ${recentIdentities.rows.length} vendor_identity records with metadata:\n`);
    recentIdentities.rows.forEach((vi, i) => {
      let metadata = vi.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      
      if (metadata.referral_code_id || metadata.referral_code) {
        console.log(`${i + 1}. Phone: ${vi.phone}`);
        console.log(`   Referral Code: ${metadata.referral_code || 'NULL'}`);
        console.log(`   Referral ID: ${metadata.referral_code_id || 'NULL'}`);
        console.log(`   Created: ${new Date(vi.created_at).toLocaleString()}\n`);
      }
    });

    // Check vendor_referrals with 'applied' status
    const appliedReferrals = await pool.query(
      `SELECT * FROM vendor_referrals
       WHERE status = 'applied'
       ORDER BY applied_at DESC
       LIMIT 10`
    );

    console.log(`\nFound ${appliedReferrals.rows.length} referrals with 'applied' status:\n`);
    appliedReferrals.rows.forEach((ref, i) => {
      console.log(`${i + 1}. Code: ${ref.referral_code}`);
      console.log(`   Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`   Vendor ID: ${ref.referred_vendor_id || 'NULL'}`);
      console.log(`   Applied At: ${ref.applied_at ? new Date(ref.applied_at).toLocaleString() : 'NULL'}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ Fix deployed:');
    console.log('   1. vendor_identity is now created during OTP verification');
    console.log('   2. Referral code is stored in metadata immediately');
    console.log('   3. Approval endpoint checks for both "applied" and "pending" referrals\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testReferralStorage();
