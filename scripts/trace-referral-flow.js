const { Pool } = require('pg');

async function traceReferralFlow() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const vendorIdentityId = 'b2cf522e-4456-4441-bdf8-3875baa702be';
    const phone = '6583548643';
    const applicationId = '5c4c6432-871a-498f-8f50-311a7b2e4c74';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TRACING REFERRAL FLOW');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check vendor_identity metadata
    console.log('1️⃣  Checking vendor_identity metadata...\n');
    const identity = await pool.query(
      `SELECT id, phone, vendor_id, metadata, onboarding_status, created_at
       FROM vendor_identity 
       WHERE id = $1 OR phone = $2`,
      [vendorIdentityId, phone]
    );

    if (identity.rows.length > 0) {
      const vi = identity.rows[0];
      console.log(`   Vendor Identity ID: ${vi.id}`);
      console.log(`   Phone: ${vi.phone}`);
      console.log(`   Vendor ID: ${vi.vendor_id || 'NULL'}`);
      console.log(`   Onboarding Status: ${vi.onboarding_status}`);
      console.log(`   Created At: ${new Date(vi.created_at).toLocaleString()}`);
      
      let metadata = vi.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

      if (Object.keys(metadata).length === 0) {
        console.log('   ❌ PROBLEM: Metadata is empty! Referral code was not stored.\n');
      } else if (metadata.referral_code_id || metadata.referral_code) {
        console.log('   ✅ Referral info found in metadata\n');
      } else {
        console.log('   ⚠️  Metadata exists but no referral info\n');
      }
    }

    // Step 2: Check vendor_referrals by phone
    console.log('2️⃣  Checking vendor_referrals by phone...\n');
    const normalizedPhone = phone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1 
       OR referred_phone = $2
       OR referred_phone = $3
       ORDER BY created_at DESC`,
      [fullPhone, phone, normalizedPhone]
    );

    console.log(`   Found ${referrals.rows.length} referral record(s):\n`);
    referrals.rows.forEach((ref, i) => {
      console.log(`   ${i + 1}. Referral ID: ${ref.id}`);
      console.log(`      Code: ${ref.referral_code}`);
      console.log(`      Referrer: ${ref.referrer_vendor_id}`);
      console.log(`      Referred Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`      Referred Vendor ID: ${ref.referred_vendor_id || 'NULL'}`);
      console.log(`      Status: ${ref.status}`);
      console.log(`      Created At: ${new Date(ref.created_at).toLocaleString()}`);
      console.log(`      Applied At: ${ref.applied_at ? new Date(ref.applied_at).toLocaleString() : 'NULL'}`);
      console.log(`      Approved At: ${ref.approved_at ? new Date(ref.approved_at).toLocaleString() : 'NULL'}\n`);
    });

    // Step 3: Check application
    console.log('3️⃣  Checking application...\n');
    const application = await pool.query(
      `SELECT * FROM vendor_onboarding_applications WHERE id = $1`,
      [applicationId]
    );

    if (application.rows.length > 0) {
      const app = application.rows[0];
      console.log(`   Application ID: ${app.id}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Submitted At: ${app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'NULL'}`);
      console.log(`   Reviewed At: ${app.reviewed_at ? new Date(app.reviewed_at).toLocaleString() : 'NULL'}`);
      console.log(`   Reviewed By: ${app.reviewed_by || 'NULL'}\n`);
    }

    // Step 4: Check when vendor_identity was created vs when referral was created
    console.log('4️⃣  Timeline Analysis...\n');
    if (identity.rows.length > 0 && referrals.rows.length > 0) {
      const viCreated = new Date(identity.rows[0].created_at);
      const refCreated = new Date(referrals.rows[0].created_at);
      
      console.log(`   Vendor Identity Created: ${viCreated.toLocaleString()}`);
      console.log(`   Referral Record Created: ${refCreated.toLocaleString()}`);
      
      if (refCreated < viCreated) {
        console.log(`   ⚠️  Referral was created BEFORE vendor_identity!`);
        console.log(`   This suggests the referral was created during OTP verification.\n`);
      } else if (refCreated > viCreated) {
        console.log(`   ⚠️  Referral was created AFTER vendor_identity!`);
        console.log(`   This suggests the referral was NOT linked during registration.\n`);
      } else {
        console.log(`   ✅ Timeline looks correct.\n`);
      }
    }

    // Step 5: Check all referrals for this referral code
    console.log('5️⃣  Checking all referrals for code VREFCA45O7N4...\n');
    const allReferrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referral_code = 'VREFCA45O7N4'
       ORDER BY created_at DESC
       LIMIT 10`
    );

    console.log(`   Found ${allReferrals.rows.length} referral(s) with this code:\n`);
    allReferrals.rows.forEach((ref, i) => {
      console.log(`   ${i + 1}. Referred Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`      Referred Vendor ID: ${ref.referred_vendor_id || 'NULL'}`);
      console.log(`      Status: ${ref.status}`);
      console.log(`      Created: ${new Date(ref.created_at).toLocaleString()}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (identity.rows.length > 0 && Object.keys(identity.rows[0].metadata || {}).length === 0) {
      console.log('❌ ROOT CAUSE: Referral code was NOT stored in vendor_identity.metadata');
      console.log('   This means the referral code was provided but not persisted during registration.\n');
    }

    if (referrals.rows.length === 0) {
      console.log('❌ ROOT CAUSE: No referral record found for this phone number');
      console.log('   The referral code was not linked to the vendor during registration.\n');
    } else if (referrals.rows[0].status === 'pending' && !referrals.rows[0].applied_at) {
      console.log('❌ ROOT CAUSE: Referral exists but was never marked as "applied"');
      console.log('   The referral code was processed but not linked during OTP verification.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

traceReferralFlow();
