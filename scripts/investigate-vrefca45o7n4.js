const { Pool } = require('pg');

async function investigateReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const referralCode = 'VREFCA45O7N4';
    const newVendorId = 'd6e9a9d9-6466-4317-957f-edf849944211';
    const newVendorPhone = '3242342342';
    const referrerVendorId = '250a0ba2-823e-4bd7-a943-d509e5eb4655'; // Shreesha's Vet Solo

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  INVESTIGATING REFERRAL CODE: VREFCA45O7N4');
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

      // Check if referrer matches
      if (ref.referrer_vendor_id !== referrerVendorId) {
        console.log(`   ⚠️  Referrer mismatch! Expected: ${referrerVendorId}, Got: ${ref.referrer_vendor_id}\n`);
      }
    } else {
      console.log('   ❌ Referral code not found!\n');
    }

    // Step 2: Check vendor_identity metadata
    console.log('2️⃣  Checking vendor_identity metadata...\n');
    const identity = await pool.query(
      `SELECT id, phone, metadata, vendor_id, onboarding_status
       FROM vendor_identity 
       WHERE id = $1 OR vendor_id = $1 OR phone = $2`,
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

      if (metadata.referral_code_id || metadata.referrer_vendor_id || metadata.referral_code) {
        console.log('   ✅ Referral info found in metadata\n');
      } else {
        console.log('   ❌ No referral info in metadata!\n');
      }
    } else {
      console.log('   ❌ Vendor identity not found!\n');
    }

    // Step 3: Check vendor_referrals by phone
    console.log('3️⃣  Checking vendor_referrals by phone...\n');
    const normalizedPhone = newVendorPhone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    const referralsByPhone = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1 
       OR referred_phone = $2
       OR referred_phone = $3`,
      [fullPhone, newVendorPhone, normalizedPhone]
    );

    console.log(`   Found ${referralsByPhone.rows.length} referral(s) for this phone:\n`);
    referralsByPhone.rows.forEach((ref, i) => {
      console.log(`   ${i + 1}. Code: ${ref.referral_code}`);
      console.log(`      Referrer: ${ref.referrer_vendor_id}`);
      console.log(`      Status: ${ref.status}\n`);
    });

    // Step 4: Check referrer vendor wallet
    console.log('4️⃣  Checking referrer vendor wallet...\n');
    const referrerWallet = await pool.query(
      `SELECT vw.*, vlp.total_points, vlp.lifetime_points_earned
       FROM vendor_wallets vw
       LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
       WHERE vw.vendor_id = $1`,
      [referrerVendorId]
    );

    if (referrerWallet.rows.length > 0) {
      console.log(`   Wallet Balance: ₹${referrerWallet.rows[0].balance || 0}`);
      console.log(`   Points: ${referrerWallet.rows[0].total_points || 0}`);
      console.log(`   Lifetime Earned: ${referrerWallet.rows[0].lifetime_points_earned || 0}\n`);
    } else {
      console.log('   ⚠️  No wallet found for referrer vendor\n');
    }

    // Step 5: Check referrer transactions
    console.log('5️⃣  Checking referrer transactions...\n');
    const transactions = await pool.query(
      `SELECT * FROM vendor_wallet_transactions vwt
       JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
       WHERE vw.vendor_id = $1
       ORDER BY vwt.created_at DESC
       LIMIT 5`,
      [referrerVendorId]
    );

    console.log(`   Found ${transactions.rows.length} transaction(s):\n`);
    transactions.rows.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
      console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
      console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
    });

    // Step 6: Check application status
    console.log('6️⃣  Checking application status...\n');
    const application = await pool.query(
      `SELECT * FROM vendor_onboarding_applications 
       WHERE vendor_identity_id = $1 OR id = $2`,
      [identity.rows[0]?.id || newVendorId, newVendorId]
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

    if (referral.rows.length > 0) {
      const ref = referral.rows[0];
      if (ref.status !== 'approved') {
        console.log('❌ PROBLEM: Referral was not approved!');
        console.log(`   Status: ${ref.status}`);
        console.log('   The approval endpoint did not process the referral.\n');
      } else {
        console.log('✅ Referral was approved, but points may not have been awarded.\n');
      }
    } else {
      console.log('❌ PROBLEM: Referral record not found or not linked!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

investigateReferral();
