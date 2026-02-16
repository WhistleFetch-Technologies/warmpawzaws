const { Pool } = require('pg');

async function investigateNewVendorReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const referralCode = 'VREFCA45O7N4';
    const newVendorId = '8cbcf701-864b-49c1-9286-9408e2d2f5a2';
    const newVendorPhone = '03469999999';
    const applicationId = 'd94679d2-ea35-4289-9e58-6f59738f09e1';
    const userCheckingVendorId = '250a0ba2-823e-4bd7-a943-d509e5eb4655';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  INVESTIGATING NEW VENDOR REFERRAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check referral record
    console.log('1️⃣  Checking referral record...\n');
    const referral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referral_code = $1`,
      [referralCode]
    );

    if (referral.rows.length > 0) {
      const ref = referral.rows[0];
      console.log(`   Referral ID: ${ref.id}`);
      console.log(`   Code: ${ref.referral_code}`);
      console.log(`   Referrer Vendor ID: ${ref.referrer_vendor_id}`);
      console.log(`   Referred Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`   Referred Vendor ID: ${ref.referred_vendor_id || 'NULL'}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Applied At: ${ref.applied_at || 'NULL'}`);
      console.log(`   Approved At: ${ref.approved_at || 'NULL'}\n`);

      // Check referrer vendor
      const referrer = await pool.query(
        `SELECT id, business_name, phone FROM vendors WHERE id = $1`,
        [ref.referrer_vendor_id]
      );

      if (referrer.rows.length > 0) {
        console.log(`   Referrer: ${referrer.rows[0].business_name || referrer.rows[0].phone}`);
        console.log(`   Referrer ID: ${referrer.rows[0].id}\n`);
      }
    } else {
      console.log('   ❌ Referral code not found!\n');
    }

    // Step 2: Check new vendor
    console.log('2️⃣  Checking new vendor...\n');
    const newVendor = await pool.query(
      `SELECT id, business_name, phone, status FROM vendors WHERE id = $1`,
      [newVendorId]
    );

    if (newVendor.rows.length > 0) {
      console.log(`   Vendor ID: ${newVendor.rows[0].id}`);
      console.log(`   Name: ${newVendor.rows[0].business_name}`);
      console.log(`   Phone: ${newVendor.rows[0].phone}`);
      console.log(`   Status: ${newVendor.rows[0].status}\n`);
    } else {
      console.log('   ⚠️  Vendor not found in vendors table\n');
    }

    // Step 3: Check vendor_identity
    console.log('3️⃣  Checking vendor_identity...\n');
    const identity = await pool.query(
      `SELECT id, phone, vendor_id, metadata, onboarding_status
       FROM vendor_identity 
       WHERE id = $1 OR phone = $2`,
      [newVendorId, newVendorPhone]
    );

    if (identity.rows.length > 0) {
      const vi = identity.rows[0];
      console.log(`   Vendor Identity ID: ${vi.id}`);
      console.log(`   Phone: ${vi.phone}`);
      console.log(`   Vendor ID: ${vi.vendor_id || 'NULL'}`);
      console.log(`   Onboarding Status: ${vi.onboarding_status}`);
      
      let metadata = vi.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);
    }

    // Step 4: Check application
    console.log('4️⃣  Checking application...\n');
    const application = await pool.query(
      `SELECT * FROM vendor_onboarding_applications WHERE id = $1`,
      [applicationId]
    );

    if (application.rows.length > 0) {
      const app = application.rows[0];
      console.log(`   Application ID: ${app.id}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Reviewed At: ${app.reviewed_at || 'NULL'}`);
      console.log(`   Reviewed By: ${app.reviewed_by || 'NULL'}\n`);
    }

    // Step 5: Check vendor_referrals by phone
    console.log('5️⃣  Checking vendor_referrals by phone...\n');
    const normalizedPhone = newVendorPhone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    const referralsByPhone = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1 
       OR referred_phone = $2
       OR referred_phone = $3
       OR referred_vendor_id = $4`,
      [fullPhone, newVendorPhone, normalizedPhone, newVendorId]
    );

    console.log(`   Found ${referralsByPhone.rows.length} referral(s):\n`);
    referralsByPhone.rows.forEach((ref, i) => {
      console.log(`   ${i + 1}. Code: ${ref.referral_code}`);
      console.log(`      Referrer: ${ref.referrer_vendor_id}`);
      console.log(`      Status: ${ref.status}`);
      console.log(`      Approved At: ${ref.approved_at || 'NULL'}\n`);
    });

    // Step 6: Check the vendor ID user is checking
    console.log('6️⃣  Checking vendor ID user is checking...\n');
    const userVendor = await pool.query(
      `SELECT id, business_name, phone FROM vendors WHERE id = $1`,
      [userCheckingVendorId]
    );

    if (userVendor.rows.length > 0) {
      console.log(`   Vendor ID: ${userVendor.rows[0].id}`);
      console.log(`   Name: ${userVendor.rows[0].business_name}`);
      console.log(`   Phone: ${userVendor.rows[0].phone}\n`);
    } else {
      console.log(`   ⚠️  Vendor ${userCheckingVendorId} NOT FOUND in vendors table\n`);
      
      // Check if it resolves to another vendor
      const identityCheck = await pool.query(
        `SELECT id, vendor_id FROM vendor_identity WHERE id = $1`,
        [userCheckingVendorId]
      );
      
      if (identityCheck.rows.length > 0) {
        console.log(`   But found in vendor_identity with vendor_id: ${identityCheck.rows[0].vendor_id || 'NULL'}\n`);
      }
    }

    // Step 7: Check all vendors with referral code
    console.log('7️⃣  Checking all vendors who own referral code VREFCA45O7N4...\n');
    const allReferrals = await pool.query(
      `SELECT vr.*, v.business_name, v.phone
       FROM vendor_referrals vr
       LEFT JOIN vendors v ON vr.referrer_vendor_id = v.id
       WHERE vr.referral_code = $1`,
      [referralCode]
    );

    allReferrals.rows.forEach((ref, i) => {
      console.log(`   ${i + 1}. Referrer Vendor ID: ${ref.referrer_vendor_id}`);
      console.log(`      Business Name: ${ref.business_name || 'NULL'}`);
      console.log(`      Phone: ${ref.phone || 'NULL'}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

investigateNewVendorReferral();
