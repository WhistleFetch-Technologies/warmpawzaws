const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

const APPLICATION_ID = 'bd05d99a-0784-46b1-86ff-63ccf9e1bd63';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';

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

async function testNewVendorApproval() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING NEW VENDOR APPROVAL WITH REFERRAL CODE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check Shreesha's wallet before
    console.log('1️⃣  Checking Shreesha\'s wallet before approval...\n');
    const beforeWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const beforeBalance = beforeWallet.response.wallet?.balance || 0;
    console.log(`   Balance: ₹${beforeBalance}\n`);

    // Step 2: Check vendor_identity metadata
    console.log('2️⃣  Checking vendor_identity metadata...\n');
    const app = await pool.query(
      `SELECT voa.*, vi.metadata, vi.phone
       FROM vendor_onboarding_applications voa
       JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
       WHERE voa.id = $1`,
      [APPLICATION_ID]
    );

    if (app.rows.length > 0) {
      const application = app.rows[0];
      console.log(`   Application ID: ${application.id}`);
      console.log(`   Status: ${application.status}`);
      console.log(`   Phone: ${application.phone}`);
      
      let metadata = application.metadata;
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
        console.log('   ❌ Referral code NOT in metadata!\n');
      }
    }

    // Step 3: Approve the application
    console.log('3️⃣  Approving application...\n');
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${APPLICATION_ID}/approve`,
      'POST'
    );

    console.log(`   Status: ${approveResult.statusCode}`);
    if (approveResult.statusCode === 200) {
      console.log(`   ✅ Application approved!\n`);
    } else {
      console.log(`   ❌ Error: ${JSON.stringify(approveResult.response, null, 2)}\n`);
      return;
    }

    // Step 4: Wait for processing
    console.log('4️⃣  Waiting for referral processing...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Check Shreesha's wallet after
    console.log('5️⃣  Checking Shreesha\'s wallet after approval...\n');
    const afterWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const afterBalance = afterWallet.response.wallet?.balance || 0;
    
    console.log(`   Before: ₹${beforeBalance}`);
    console.log(`   After: ₹${afterBalance}`);
    console.log(`   Increase: ₹${(afterBalance - beforeBalance).toFixed(2)}\n`);

    if (afterBalance > beforeBalance) {
      console.log('✅ SUCCESS: Points were awarded automatically!\n');
    } else {
      console.log('❌ FAILURE: Points were NOT awarded automatically!\n');
    }

    // Check transactions
    const txResult = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet/transactions?limit=3`);
    
    if (txResult.statusCode === 200 && txResult.response.success) {
      console.log(`Recent Transactions (${txResult.response.transactions?.length || 0}):\n`);
      txResult.response.transactions?.forEach((tx, i) => {
        console.log(`${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
        console.log(`   Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
        console.log(`   Created: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testNewVendorApproval();
