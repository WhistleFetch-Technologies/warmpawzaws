const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

const NEW_VENDOR_ID = 'b2cf522e-4456-4441-bdf8-3875baa702be';
const NEW_VENDOR_PHONE = '6583548643';
const APPLICATION_ID = '5c4c6432-871a-498f-8f50-311a7b2e4c74';
const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';
const SHREESHA_VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
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
    req.end();
  });
}

async function investigateMissingReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  INVESTIGATING MISSING REFERRAL PROCESSING');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check vendor_identity metadata
    console.log('1️⃣  Checking vendor_identity metadata...\n');
    const identity = await pool.query(
      `SELECT id, phone, vendor_id, metadata, onboarding_status
       FROM vendor_identity 
       WHERE id = $1 OR phone = $2`,
      [NEW_VENDOR_ID, NEW_VENDOR_PHONE]
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

      if (metadata.referral_code_id || metadata.referral_code || metadata.referrer_vendor_id) {
        console.log('   ✅ Referral info found in metadata!\n');
      } else {
        console.log('   ❌ No referral info in metadata!\n');
      }
    } else {
      console.log('   ❌ Vendor identity not found!\n');
    }

    // Step 2: Check vendor_referrals
    console.log('2️⃣  Checking vendor_referrals...\n');
    const normalizedPhone = NEW_VENDOR_PHONE.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;
    
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE (referred_phone = $1 OR referred_phone = $2 OR referred_phone = $3 OR referred_vendor_id = $4)
       AND referral_code = $5`,
      [fullPhone, NEW_VENDOR_PHONE, normalizedPhone, NEW_VENDOR_ID, REFERRAL_CODE]
    );

    console.log(`   Found ${referrals.rows.length} referral record(s):\n`);
    referrals.rows.forEach((ref, i) => {
      console.log(`   ${i + 1}. Referral ID: ${ref.id}`);
      console.log(`      Code: ${ref.referral_code}`);
      console.log(`      Referrer: ${ref.referrer_vendor_id}`);
      console.log(`      Referred Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`      Referred Vendor ID: ${ref.referred_vendor_id || 'NULL'}`);
      console.log(`      Status: ${ref.status}`);
      console.log(`      Applied At: ${ref.applied_at || 'NULL'}`);
      console.log(`      Approved At: ${ref.approved_at || 'NULL'}\n`);
    });

    // Step 3: Check application
    console.log('3️⃣  Checking application...\n');
    const application = await pool.query(
      `SELECT * FROM vendor_onboarding_applications WHERE id = $1`,
      [APPLICATION_ID]
    );

    if (application.rows.length > 0) {
      const app = application.rows[0];
      console.log(`   Application ID: ${app.id}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Reviewed At: ${app.reviewed_at || 'NULL'}`);
      console.log(`   Reviewed By: ${app.reviewed_by || 'NULL'}\n`);
    }

    // Step 4: Check vendor record
    console.log('4️⃣  Checking vendor record...\n');
    const vendor = await pool.query(
      `SELECT id, business_name, phone, status FROM vendors WHERE id = $1 OR id = $2`,
      [NEW_VENDOR_ID, identity.rows[0]?.vendor_id]
    );

    if (vendor.rows.length > 0) {
      console.log(`   Vendor ID: ${vendor.rows[0].id}`);
      console.log(`   Name: ${vendor.rows[0].business_name}`);
      console.log(`   Status: ${vendor.rows[0].status}\n`);
    } else {
      console.log('   ⚠️  Vendor not found in vendors table\n');
    }

    // Step 5: Check Shreesha's wallet
    console.log('5️⃣  Checking Shreesha\'s wallet...\n');
    const wallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    
    if (wallet.statusCode === 200 && wallet.response.success) {
      console.log(`   Balance: ₹${wallet.response.wallet?.balance || 0}`);
      console.log(`   Points: ${wallet.response.loyalty_points?.total_points || 0}\n`);
    }

    // Step 6: Check recent transactions
    console.log('6️⃣  Checking Shreesha\'s recent transactions...\n');
    const txResult = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet/transactions?limit=5`);
    
    if (txResult.statusCode === 200 && txResult.response.success) {
      console.log(`   Found ${txResult.response.transactions?.length || 0} transaction(s):\n`);
      txResult.response.transactions?.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
        console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
        console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (referrals.rows.length === 0) {
      console.log('❌ PROBLEM: No referral record found for this vendor!');
      console.log('   The referral code was not linked during registration.\n');
    } else if (referrals.rows[0].status !== 'approved') {
      console.log('❌ PROBLEM: Referral was not approved!');
      console.log(`   Status: ${referrals.rows[0].status}`);
      console.log('   The approval endpoint did not process the referral.\n');
    } else {
      console.log('✅ Referral was approved, but points may not have been awarded.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

investigateMissingReferral();
