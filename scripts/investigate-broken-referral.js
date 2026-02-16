const { Pool } = require('pg');

async function investigateBrokenReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const vendorIdentityId = 'd3120966-b543-414d-9d25-408756899272';
    const phone = '7963456465';
    const applicationId = '3926bb35-84db-4f1c-8d49-96cd83740be0';
    const referralCode = 'VREFCA45O7N4';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  INVESTIGATING BROKEN REFERRAL FLOW');
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

      if (metadata.referral_code_id || metadata.referral_code) {
        console.log('   ✅ Referral code found in metadata!\n');
      } else {
        console.log('   ❌ PROBLEM: Referral code NOT in metadata!\n');
      }
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

    // Step 4: Check Shreesha's wallet
    console.log('4️⃣  Checking Shreesha\'s wallet...\n');
    const shreeshaVendorId = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';
    const wallet = await pool.query(
      `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
      [shreeshaVendorId]
    );

    if (wallet.rows.length > 0) {
      console.log(`   Balance: ₹${wallet.rows[0].balance}`);
      console.log(`   Wallet ID: ${wallet.rows[0].id}\n`);
    } else {
      console.log('   ⚠️  No wallet found\n');
    }

    // Step 5: Check recent transactions
    console.log('5️⃣  Checking recent wallet transactions...\n');
    if (wallet.rows.length > 0) {
      const transactions = await pool.query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [wallet.rows[0].id]
      );

      console.log(`   Found ${transactions.rows.length} recent transaction(s):\n`);
      transactions.rows.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
        console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
        console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
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

investigateBrokenReferral();
