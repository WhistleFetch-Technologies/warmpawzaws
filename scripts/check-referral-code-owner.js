const { Pool } = require('pg');

async function checkReferralCode() {
  const referralCode = 'VREFE283EKHY';
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log(`Checking referral code: ${referralCode}\n`);

    // Find referral code owner
    const referralResult = await pool.query(
      `SELECT vr.*, v.business_name, v.owner_name, v.phone as vendor_phone
       FROM vendor_referrals vr
       LEFT JOIN vendors v ON vr.referrer_vendor_id = v.id
       WHERE vr.referral_code = $1`,
      [referralCode]
    );

    console.log('Referral Code Owner:');
    console.log(JSON.stringify(referralResult.rows, null, 2));

    if (referralResult.rows.length > 0) {
      const referral = referralResult.rows[0];
      console.log(`\n✅ Referral code belongs to vendor: ${referral.referrer_vendor_id}`);
      console.log(`   Business Name: ${referral.business_name || 'N/A'}`);
      console.log(`   Owner Name: ${referral.owner_name || 'N/A'}`);
      console.log(`   Phone: ${referral.vendor_phone || 'N/A'}`);
      console.log(`   Status: ${referral.status}`);
    } else {
      console.log('\n❌ Referral code not found');
    }

    // Check application
    const applicationId = '7a00b0e3-41c1-49a3-9304-73fed099a3f2';
    const appResult = await pool.query(
      `SELECT voa.*, vi.phone, vi.metadata, vi.onboarding_status
       FROM vendor_onboarding_applications voa
       LEFT JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
       WHERE voa.id = $1`,
      [applicationId]
    );

    console.log('\n\nApplication Details:');
    console.log(JSON.stringify(appResult.rows, null, 2));

    if (appResult.rows.length > 0) {
      const app = appResult.rows[0];
      console.log(`\n✅ Application found`);
      console.log(`   Phone: ${app.phone}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Onboarding Status: ${app.onboarding_status}`);
      
      if (app.metadata) {
        const metadata = typeof app.metadata === 'string' ? JSON.parse(app.metadata) : app.metadata;
        console.log(`\n   Metadata:`);
        console.log(`   - Referral Code ID: ${metadata.referral_code_id || 'N/A'}`);
        console.log(`   - Referrer Vendor ID: ${metadata.referrer_vendor_id || 'N/A'}`);
        console.log(`   - Referral Code: ${metadata.referral_code || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkReferralCode();
