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
  console.log(`  TEST ${testNumber} - CUSTOMER-TO-CUSTOMER REFERRAL FLOW`);
  console.log(`${'='.repeat(70)}\n`);

  let referrerCustomerId = null;
  let referralCode = null;
  let testPhone = null;
  let referredCustomerId = null;
  let customerIdentityId = null;
  let referralRecordId = null;
  let bookingId = null;

  try {
    // STEP 1: Get or create referrer customer
    console.log(`[${testNumber}.1] Setting up referrer customer...`);
    const referrerPhone = '9876543210'; // Fixed test referrer
    const referrerCheck = await pool.query(
      `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
      [referrerPhone]
    );

    if (referrerCheck.rows.length > 0) {
      referrerCustomerId = referrerCheck.rows[0].id;
      console.log(`✅ Using existing referrer customer: ${referrerCustomerId}`);
    } else {
      // Create referrer customer
      const newReferrer = await pool.query(
        `INSERT INTO customers (phone, full_name, is_active, status, onboarding_status, profile_completed)
         VALUES ($1, 'Test Referrer Customer', true, 'active', 'COMPLETED', true)
         RETURNING id`,
        [referrerPhone]
      );
      referrerCustomerId = newReferrer.rows[0].id;
      console.log(`✅ Created referrer customer: ${referrerCustomerId}`);
    }

    // Get or create referral code for referrer (create directly in DB to ensure it exists)
    const existingCode = await pool.query(
      `SELECT referral_code FROM customer_referrals 
       WHERE referrer_customer_id = $1 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [referrerCustomerId]
    );
    
    if (existingCode.rows.length > 0) {
      referralCode = existingCode.rows[0].referral_code;
      console.log(`✅ Using existing referral code: ${referralCode}`);
    } else {
      // Generate new referral code
      let attempts = 0;
      let isUnique = false;
      while (!isUnique && attempts < 10) {
        referralCode = `CREF${referrerCustomerId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const checkUnique = await pool.query(
          `SELECT id FROM customer_referrals WHERE referral_code = $1`,
          [referralCode]
        );
        if (checkUnique.rows.length === 0) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (!isUnique) {
        console.log(`❌ Failed to generate unique referral code\n`);
        return { testNumber, success: false, reason: 'Failed to generate unique referral code' };
      }
      
      // Create referral record
      await pool.query(
        `INSERT INTO customer_referrals 
         (referrer_customer_id, referral_code, referred_phone, status, created_at, updated_at)
         VALUES ($1, $2, '', 'pending', NOW(), NOW())`,
        [referrerCustomerId, referralCode]
      );
      console.log(`✅ Created new referral code: ${referralCode}`);
    }
    console.log('');

    // Get initial wallet balance and points for referrer
    const beforeWallet = await pool.query(
      `SELECT balance FROM customer_wallets WHERE customer_id = $1`,
      [referrerCustomerId]
    );
    const beforeBalance = beforeWallet.rows.length > 0 ? parseFloat(beforeWallet.rows[0].balance || 0) : 0;
    
    const beforeLoyalty = await pool.query(
      `SELECT total_points, lifetime_points_earned FROM customer_loyalty_points WHERE customer_id = $1`,
      [referrerCustomerId]
    );
    const beforePoints = beforeLoyalty.rows.length > 0 ? parseFloat(beforeLoyalty.rows[0].total_points || 0) : 0;
    
    console.log(`📊 BEFORE TEST ${testNumber}:`);
    console.log(`   Referrer Wallet: ₹${beforeBalance.toFixed(2)}`);
    console.log(`   Referrer Points: ${beforePoints}\n`);

    // STEP 2: Create unique test phone number for referred customer
    console.log(`[${testNumber}.2] Creating test phone number...`);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    testPhone = `987654${String(random).padStart(4, '0')}`.slice(0, 10);
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;
    
    console.log(`📱 Test Phone: ${normalizedPhone} (${fullPhone})\n`);

    // STEP 3: Simulate OTP verification with referral code
    console.log(`[${testNumber}.3] Simulating OTP verification with referral code...`);
    const verifyResult = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      {
        method: 'POST',
        body: {
          phone: normalizedPhone,
          otp: '123456', // UAT mode OTP
          referralCode: referralCode,
          role: 'customer',
        },
      }
    );

    if (verifyResult.statusCode !== 200) {
      console.log(`❌ OTP verification failed: ${JSON.stringify(verifyResult.response)}\n`);
      return { testNumber, success: false, reason: 'OTP verification failed' };
    }

    console.log(`✅ OTP verified successfully\n`);

    // Wait for customer_identity creation and processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // STEP 4: Verify customer_identity was created with referral metadata
    console.log(`[${testNumber}.4] Verifying customer_identity creation...`);
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const normalizedPhoneForDb = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;
    
    const identityCheck = await pool.query(
      `SELECT * FROM customer_identity WHERE phone = $1 OR phone = $2`,
      [normalizedPhoneForDb, normalizedPhone]
    );

    if (identityCheck.rows.length === 0) {
      console.log(`❌ customer_identity NOT created!\n`);
      return { testNumber, success: false, reason: 'customer_identity not created' };
    }

    customerIdentityId = identityCheck.rows[0].id;
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
    console.log(`✅ customer_identity created: ${customerIdentityId}`);
    console.log(`✅ Referral code in metadata: ${metadata.referral_code}\n`);

    // STEP 5: Verify customer_referrals record
    console.log(`[${testNumber}.5] Verifying customer_referrals record...`);
    const referralCheck = await pool.query(
      `SELECT * FROM customer_referrals 
       WHERE id = $1`,
      [referralRecordId]
    );

    if (referralCheck.rows.length === 0) {
      console.log(`❌ Referral record NOT found!\n`);
      return { testNumber, success: false, reason: 'Referral record not found' };
    }

    console.log(`✅ Referral record found: ${referralCheck.rows[0].id}, Status: ${referralCheck.rows[0].status}\n`);

    // STEP 6: Get referred customer ID
    const customerCheck = await pool.query(
      `SELECT id FROM customers WHERE phone = $1 OR phone = $2 LIMIT 1`,
      [normalizedPhone, normalizedPhoneForDb]
    );

    if (customerCheck.rows.length === 0) {
      console.log(`❌ Customer NOT created!\n`);
      return { testNumber, success: false, reason: 'Customer not created' };
    }

    referredCustomerId = customerCheck.rows[0].id;
    console.log(`✅ Referred customer ID: ${referredCustomerId}\n`);

    // STEP 7: Create a booking for the referred customer
    console.log(`[${testNumber}.6] Creating booking for referred customer...`);
    
    // Get a vendor for the booking
    const vendorResult = await pool.query(
      `SELECT id FROM vendors WHERE is_active = true LIMIT 1`
    );

    if (vendorResult.rows.length === 0) {
      console.log(`❌ No active vendor found for booking!\n`);
      return { testNumber, success: false, reason: 'No active vendor found' };
    }

    const vendorId = vendorResult.rows[0].id;
    bookingId = randomUUID();

    // Create booking
    await pool.query(
      `INSERT INTO bookings (id, customer_id, vendor_id, service_id, booking_date, booking_time, status, payment_status, total_amount, created_at)
       VALUES ($1, $2, $3, NULL, CURRENT_DATE, CURRENT_TIME, 'confirmed', 'paid', 500.00, NOW())`,
      [bookingId, referredCustomerId, vendorId]
    );

    console.log(`✅ Booking created: ${bookingId}\n`);

    // STEP 8: Complete the booking (simulate booking completion)
    console.log(`[${testNumber}.7] Completing booking...`);
    await pool.query(
      `UPDATE bookings SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [bookingId]
    );

    console.log(`✅ Booking completed\n`);

    // STEP 9: Wait for referral processing
    console.log(`[${testNumber}.8] Waiting for referral processing (8 seconds)...`);
    await new Promise(resolve => setTimeout(resolve, 8000));

    // STEP 10: Verify referral record was updated
    console.log(`[${testNumber}.9] Verifying referral record was updated...`);
    const finalReferral = await pool.query(
      `SELECT * FROM customer_referrals WHERE id = $1`,
      [referralRecordId]
    );

    const referralStatus = finalReferral.rows.length > 0 ? finalReferral.rows[0].status : 'UNKNOWN';
    const referralApprovedAt = finalReferral.rows.length > 0 ? finalReferral.rows[0].approved_at : null;

    console.log(`📋 Referral Status: ${referralStatus}`);
    console.log(`📋 Referral Approved At: ${referralApprovedAt || 'NOT SET'}\n`);

    // STEP 11: Verify points were awarded
    console.log(`[${testNumber}.10] Verifying points were awarded...`);
    
    // Get AFTER values
    const afterWallet = await pool.query(
      `SELECT balance FROM customer_wallets WHERE customer_id = $1`,
      [referrerCustomerId]
    );
    const afterBalance = afterWallet.rows.length > 0 ? parseFloat(afterWallet.rows[0].balance || 0) : 0;
    
    const afterLoyalty = await pool.query(
      `SELECT total_points, lifetime_points_earned FROM customer_loyalty_points WHERE customer_id = $1`,
      [referrerCustomerId]
    );
    const afterPoints = afterLoyalty.rows.length > 0 ? parseFloat(afterLoyalty.rows[0].total_points || 0) : 0;

    const balanceIncrease = afterBalance - beforeBalance;
    const pointsIncrease = afterPoints - beforePoints;

    console.log(`📊 AFTER TEST ${testNumber}:`);
    console.log(`   Referrer Wallet: ₹${afterBalance.toFixed(2)} (Increase: ₹${balanceIncrease.toFixed(2)})`);
    console.log(`   Referrer Points: ${afterPoints} (Increase: ${pointsIncrease})\n`);

    // Check for loyalty transaction
    const loyaltyTx = await pool.query(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_id = $1 
       AND reference_type = 'customer_referral'
       AND reference_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [referrerCustomerId, referralRecordId]
    );

    // Check for wallet transaction
    const walletTx = await pool.query(
      `SELECT * FROM wallet_transactions 
       WHERE customer_id = $1 
       AND transaction_type = 'credit'
       AND reference_type = 'customer_referral'
       AND reference_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [referrerCustomerId, referralRecordId]
    );

    // Verify all conditions
    const conditions = {
      customerIdentityCreated: customerIdentityId !== null,
      referralInMetadata: metadata.referral_code_id !== undefined,
      referralRecordCreated: referralCheck.rows.length > 0,
      referralRecordUpdated: referralStatus === 'approved',
      referralApprovedAtSet: referralApprovedAt !== null,
      pointsAwarded: pointsIncrease >= 100, // At least 100 points (customer_referral action)
      walletCredited: balanceIncrease >= 0.99, // At least ₹0.99 (100 points = ₹1 at 100 points/rupee)
      loyaltyTxCreated: loyaltyTx.rows.length > 0,
      walletTxCreated: walletTx.rows.length > 0,
    };

    console.log(`[${testNumber}.11] Verification Results:`);
    console.log(`   ✅ customer_identity created: ${conditions.customerIdentityCreated ? 'YES' : 'NO'}`);
    console.log(`   ✅ Referral in metadata: ${conditions.referralInMetadata ? 'YES' : 'NO'}`);
    console.log(`   ✅ Referral record created: ${conditions.referralRecordCreated ? 'YES' : 'NO'}`);
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
      referredCustomerId,
    };

  } catch (error) {
    console.error(`❌ TEST ${testNumber} ERROR:`, error);
    return { testNumber, success: false, reason: error.message };
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CUSTOMER-TO-CUSTOMER REFERRAL FLOW - END-TO-END TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];
  const referrerPhone = '9876543210';

  // Get referrer customer ID
  const referrerCheck = await pool.query(
    `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
    [referrerPhone]
  );

  if (referrerCheck.rows.length === 0) {
    // Create referrer customer
    const newReferrer = await pool.query(
      `INSERT INTO customers (phone, full_name, is_active, status, onboarding_status, profile_completed)
       VALUES ($1, 'Test Referrer Customer', true, 'active', 'COMPLETED', true)
       RETURNING id`,
      [referrerPhone]
    );
    console.log(`✅ Created referrer customer: ${newReferrer.rows[0].id}\n`);
  }

  // Get initial state
  const referrerId = referrerCheck.rows.length > 0 ? referrerCheck.rows[0].id : (await pool.query(`SELECT id FROM customers WHERE phone = $1`, [referrerPhone])).rows[0].id;
  
  const initialWallet = await pool.query(
    `SELECT balance FROM customer_wallets WHERE customer_id = $1`,
    [referrerId]
  );
  const initialBalance = initialWallet.rows.length > 0 ? parseFloat(initialWallet.rows[0].balance || 0) : 0;
  
  const initialLoyalty = await pool.query(
    `SELECT total_points FROM customer_loyalty_points WHERE customer_id = $1`,
    [referrerId]
  );
  const initialPoints = initialLoyalty.rows.length > 0 ? parseFloat(initialLoyalty.rows[0].total_points || 0) : 0;

  console.log(`📊 INITIAL STATE:`);
  console.log(`   Referrer Wallet: ₹${initialBalance.toFixed(2)}`);
  console.log(`   Referrer Points: ${initialPoints}\n`);

  // Run test
  const result = await runSingleTest(1);
  results.push(result);
  
  // Get final state
  const finalWallet = await pool.query(
    `SELECT balance FROM customer_wallets WHERE customer_id = $1`,
    [referrerId]
  );
  const finalBalance = finalWallet.rows.length > 0 ? parseFloat(finalWallet.rows[0].balance || 0) : 0;
  
  const finalLoyalty = await pool.query(
    `SELECT total_points FROM customer_loyalty_points WHERE customer_id = $1`,
    [referrerId]
  );
  const finalPoints = finalLoyalty.rows.length > 0 ? parseFloat(finalLoyalty.rows[0].total_points || 0) : 0;

  // Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('  FINAL SUMMARY');
  console.log('='.repeat(70) + '\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`📊 FINAL STATE:`);
  console.log(`   Referrer Wallet: ₹${finalBalance.toFixed(2)} (Started: ₹${initialBalance.toFixed(2)})`);
  console.log(`   Referrer Points: ${finalPoints} (Started: ${initialPoints})`);
  console.log(`   Total Increase: ₹${(finalBalance - initialBalance).toFixed(2)}, ${finalPoints - initialPoints} points\n`);

  console.log(`📋 TEST RESULTS:`);
  console.log(`   ✅ Passed: ${passed}/1`);
  console.log(`   ❌ Failed: ${failed}/1\n`);

  if (passed === 1) {
    console.log(`✅ TEST PASSED! 🎉\n`);
  } else {
    console.log(`⚠️  TEST FAILED\n`);
  }

  // Detailed results
  console.log('📋 DETAILED RESULTS:\n');
  results.forEach((result) => {
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

// Run test
runAllTests()
  .then((summary) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
