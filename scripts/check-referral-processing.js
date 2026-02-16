const { Pool } = require('pg');

async function checkReferralProcessing() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const newVendorId = 'fc0ffb3b-aeb2-4a0e-9726-3865acd4d88c';
    const vendorIdentityId = 'ae70b9fd-23a7-4396-8f63-bb8d2d835ffe';
    const phone = '2343478356';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  INVESTIGATING REFERRAL PROCESSING');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check vendor_identity metadata
    console.log('1️⃣  Checking vendor_identity for referral code...\n');
    const identity = await pool.query(
      `SELECT id, phone, metadata, onboarding_status, vendor_id
       FROM vendor_identity 
       WHERE id = $1 OR id = $2`,
      [newVendorId, vendorIdentityId]
    );

    if (identity.rows.length > 0) {
      const vi = identity.rows[0];
      console.log(`   Vendor Identity ID: ${vi.id}`);
      console.log(`   Phone: ${vi.phone}`);
      console.log(`   Onboarding Status: ${vi.onboarding_status}`);
      console.log(`   Vendor ID: ${vi.vendor_id || 'NULL'}`);
      
      let metadata = vi.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

      const referralCodeId = metadata?.referral_code_id;
      const referrerVendorId = metadata?.referrer_vendor_id;
      const referralCode = metadata?.referral_code;

      if (referralCodeId || referrerVendorId || referralCode) {
        console.log(`   ✅ Found referral info in metadata:`);
        if (referralCodeId) console.log(`      referral_code_id: ${referralCodeId}`);
        if (referrerVendorId) console.log(`      referrer_vendor_id: ${referrerVendorId}`);
        if (referralCode) console.log(`      referral_code: ${referralCode}`);
        console.log('');
      } else {
        console.log(`   ❌ No referral info found in metadata!\n`);
      }
    } else {
      console.log('   ❌ Vendor identity not found!\n');
    }

    // Step 2: Check vendor_referrals for this phone
    console.log('2️⃣  Checking vendor_referrals for this phone...\n');
    const normalizedPhone = phone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    console.log(`   Searching for phone: ${phone}, ${normalizedPhone}, ${fullPhone}\n`);
    
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
      console.log(`      Referral Code: ${ref.referral_code}`);
      console.log(`      Referrer Vendor ID: ${ref.referrer_vendor_id}`);
      console.log(`      Referred Phone: ${ref.referred_phone}`);
      console.log(`      Status: ${ref.status}`);
      console.log(`      Applied At: ${ref.applied_at || 'NULL'}`);
      console.log(`      Approved At: ${ref.approved_at || 'NULL'}`);
      console.log(`      Referred Vendor ID: ${ref.referred_vendor_id || 'NULL'}\n`);
    });

    // Step 3: Check if referral was processed
    if (referrals.rows.length > 0) {
      const referral = referrals.rows[0];
      console.log('3️⃣  Checking if referral was processed...\n');
      
      if (referral.status === 'approved' && referral.approved_at) {
        console.log(`   ✅ Referral was approved at: ${referral.approved_at}`);
        console.log(`   Referrer Vendor ID: ${referral.referrer_vendor_id}\n`);

        // Check referrer's wallet
        console.log('4️⃣  Checking referrer vendor wallet...\n');
        const referrerWallet = await pool.query(
          `SELECT vw.*, vlp.total_points, vlp.lifetime_points_earned
           FROM vendor_wallets vw
           LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
           WHERE vw.vendor_id = $1`,
          [referral.referrer_vendor_id]
        );

        if (referrerWallet.rows.length > 0) {
          const wallet = referrerWallet.rows[0];
          console.log(`   Referrer Wallet Balance: ₹${wallet.balance || 0}`);
          console.log(`   Referrer Points: ${wallet.total_points || 0}\n`);
        } else {
          console.log('   ⚠️  No wallet found for referrer vendor\n');
        }

        // Check recent transactions
        console.log('5️⃣  Checking referrer wallet transactions...\n');
        const transactions = await pool.query(
          `SELECT * FROM vendor_wallet_transactions vwt
           JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
           WHERE vw.vendor_id = $1
           ORDER BY vwt.created_at DESC
           LIMIT 5`,
          [referral.referrer_vendor_id]
        );

        console.log(`   Found ${transactions.rows.length} recent transaction(s):\n`);
        transactions.rows.forEach((tx, i) => {
          console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
          console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
          console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}`);
          console.log(`      Reference: ${tx.reference_type} - ${tx.reference_id || 'N/A'}\n`);
        });

        // Check loyalty transactions
        console.log('6️⃣  Checking referrer loyalty transactions...\n');
        const loyaltyTx = await pool.query(
          `SELECT * FROM vendor_loyalty_transactions
           WHERE vendor_id = $1
           ORDER BY created_at DESC
           LIMIT 5`,
          [referral.referrer_vendor_id]
        );

        console.log(`   Found ${loyaltyTx.rows.length} recent loyalty transaction(s):\n`);
        loyaltyTx.rows.forEach((tx, i) => {
          console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
          console.log(`      Points: ${tx.points}`);
          console.log(`      Type: ${tx.transaction_type}`);
          console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}`);
          console.log(`      Reference: ${tx.reference_type} - ${tx.reference_id || 'N/A'}\n`);
        });

      } else {
        console.log(`   ❌ Referral status is "${referral.status}", not "approved"`);
        console.log(`   Approved At: ${referral.approved_at || 'NULL'}\n`);
        console.log('   ⚠️  This means the referral was NOT processed during approval!\n');
      }
    } else {
      console.log('   ❌ No referral record found for this phone!\n');
    }

    // Step 4: Check application approval
    console.log('7️⃣  Checking application approval...\n');
    const application = await pool.query(
      `SELECT * FROM vendor_onboarding_applications 
       WHERE id = $1 OR vendor_identity_id = $2`,
      [newVendorId, vendorIdentityId]
    );

    if (application.rows.length > 0) {
      const app = application.rows[0];
      console.log(`   Application ID: ${app.id}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Reviewed At: ${app.reviewed_at || 'NULL'}`);
      console.log(`   Reviewed By: ${app.reviewed_by || 'NULL'}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (referrals.rows.length === 0) {
      console.log('❌ PROBLEM: No referral record found!');
      console.log('   The referral code was not stored or linked to this vendor.\n');
    } else if (referrals.rows[0].status !== 'approved') {
      console.log('❌ PROBLEM: Referral was not approved!');
      console.log(`   Status: ${referrals.rows[0].status}`);
      console.log('   The approval endpoint did not process the referral.\n');
      console.log('   SOLUTION: Need to manually process the referral.\n');
    } else {
      console.log('✅ Referral was approved, checking if points were awarded...\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkReferralProcessing();
