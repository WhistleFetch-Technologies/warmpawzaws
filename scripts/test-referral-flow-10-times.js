const { Pool } = require('pg');
const https = require('https');
const { randomUUID } = require('crypto');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

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

async function testSingleReferralFlow(testNumber) {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  TEST ${testNumber}/10`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    // Generate unique test phone
    const testPhone = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;

    console.log(`Test Phone: ${normalizedPhone} (${fullPhone})`);
    console.log(`Referral Code: ${REFERRAL_CODE}\n`);

    // Step 1: Check Shreesha's wallet before
    const beforeWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const beforeBalance = beforeWallet.response.wallet?.balance || 0;

    // Step 2: Get referrer vendor ID
    const codeLookup = await pool.query(
      `SELECT DISTINCT referrer_vendor_id FROM vendor_referrals 
       WHERE referral_code = $1 
       LIMIT 1`,
      [REFERRAL_CODE]
    );

    if (codeLookup.rows.length === 0) {
      console.log('❌ Referral code not found!\n');
      return { success: false, reason: 'Referral code not found' };
    }

    const referrerVendorId = codeLookup.rows[0].referrer_vendor_id;

    // Step 3: Create referral record (simulating OTP verification)
    const newReferral = await pool.query(
      `INSERT INTO vendor_referrals 
       (referrer_vendor_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
       RETURNING *`,
      [referrerVendorId, REFERRAL_CODE, fullPhone]
    );
    
    const referralRecord = newReferral.rows[0];
    console.log(`✅ Created referral record: ${referralRecord.id}\n`);

    // Step 4: Create vendor_identity with referral in metadata
    const vendorIdentityId = randomUUID();
    
    const metadata = {
      referral_code_id: referralRecord.id,
      referrer_vendor_id: referrerVendorId,
      referral_code: REFERRAL_CODE,
    };

    await pool.query(
      `INSERT INTO vendor_identity 
       (id, phone, onboarding_status, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [vendorIdentityId, normalizedPhone, 'FORM_PENDING', JSON.stringify(metadata)]
    );

    console.log(`✅ Created vendor_identity: ${vendorIdentityId}\n`);

    // Step 5: Create application
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
          businessName: `Test Vendor ${Date.now()}`,
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

    // Link application_id to vendor_identity
    await pool.query(
      `UPDATE vendor_identity 
       SET application_id = $1
       WHERE id = $2`,
      [applicationId, vendorIdentityId]
    );

    console.log(`✅ Created application: ${applicationId}\n`);

    // Step 6: Approve application
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      'POST'
    );

    if (approveResult.statusCode !== 200) {
      console.log(`❌ Approval failed: ${JSON.stringify(approveResult.response)}\n`);
      return { success: false, reason: 'Approval failed' };
    }

    console.log(`✅ Application approved\n`);

    // Step 7: Wait and check wallet
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const afterBalance = afterWallet.response.wallet?.balance || 0;
    
    const balanceIncrease = afterBalance - beforeBalance;
    
    console.log(`Before: ₹${beforeBalance}`);
    console.log(`After: ₹${afterBalance}`);
    console.log(`Increase: ₹${balanceIncrease.toFixed(2)}\n`);

    if (balanceIncrease > 0) {
      console.log(`✅ SUCCESS: Points awarded automatically!\n`);
      return { success: true, balanceIncrease };
    } else {
      console.log(`❌ FAILURE: Points NOT awarded!\n`);
      return { success: false, reason: 'Points not awarded' };
    }

  } catch (error) {
    console.error(`❌ Error:`, error);
    return { success: false, reason: error.message };
  } finally {
    await pool.end();
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTING REFERRAL FLOW 10 TIMES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];
  
  for (let i = 1; i <= 10; i++) {
    const result = await testSingleReferralFlow(i);
    results.push(result);
    
    // Wait 2 seconds between tests
    if (i < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FINAL RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}\n`);

  if (successful >= 8) {
    console.log('✅ SUCCESS: Flow is working correctly!\n');
  } else {
    console.log('❌ FAILURE: Flow needs more fixes\n');
  }

  results.forEach((r, i) => {
    console.log(`Test ${i + 1}: ${r.success ? '✅ PASS' : '❌ FAIL'} ${r.reason ? `(${r.reason})` : ''}`);
  });
}

runTests().catch(console.error);
