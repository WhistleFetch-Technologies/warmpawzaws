const { Pool } = require('pg');
const https = require('https');
const { randomUUID } = require('crypto');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';
const SHREESHA_VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';

// Generate test phone
const testPhone = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
const fullPhone = `+91${normalizedPhone}`;

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

async function testCompleteFlow() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING COMPLETE REFERRAL FLOW (SIMULATED)');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Test Phone: ${normalizedPhone}`);
    console.log(`Referral Code: ${REFERRAL_CODE}\n`);

    // Step 1: Check Shreesha's wallet
    console.log('1️⃣  Checking Shreesha\'s wallet...\n');
    const beforeWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const beforeBalance = beforeWallet.response.wallet?.balance || 0;
    console.log(`   Balance: ₹${beforeBalance}\n`);

    // Step 2: Simulate OTP verification with referral code
    console.log('2️⃣  Simulating OTP verification with referral code...\n');
    console.log('   (This would normally happen when vendor enters referral code during registration)\n');
    
    // Check if referral code exists and get referrer
    const codeLookup = await pool.query(
      `SELECT DISTINCT referrer_vendor_id FROM vendor_referrals 
       WHERE referral_code = $1 
       LIMIT 1`,
      [REFERRAL_CODE]
    );

    if (codeLookup.rows.length === 0) {
      console.log('❌ Referral code not found!\n');
      return;
    }

    const referrerVendorId = codeLookup.rows[0].referrer_vendor_id;
    console.log(`   Referrer Vendor ID: ${referrerVendorId}\n`);

    // Check if referral record exists for this phone
    const existingReferral = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referral_code = $1 
       AND referred_phone = $2
       LIMIT 1`,
      [REFERRAL_CODE, fullPhone]
    );

    let referralRecord;
    if (existingReferral.rows.length > 0) {
      referralRecord = existingReferral.rows[0];
      console.log(`   Found existing referral record: ${referralRecord.id}\n`);
    } else {
      // Create new referral record (this is what the fixed code should do)
      const newReferral = await pool.query(
        `INSERT INTO vendor_referrals 
         (referrer_vendor_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
         RETURNING *`,
        [referrerVendorId, REFERRAL_CODE, fullPhone]
      );
      referralRecord = newReferral.rows[0];
      console.log(`   ✅ Created referral record: ${referralRecord.id}\n`);
    }

    // Step 3: Create vendor_identity with referral in metadata (simulating OTP verification)
    console.log('3️⃣  Creating vendor_identity with referral code in metadata...\n');
    const vendorIdentityId = randomUUID();
    
    await pool.query(
      `INSERT INTO vendor_identity 
       (id, phone, onboarding_status, metadata)
       VALUES ($1, $2, 'INIT', $3::jsonb)`,
      [
        vendorIdentityId,
        normalizedPhone,
        JSON.stringify({
          referral_code_id: referralRecord.id,
          referrer_vendor_id: referrerVendorId,
          referral_code: REFERRAL_CODE,
        })
      ]
    );

    console.log(`   ✅ Created vendor_identity: ${vendorIdentityId}\n`);

    // Step 4: Create application
    console.log('4️⃣  Creating application...\n');
    const applicationId = randomUUID();
    
    await pool.query(
      `INSERT INTO vendor_onboarding_applications
       (id, vendor_identity_id, role_id, vendor_type, status, application_payload, form_version, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        applicationId,
        vendorIdentityId,
        '072548c8-84a9-4165-a9ec-0387c8c76a0e',
        'solo',
        'SUBMITTED',
        JSON.stringify({
          phone: normalizedPhone,
          businessName: 'Test Vendor',
          fullName: 'Test User',
          email: `test${Date.now()}@test.com`,
          address: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pin: '123456',
        }),
        '1.0'
      ]
    );

    console.log(`   ✅ Created application: ${applicationId}\n`);

    // Step 5: Approve application via API
    console.log('5️⃣  Approving application via admin API...\n');
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      'POST'
    );

    console.log(`   Status: ${approveResult.statusCode}`);
    if (approveResult.statusCode === 200) {
      console.log(`   ✅ Application approved!\n`);
    } else {
      console.log(`   ❌ Error: ${JSON.stringify(approveResult.response, null, 2)}\n`);
      return;
    }

    // Step 6: Wait and check wallet
    console.log('6️⃣  Waiting for referral processing...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const afterBalance = afterWallet.response.wallet?.balance || 0;
    
    console.log(`   Before: ₹${beforeBalance}`);
    console.log(`   After: ₹${afterBalance}`);
    console.log(`   Increase: ₹${(afterBalance - beforeBalance).toFixed(2)}\n`);

    if (afterBalance > beforeBalance) {
      console.log('✅ SUCCESS: Points were awarded automatically by the flow!\n');
    } else {
      console.log('❌ FAILURE: Points were NOT awarded automatically!\n');
      console.log('   The approval endpoint did not process the referral.\n');
    }

    // Check transactions
    const txResult = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet/transactions?limit=5`);
    
    if (txResult.statusCode === 200 && txResult.response.success) {
      const recentTx = txResult.response.transactions?.filter(tx => 
        new Date(tx.created_at) > new Date(Date.now() - 60000) // Last minute
      );
      
      if (recentTx && recentTx.length > 0) {
        console.log(`Recent Transactions (${recentTx.length}):\n`);
        recentTx.forEach((tx, i) => {
          console.log(`${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
          console.log(`   Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}\n`);
        });
      }
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Test Vendor Identity ID: ${vendorIdentityId}`);
    console.log(`Test Application ID: ${applicationId}`);
    console.log(`Test Phone: ${normalizedPhone}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testCompleteFlow();
