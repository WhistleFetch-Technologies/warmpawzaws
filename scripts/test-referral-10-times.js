const https = require('https');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'uat-token-admin-1771240312983';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

// Helper function to make API calls
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, response: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runSingleTest(testNumber) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  TEST ${testNumber}/10 - COMPLETE END-TO-END FLOW`);
  console.log(`${'='.repeat(70)}\n`);

  let referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283'; // Taruna Infosoft
  let referralCode = 'VREFE283EKHY';
  let testPhone = null;
  let vendorIdentityId = null;
  let applicationId = null;
  let referredVendorId = null;
  let referralRecordId = null;

  try {
    // Get referrer's wallet balance and points BEFORE
    const beforeWallet = await pool.query(
      `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const beforeBalance = beforeWallet.rows.length > 0 ? parseFloat(beforeWallet.rows[0].balance || 0) : 0;
    
    const beforeLoyalty = await pool.query(
      `SELECT total_points, lifetime_points_earned FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const beforePoints = beforeLoyalty.rows.length > 0 ? parseFloat(beforeLoyalty.rows[0].total_points || 0) : 0;
    
    console.log(`📊 BEFORE TEST ${testNumber}:`);
    console.log(`   Wallet: ₹${beforeBalance.toFixed(2)}`);
    console.log(`   Points: ${beforePoints}\n`);

    // Create unique test phone number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    testPhone = `987654${String(random).padStart(4, '0')}`.slice(0, 10);
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;
    
    console.log(`📱 Test Phone: ${normalizedPhone} (${fullPhone})\n`);

    // STEP 1: OTP Verification with referral code
    console.log(`[${testNumber}.1] OTP Verification with referral code...`);
    const verifyResult = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      {
        method: 'POST',
        body: {
          phone: normalizedPhone,
          otp: '123456', // UAT mode OTP
          referralCode: referralCode,
          role: 'vendor',
        },
      }
    );

    if (verifyResult.statusCode !== 200) {
      console.log(`❌ OTP verification failed: ${JSON.stringify(verifyResult.response)}\n`);
      return { testNumber, success: false, reason: 'OTP verification failed' };
    }

    console.log(`✅ OTP verified successfully\n`);

    // Wait for vendor_identity creation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // STEP 2: Verify vendor_identity was created
    console.log(`[${testNumber}.2] Verifying vendor_identity creation...`);
    const identityCheck = await pool.query(
      `SELECT * FROM vendor_identity WHERE phone = $1`,
      [normalizedPhone]
    );

    if (identityCheck.rows.length === 0) {
      console.log(`❌ vendor_identity NOT created!\n`);
      return { testNumber, success: false, reason: 'vendor_identity not created' };
    }

    vendorIdentityId = identityCheck.rows[0].id;
    let metadata = identityCheck.rows[0].metadata || {};
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    if (!metadata.referral_code_id) {
      console.log(`❌ Referral code NOT in metadata!\n`);
      return { testNumber, success: false, reason: 'Referral code not in metadata' };
    }

    referralRecordId = metadata.referral_code_id;
    console.log(`✅ vendor_identity created: ${vendorIdentityId}`);
    console.log(`✅ Referral code in metadata: ${metadata.referral_code}\n`);

    // STEP 3: Verify vendor_referrals record
    console.log(`[${testNumber}.3] Verifying vendor_referrals record...`);
    const referralCheck = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE id = $1`,
      [referralRecordId]
    );

    if (referralCheck.rows.length === 0) {
      console.log(`❌ Referral record NOT found!\n`);
      return { testNumber, success: false, reason: 'Referral record not found' };
    }

    console.log(`✅ Referral record found: ${referralCheck.rows[0].id}, Status: ${referralCheck.rows[0].status}\n`);

    // STEP 4: Create application
    console.log(`[${testNumber}.4] Creating vendor onboarding application...`);
    applicationId = randomUUID();
    const roleId = '072548c8-84a9-4165-a9ec-0387c8c76a0e';
    
    await pool.query(
      `INSERT INTO vendor_onboarding_applications
       (id, vendor_identity_id, role_id, vendor_type, status, application_payload, form_version, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        applicationId,
        vendorIdentityId,
        roleId,
        'solo',
        'SUBMITTED',
        JSON.stringify({
          phone: normalizedPhone,
          businessName: `Test Vendor ${timestamp}`,
          fullName: 'Test User',
          email: `test${timestamp}@test.com`,
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

    console.log(`✅ Application created: ${applicationId}\n`);

    // STEP 5: Approve vendor
    console.log(`[${testNumber}.5] Approving vendor application...`);
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      {
        method: 'POST',
      }
    );

    if (approveResult.statusCode !== 200) {
      console.log(`❌ Approval failed: ${JSON.stringify(approveResult.response)}\n`);
      return { testNumber, success: false, reason: 'Approval failed' };
    }

    referredVendorId = approveResult.response.vendorId;
    console.log(`✅ Vendor approved: ${referredVendorId}\n`);

    // STEP 6: Wait and verify points were awarded
    console.log(`[${testNumber}.6] Waiting for referral processing (8 seconds)...`);
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Get AFTER values
    const afterWallet = await pool.query(
      `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const afterBalance = afterWallet.rows.length > 0 ? parseFloat(afterWallet.rows[0].balance || 0) : 0;
    
    const afterLoyalty = await pool.query(
      `SELECT total_points, lifetime_points_earned FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const afterPoints = afterLoyalty.rows.length > 0 ? parseFloat(afterLoyalty.rows[0].total_points || 0) : 0;

    const balanceIncrease = afterBalance - beforeBalance;
    const pointsIncrease = afterPoints - beforePoints;

    console.log(`📊 AFTER TEST ${testNumber}:`);
    console.log(`   Wallet: ₹${afterBalance.toFixed(2)} (Increase: ₹${balanceIncrease.toFixed(2)})`);
    console.log(`   Points: ${afterPoints} (Increase: ${pointsIncrease})\n`);

    // Verify referral record was updated
    const finalReferral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE id = $1`,
      [referralRecordId]
    );

    const referralStatus = finalReferral.rows.length > 0 ? finalReferral.rows[0].status : 'UNKNOWN';
    const referralApprovedAt = finalReferral.rows.length > 0 ? finalReferral.rows[0].approved_at : null;

    // Check for loyalty transaction
    const loyaltyTx = await pool.query(
      `SELECT * FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 
       AND reference_type = 'vendor_referral'
       AND reference_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [referrerVendorId, referralRecordId]
    );

    // Check for wallet transaction
    const walletTx = await pool.query(
      `SELECT * FROM vendor_wallet_transactions 
       WHERE vendor_id = $1 
       AND transaction_type = 'credit'
       AND reference_type = 'vendor_referral'
       AND reference_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [referrerVendorId, referralRecordId]
    );

    // Verify all conditions
    const conditions = {
      vendorIdentityCreated: vendorIdentityId !== null,
      referralInMetadata: metadata.referral_code_id !== undefined,
      vendorApproved: referredVendorId !== null,
      referralRecordUpdated: referralStatus === 'approved',
      referralApprovedAtSet: referralApprovedAt !== null,
      pointsAwarded: pointsIncrease >= 500, // At least 500 points
      walletCredited: balanceIncrease >= 4.99, // At least ₹4.99 (allowing for rounding)
      loyaltyTxCreated: loyaltyTx.rows.length > 0,
      walletTxCreated: walletTx.rows.length > 0,
    };

    console.log(`[${testNumber}.7] Verification Results:`);
    console.log(`   ✅ vendor_identity created: ${conditions.vendorIdentityCreated ? 'YES' : 'NO'}`);
    console.log(`   ✅ Referral in metadata: ${conditions.referralInMetadata ? 'YES' : 'NO'}`);
    console.log(`   ✅ Vendor approved: ${conditions.vendorApproved ? 'YES' : 'NO'}`);
    console.log(`   ✅ Referral record updated: ${conditions.referralRecordUpdated ? 'YES' : 'NO'}`);
    console.log(`   ✅ Referral approved_at set: ${conditions.referralApprovedAtSet ? 'YES' : 'NO'}`);
    console.log(`   ✅ Points awarded: ${conditions.pointsAwarded ? 'YES' : 'NO'} (${pointsIncrease} points)`);
    console.log(`   ✅ Wallet credited: ${conditions.walletCredited ? 'YES' : 'NO'} (₹${balanceIncrease.toFixed(2)})`);
    console.log(`   ✅ Loyalty transaction: ${conditions.loyaltyTxCreated ? 'YES' : 'NO'}`);
    console.log(`   ✅ Wallet transaction: ${conditions.walletTxCreated ? 'YES' : 'NO'}\n`);

    const allPassed = Object.values(conditions).every(v => v === true);
    
    if (allPassed) {
      console.log(`✅ TEST ${testNumber} PASSED - All checks successful!\n`);
    } else {
      console.log(`❌ TEST ${testNumber} FAILED - Some checks failed!\n`);
    }

    return {
      testNumber,
      success: allPassed,
      conditions,
      balanceIncrease,
      pointsIncrease,
      referralRecordId,
      referredVendorId,
    };

  } catch (error) {
    console.error(`❌ TEST ${testNumber} ERROR:`, error);
    return { testNumber, success: false, reason: error.message };
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  VENDOR REFERRAL FLOW - 10 COMPLETE END-TO-END TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283';

  // Get initial state
  const initialWallet = await pool.query(
    `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
    [referrerVendorId]
  );
  const initialBalance = initialWallet.rows.length > 0 ? parseFloat(initialWallet.rows[0].balance || 0) : 0;
  
  const initialLoyalty = await pool.query(
    `SELECT total_points FROM vendor_loyalty_points WHERE vendor_id = $1`,
    [referrerVendorId]
  );
  const initialPoints = initialLoyalty.rows.length > 0 ? parseFloat(initialLoyalty.rows[0].total_points || 0) : 0;

  console.log(`📊 INITIAL STATE:`);
  console.log(`   Wallet: ₹${initialBalance.toFixed(2)}`);
  console.log(`   Points: ${initialPoints}\n`);

  // Run 10 tests
  for (let i = 1; i <= 10; i++) {
    const result = await runSingleTest(i);
    results.push(result);
    
    // Wait between tests to avoid race conditions
    if (i < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Get final state
  const finalWallet = await pool.query(
    `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
    [referrerVendorId]
  );
  const finalBalance = finalWallet.rows.length > 0 ? parseFloat(finalWallet.rows[0].balance || 0) : 0;
  
  const finalLoyalty = await pool.query(
    `SELECT total_points FROM vendor_loyalty_points WHERE vendor_id = $1`,
    [referrerVendorId]
  );
  const finalPoints = finalLoyalty.rows.length > 0 ? parseFloat(finalLoyalty.rows[0].total_points || 0) : 0;

  // Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('  FINAL SUMMARY - ALL 10 TESTS');
  console.log('='.repeat(70) + '\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`📊 FINAL STATE:`);
  console.log(`   Wallet: ₹${finalBalance.toFixed(2)} (Started: ₹${initialBalance.toFixed(2)})`);
  console.log(`   Points: ${finalPoints} (Started: ${initialPoints})`);
  console.log(`   Total Increase: ₹${(finalBalance - initialBalance).toFixed(2)}, ${finalPoints - initialPoints} points\n`);

  console.log(`📋 TEST RESULTS:`);
  console.log(`   ✅ Passed: ${passed}/10`);
  console.log(`   ❌ Failed: ${failed}/10\n`);

  if (passed === 10) {
    console.log(`✅ ALL 10 TESTS PASSED! 🎉\n`);
  } else {
    console.log(`⚠️  ${failed} TEST(S) FAILED\n`);
  }

  // Detailed results
  console.log('📋 DETAILED RESULTS:\n');
  results.forEach((result, idx) => {
    if (result.success) {
      console.log(`   ✅ Test ${result.testNumber}: PASSED`);
      console.log(`      - Points: +${result.pointsIncrease || 0}, Wallet: +₹${(result.balanceIncrease || 0).toFixed(2)}`);
    } else {
      console.log(`   ❌ Test ${result.testNumber}: FAILED - ${result.reason || 'Unknown error'}`);
    }
  });

  console.log('\n' + '='.repeat(70) + '\n');

  await pool.end();
  
  return { passed, failed, results };
}

// Run all tests
runAllTests()
  .then((summary) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
