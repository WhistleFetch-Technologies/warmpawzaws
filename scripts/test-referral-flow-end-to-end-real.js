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
    
    if (ADMIN_TOKEN && url.includes('/admin/')) {
      defaultHeaders['Authorization'] = `Bearer ${ADMIN_TOKEN}`;
    }
    
    const finalHeaders = { ...defaultHeaders, ...headers };
    
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: finalHeaders,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, response: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, response: data, raw: data });
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
    console.log(`  TEST ${testNumber}/10 - COMPLETE END-TO-END FLOW`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    // Generate unique test phone
    const testPhone = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;

    console.log(`📱 Test Phone: ${normalizedPhone} (${fullPhone})`);
    console.log(`🎫 Referral Code: ${REFERRAL_CODE}\n`);

    // Step 1: Check Shreesha's wallet BEFORE
    console.log('1️⃣  Checking Shreesha\'s wallet (BEFORE)...\n');
    const beforeWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const beforeBalance = beforeWallet.response.wallet?.balance || 0;
    console.log(`   Balance: ₹${beforeBalance}\n`);

    // Step 2: Simulate GetOnboardingStatusHandler (creates vendor_identity with INIT status)
    console.log('2️⃣  Simulating GetOnboardingStatusHandler...\n');
    const vendorIdentityId = randomUUID();
    
    await pool.query(
      `INSERT INTO vendor_identity 
       (id, phone, onboarding_status, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [vendorIdentityId, normalizedPhone, 'INIT', JSON.stringify({})]
    );

    console.log(`   ✅ Created vendor_identity: ${vendorIdentityId} (status: INIT, metadata: empty)\n`);

    // Step 3: Simulate OTP verification with referral code (THIS IS THE KEY STEP)
    console.log('3️⃣  Simulating OTP verification with referral code...\n');
    console.log('   (This simulates: User enters referral code, clicks Apply, enters OTP, clicks Verify)\n');
    
    // This is what the frontend sends
    const verifyOtpPayload = {
      phone: fullPhone,
      otp: '123456', // UAT mode
      role: 'vendor',
      referralCode: REFERRAL_CODE, // ✅ THIS IS THE KEY - referral code in the payload
    };

    console.log(`   📤 Sending OTP verification request with:`);
    console.log(`      - phone: ${verifyOtpPayload.phone}`);
    console.log(`      - role: ${verifyOtpPayload.role}`);
    console.log(`      - referralCode: ${verifyOtpPayload.referralCode}\n`);

    const verifyOtpResponse = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      'POST',
      verifyOtpPayload
    );

    console.log(`   📥 OTP Verification Response Status: ${verifyOtpResponse.statusCode}`);
    if (verifyOtpResponse.statusCode !== 200) {
      console.log(`   ❌ OTP verification failed: ${JSON.stringify(verifyOtpResponse.response)}\n`);
      return { success: false, reason: 'OTP verification failed' };
    }
    console.log(`   ✅ OTP verified successfully\n`);

    // Step 4: Verify referral code was stored in metadata
    console.log('4️⃣  Verifying referral code was stored...\n');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for async operations

    const identityCheck = await pool.query(
      `SELECT metadata FROM vendor_identity WHERE id = $1 OR phone = $2`,
      [vendorIdentityId, normalizedPhone]
    );

    if (identityCheck.rows.length === 0) {
      console.log('   ❌ vendor_identity not found!\n');
      return { success: false, reason: 'vendor_identity not found' };
    }

    let metadata = identityCheck.rows[0].metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

    if (metadata.referral_code_id || metadata.referral_code) {
      console.log('   ✅ Referral code stored in metadata!\n');
    } else {
      console.log('   ❌ Referral code NOT stored in metadata!\n');
      console.log('   ⚠️  This is the root cause - referral code was not processed during OTP verification\n');
      return { success: false, reason: 'Referral code not stored in metadata' };
    }

    // Step 5: Check if referral record was created
    console.log('5️⃣  Checking vendor_referrals...\n');
    const referralCheck = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1 AND referral_code = $2`,
      [fullPhone, REFERRAL_CODE]
    );

    if (referralCheck.rows.length > 0) {
      console.log(`   ✅ Referral record found: ${referralCheck.rows[0].id}`);
      console.log(`      Status: ${referralCheck.rows[0].status}\n`);
    } else {
      console.log('   ⚠️  No referral record found (might be created later)\n');
    }

    // Step 6: Create application
    console.log('6️⃣  Creating application...\n');
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

    await pool.query(
      `UPDATE vendor_identity 
       SET application_id = $1
       WHERE id = $2`,
      [applicationId, vendorIdentityId]
    );

    console.log(`   ✅ Created application: ${applicationId}\n`);

    // Step 7: Approve application
    console.log('7️⃣  Approving application...\n');
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      'POST'
    );

    if (approveResult.statusCode !== 200) {
      console.log(`   ❌ Approval failed: ${JSON.stringify(approveResult.response)}\n`);
      return { success: false, reason: 'Approval failed' };
    }

    console.log(`   ✅ Application approved\n`);

    // Step 8: Wait and check wallet
    console.log('8️⃣  Waiting for referral processing (5 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const afterBalance = afterWallet.response.wallet?.balance || 0;
    
    const balanceIncrease = afterBalance - beforeBalance;
    
    console.log(`   Before: ₹${beforeBalance}`);
    console.log(`   After: ₹${afterBalance}`);
    console.log(`   Increase: ₹${balanceIncrease.toFixed(2)}\n`);

    if (balanceIncrease > 0) {
      console.log(`   ✅ SUCCESS: Points awarded automatically!\n`);
      return { success: true, balanceIncrease };
    } else {
      console.log(`   ❌ FAILURE: Points NOT awarded!\n`);
      return { success: false, reason: 'Points not awarded' };
    }

  } catch (error) {
    console.error(`   ❌ Error:`, error);
    return { success: false, reason: error.message };
  } finally {
    await pool.end();
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  AGGRESSIVE TESTING: COMPLETE REFERRAL FLOW');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('Testing the COMPLETE flow:');
  console.log('  1. Create vendor_identity (GetOnboardingStatusHandler)');
  console.log('  2. OTP verification WITH referral code');
  console.log('  3. Verify referral code stored in metadata');
  console.log('  4. Create and approve application');
  console.log('  5. Verify points awarded automatically\n');

  const results = [];
  let consecutiveSuccesses = 0;
  const requiredSuccesses = 10;
  
  for (let i = 1; i <= 20; i++) { // Test up to 20 times
    const result = await testCompleteFlow(i);
    results.push(result);
    
    if (result.success) {
      consecutiveSuccesses++;
      console.log(`✅ Test ${i} PASSED (${consecutiveSuccesses}/${requiredSuccesses} consecutive successes)\n`);
      
      if (consecutiveSuccesses >= requiredSuccesses) {
        console.log('\n🎉 SUCCESS: Flow is working correctly!');
        console.log(`   Achieved ${consecutiveSuccesses} consecutive successful tests\n`);
        break;
      }
    } else {
      consecutiveSuccesses = 0;
      console.log(`❌ Test ${i} FAILED: ${result.reason}\n`);
      console.log('   Investigating failure...\n');
      
      // If referral code not stored, this is the root cause
      if (result.reason === 'Referral code not stored in metadata') {
        console.log('   🔍 ROOT CAUSE IDENTIFIED: Referral code not processed during OTP verification');
        console.log('   🔍 Need to check why OTP verification endpoint is not processing referral code\n');
      }
    }
    
    // Wait 2 seconds between tests
    if (i < 20) {
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
  console.log(`Failed: ${failed}`);
  console.log(`Consecutive Successes: ${consecutiveSuccesses}\n`);

  if (consecutiveSuccesses >= requiredSuccesses) {
    console.log('✅ SUCCESS: Flow is working correctly!\n');
  } else {
    console.log('❌ FAILURE: Flow needs more fixes\n');
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

runTests().catch(console.error);
