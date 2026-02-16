const { Pool } = require('pg');
const https = require('https');
const { randomUUID } = require('crypto');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';
const SHREESHA_VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';

function makeRequest(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: { ...defaultHeaders, ...headers },
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

async function testCompleteFlow(testNumber) {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  TEST ${testNumber}: COMPLETE AUTOMATIC REFERRAL FLOW`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    // Generate unique test phone
    const testPhone = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;

    console.log(`📱 Test Phone: ${normalizedPhone} (${fullPhone})`);
    console.log(`🎫 Referral Code: ${REFERRAL_CODE}\n`);

    // Step 1: Check Shreesha's wallet BEFORE
    const beforeWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const beforeBalance = beforeWallet.response.wallet?.balance || 0;
    console.log(`💰 Shreesha's wallet BEFORE: ₹${beforeBalance}\n`);

    // Step 2: Send OTP (simulating frontend)
    console.log('1️⃣  Sending OTP...\n');
    const sendOtpResult = await makeRequest(
      `${API_BASE_URL}/auth/send-otp`,
      'POST',
      {
        phone: fullPhone,
        role: 'vendor'
      }
    );

    if (sendOtpResult.statusCode !== 200) {
      console.log(`❌ Failed to send OTP: ${JSON.stringify(sendOtpResult.response)}\n`);
      return { success: false, reason: 'OTP send failed' };
    }

    console.log('✅ OTP sent successfully\n');

    // Step 3: Verify OTP WITH REFERRAL CODE (simulating frontend)
    console.log('2️⃣  Verifying OTP WITH REFERRAL CODE...\n');
    console.log('   (This simulates: User enters referral code, clicks Apply, enters OTP, clicks Verify)\n');
    
    const verifyOtpResult = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      'POST',
      {
        phone: fullPhone,
        otp: '123456', // UAT mode OTP
        role: 'vendor',
        referralCode: REFERRAL_CODE  // ✅ KEY: Referral code in request body
      }
    );

    if (verifyOtpResult.statusCode !== 200) {
      console.log(`❌ OTP verification failed: ${JSON.stringify(verifyOtpResult.response)}\n`);
      return { success: false, reason: 'OTP verification failed' };
    }

    console.log('✅ OTP verified successfully\n');

    // Step 4: Wait for DB update
    console.log('3️⃣  Waiting for database update (3 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 5: Check vendor_identity metadata
    console.log('4️⃣  Checking vendor_identity metadata...\n');
    const identity = await pool.query(
      `SELECT id, phone, metadata, onboarding_status, created_at
       FROM vendor_identity 
       WHERE phone = $1 OR phone = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedPhone, fullPhone.replace('+', '')]
    );

    if (identity.rows.length === 0) {
      console.log('❌ vendor_identity NOT FOUND!\n');
      return { success: false, reason: 'vendor_identity not found' };
    }

    const vi = identity.rows[0];
    console.log(`   Vendor Identity ID: ${vi.id}`);
    console.log(`   Phone: ${vi.phone}`);
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

    const hasReferralInMetadata = !!(metadata.referral_code_id || metadata.referral_code);
    if (hasReferralInMetadata) {
      console.log('   ✅ SUCCESS: Referral code stored in metadata!\n');
    } else {
      console.log('   ❌ FAILURE: Referral code NOT in metadata!\n');
      console.log('   ⚠️  This is the problem - referral code was not stored during OTP verification\n');
      return { success: false, reason: 'Referral code not in metadata' };
    }

    // Step 6: Check vendor_referrals
    console.log('5️⃣  Checking vendor_referrals...\n');
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1 OR referred_phone = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [fullPhone, normalizedPhone]
    );

    if (referrals.rows.length === 0) {
      console.log('   ❌ No referral record found\n');
      return { success: false, reason: 'No referral record' };
    } else {
      const ref = referrals.rows[0];
      console.log(`   ✅ Referral record found: ${ref.id}`);
      console.log(`      Status: ${ref.status}`);
      console.log(`      Code: ${ref.referral_code}\n`);
    }

    // Step 7: Create application
    console.log('6️⃣  Creating application...\n');
    const applicationId = randomUUID();
    const vendorIdentityId = vi.id;
    
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

    console.log(`   ✅ Created application: ${applicationId}\n`);

    // Step 8: Approve application
    console.log('7️⃣  Approving application...\n');
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      'POST',
      {},
      { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    );

    if (approveResult.statusCode !== 200) {
      console.log(`   ❌ Approval failed: ${JSON.stringify(approveResult.response)}\n`);
      return { success: false, reason: 'Approval failed' };
    }

    console.log(`   ✅ Application approved\n`);

    // Step 9: Wait and check wallet
    console.log('8️⃣  Waiting for referral processing (5 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const afterBalance = afterWallet.response.wallet?.balance || 0;
    
    const balanceIncrease = afterBalance - beforeBalance;
    
    console.log(`   Before: ₹${beforeBalance}`);
    console.log(`   After: ₹${afterBalance}`);
    console.log(`   Increase: ₹${balanceIncrease.toFixed(2)}\n`);

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

async function runAggressiveTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  AGGRESSIVE TESTING: AUTOMATIC REFERRAL FLOW');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('Goal: Points should be awarded automatically when vendor is approved');
  console.log('Stop condition: Flow works correctly, points awarded automatically\n');

  const results = [];
  let consecutiveSuccesses = 0;
  let consecutiveFailures = 0;
  const maxTests = 20;
  const targetSuccesses = 10;

  for (let i = 1; i <= maxTests; i++) {
    const result = await testCompleteFlow(i);
    results.push(result);

    if (result.success) {
      consecutiveSuccesses++;
      consecutiveFailures = 0;
      console.log(`✅ Test ${i}: PASS (${consecutiveSuccesses} consecutive successes)\n`);
      
      if (consecutiveSuccesses >= targetSuccesses) {
        console.log(`\n🎉 SUCCESS: ${consecutiveSuccesses} consecutive successful tests!`);
        console.log('✅ Flow is working correctly - points are awarded automatically!\n');
        break;
      }
    } else {
      consecutiveFailures++;
      consecutiveSuccesses = 0;
      console.log(`❌ Test ${i}: FAIL - ${result.reason}\n`);
      
      if (consecutiveFailures >= 3) {
        console.log(`\n⚠️  WARNING: ${consecutiveFailures} consecutive failures`);
        console.log('   Investigating issue...\n');
        // Continue testing to see if it's intermittent
      }
    }

    // Wait between tests
    if (i < maxTests) {
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

  if (successful >= targetSuccesses) {
    console.log('✅ SUCCESS: Flow is working correctly!\n');
  } else {
    console.log('❌ FAILURE: Flow needs debugging\n');
    console.log('Failure reasons:');
    const reasons = {};
    results.filter(r => !r.success).forEach(r => {
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    });
    Object.entries(reasons).forEach(([reason, count]) => {
      console.log(`   - ${reason}: ${count} time(s)`);
    });
  }
}

runAggressiveTests().catch(console.error);
