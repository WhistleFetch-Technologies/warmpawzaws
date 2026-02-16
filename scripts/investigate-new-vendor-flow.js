const { Pool } = require('pg');

async function investigateNewVendorFlow() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const vendorIdentityId = '672a7929-3eac-4c79-bd2e-418b614a2c1d';
    const phone = '4667995735';
    const referralCode = 'VREFCA45O7N4';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  INVESTIGATING NEW VENDOR REFERRAL FLOW');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check vendor_identity
    console.log('1️⃣  Checking vendor_identity...\n');
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

      if (metadata.referral_code_id || metadata.referral_code) {
        console.log('   ✅ Referral code found in metadata!\n');
      } else {
        console.log('   ❌ PROBLEM: Referral code NOT in metadata!\n');
      }
    } else {
      console.log('   ❌ Vendor identity not found!\n');
    }

    // Step 2: Check vendor_referrals
    console.log('2️⃣  Checking vendor_referrals...\n');
    const normalizedPhone = phone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE (referred_phone = $1 OR referred_phone = $2 OR referred_phone = $3)
       AND referral_code = $4
       ORDER BY created_at DESC`,
      [fullPhone, phone, normalizedPhone, referralCode]
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
      `SELECT * FROM vendor_onboarding_applications 
       WHERE vendor_identity_id = $1
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [vendorIdentityId]
    );

    if (application.rows.length > 0) {
      const app = application.rows[0];
      console.log(`   Application ID: ${app.id}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Submitted At: ${app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'NULL'}`);
      console.log(`   Reviewed At: ${app.reviewed_at ? new Date(app.reviewed_at).toLocaleString() : 'NULL'}`);
      console.log(`   Reviewed By: ${app.reviewed_by || 'NULL'}\n`);
    } else {
      console.log('   ⚠️  No application found\n');
    }

    // Step 4: Check vendor record
    console.log('4️⃣  Checking vendor record...\n');
    if (identity.rows.length > 0 && identity.rows[0].vendor_id) {
      const vendor = await pool.query(
        `SELECT id, business_name, phone, status FROM vendors WHERE id = $1`,
        [identity.rows[0].vendor_id]
      );

      if (vendor.rows.length > 0) {
        console.log(`   Vendor ID: ${vendor.rows[0].id}`);
        console.log(`   Name: ${vendor.rows[0].business_name}`);
        console.log(`   Status: ${vendor.rows[0].status}\n`);
      } else {
        console.log('   ⚠️  Vendor not found in vendors table (not approved yet)\n');
      }
    }

    // Step 5: Timeline analysis
    console.log('5️⃣  Timeline Analysis...\n');
    if (identity.rows.length > 0) {
      const viCreated = new Date(identity.rows[0].created_at);
      console.log(`   Vendor Identity Created: ${viCreated.toLocaleString()}`);
      
      if (referrals.rows.length > 0) {
        const refCreated = new Date(referrals.rows[0].created_at);
        console.log(`   Referral Record Created: ${refCreated.toLocaleString()}`);
        
        if (refCreated < viCreated) {
          console.log(`   ⚠️  Referral was created BEFORE vendor_identity!`);
          console.log(`   This means referral was processed during OTP verification.\n`);
        } else if (refCreated > viCreated) {
          console.log(`   ⚠️  Referral was created AFTER vendor_identity!`);
          console.log(`   This means referral was NOT linked during registration.\n`);
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (identity.rows.length > 0) {
      let metadata = identity.rows[0].metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }

      if (Object.keys(metadata).length === 0 || !metadata.referral_code_id) {
        console.log('❌ ROOT CAUSE: Referral code was NOT stored in vendor_identity.metadata');
        console.log('   The referral code was provided but not persisted during OTP verification.\n');
      }
    }

    if (referrals.rows.length === 0) {
      console.log('❌ ROOT CAUSE: No referral record found for this phone number');
      console.log('   The referral code was not linked to the vendor during registration.\n');
    } else if (referrals.rows[0].status !== 'approved') {
      console.log(`❌ ROOT CAUSE: Referral status is "${referrals.rows[0].status}", not "approved"`);
      console.log('   The approval endpoint did not process the referral.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

investigateNewVendorFlow();
