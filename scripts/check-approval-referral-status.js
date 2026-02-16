const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

const VENDOR_IDENTITY_ID = '400bfec0-4def-4d36-8c46-9290ed97a96f';
const VENDOR_ID = '400bfec0-4def-4d36-8c46-9290ed97a96f'; // Same as identity ID if approved
const PHONE = '5767543675';
const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';
const SHREESHA_VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, response: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, response: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function checkApprovalStatus() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CHECKING REFERRAL STATUS AFTER APPROVAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check vendor_identity metadata
    console.log('1️⃣  Checking vendor_identity metadata...\n');
    const identity = await pool.query(
      `SELECT id, phone, vendor_id, metadata, onboarding_status, application_id, created_at
       FROM vendor_identity 
       WHERE id = $1 OR phone = $2`,
      [VENDOR_IDENTITY_ID, PHONE]
    );

    if (identity.rows.length === 0) {
      console.log('❌ CRITICAL: vendor_identity NOT FOUND!\n');
      return;
    }

    const vi = identity.rows[0];
    console.log(`   Vendor Identity ID: ${vi.id}`);
    console.log(`   Phone: ${vi.phone}`);
    console.log(`   Vendor ID: ${vi.vendor_id || 'NULL'}`);
    console.log(`   Onboarding Status: ${vi.onboarding_status}`);
    console.log(`   Application ID: ${vi.application_id || 'NULL'}`);
    
    let metadata = vi.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }
    console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

    const hasMetadata = !!(metadata.referral_code_id || metadata.referral_code);
    if (hasMetadata) {
      console.log('   ✅ Referral code FOUND in metadata!\n');
    } else {
      console.log('   ❌ Referral code NOT in metadata\n');
    }

    // Step 2: Check vendor_referrals
    console.log('2️⃣  Checking vendor_referrals...\n');
    const normalizedPhone = PHONE.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE (referred_phone = $1 OR referred_phone = $2 OR referred_phone = $3 OR referred_vendor_id = $4)
       AND referral_code = $5
       ORDER BY created_at DESC`,
      [fullPhone, PHONE, normalizedPhone, vi.vendor_id || VENDOR_ID, REFERRAL_CODE]
    );

    console.log(`   Found ${referrals.rows.length} referral record(s):\n`);
    if (referrals.rows.length === 0) {
      console.log('   ❌ No referral record found!\n');
    } else {
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
    }

    // Step 3: Check Shreesha's wallet
    console.log('3️⃣  Checking Shreesha\'s wallet (AFTER approval)...\n');
    const wallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const currentBalance = wallet.response.wallet?.balance || 0;
    console.log(`   Current Balance: ₹${currentBalance}\n`);

    // Step 4: Check recent wallet transactions
    console.log('4️⃣  Checking recent wallet transactions...\n');
    let transactions = { rows: [] };
    if (wallet.response.wallet?.wallet_id) {
      transactions = await pool.query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [wallet.response.wallet.wallet_id]
      );

      console.log(`   Found ${transactions.rows.length} recent transaction(s):\n`);
      transactions.rows.forEach((tx, i) => {
        const isRecent = new Date(tx.created_at) > new Date(Date.now() - 10 * 60 * 1000); // Last 10 minutes
        const marker = isRecent ? '🆕' : '  ';
        console.log(`   ${marker} ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
        console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
        console.log(`      Balance After: ₹${tx.balance_after}`);
        console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

    // Step 5: Check loyalty transactions
    console.log('5️⃣  Checking recent loyalty transactions...\n');
    const loyaltyPoints = await pool.query(
      `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [SHREESHA_VENDOR_ID]
    );

    if (loyaltyPoints.rows.length > 0) {
      const loyaltyTx = await pool.query(
        `SELECT * FROM vendor_loyalty_transactions 
         WHERE vendor_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [SHREESHA_VENDOR_ID]
      );

      console.log(`   Found ${loyaltyTx.rows.length} recent loyalty transaction(s):\n`);
      loyaltyTx.rows.forEach((tx, i) => {
        const isRecent = new Date(tx.created_at) > new Date(Date.now() - 10 * 60 * 1000);
        const marker = isRecent ? '🆕' : '  ';
        console.log(`   ${marker} ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
        console.log(`      Points: ${tx.points > 0 ? '+' : ''}${tx.points}`);
        console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

    // Step 6: Final verdict
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FINAL VERDICT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const referralApproved = referrals.rows.length > 0 && referrals.rows[0].status === 'approved';
    const hasRecentTransaction = wallet.response.wallet?.wallet_id && 
      transactions.rows.length > 0 && 
      transactions.rows[0].description?.includes('referral') &&
      new Date(transactions.rows[0].created_at) > new Date(Date.now() - 10 * 60 * 1000);

    if (referralApproved) {
      console.log('✅ Referral record status: APPROVED');
    } else if (referrals.rows.length > 0) {
      console.log(`⚠️  Referral record status: ${referrals.rows[0].status} (not approved)`);
    } else {
      console.log('❌ No referral record found');
    }

    if (hasRecentTransaction) {
      console.log('✅ Recent referral transaction found in wallet');
      console.log(`✅ Points were awarded! Balance increased by ₹${transactions.rows[0].amount}\n`);
    } else {
      console.log('❌ No recent referral transaction found');
      console.log('❌ Points were NOT awarded\n');
    }

    if (referralApproved && hasRecentTransaction) {
      console.log('🎉 SUCCESS: Referral was processed and points were awarded!\n');
    } else {
      console.log('⚠️  ISSUE: Referral may not have been processed correctly\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkApprovalStatus();
