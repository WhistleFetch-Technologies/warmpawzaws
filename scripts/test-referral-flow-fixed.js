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

async function testCompleteFlow() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  VENDOR REFERRAL FLOW TEST (FIXED VERSION)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let referrerVendorId = null;
  let referralCode = null;
  let testPhone = null;
  let vendorIdentityId = null;
  let applicationId = null;
  let referredVendorId = null;

  try {
    // STEP 1: Setup referrer vendor
    console.log('STEP 1: Setting up referrer vendor...\n');
    
    // Use an existing vendor as referrer
    referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283'; // Taruna Infosoft
    
    const referrerVendor = await pool.query(
      `SELECT id, business_name, phone FROM vendors WHERE id = $1`,
      [referrerVendorId]
    );

    if (referrerVendor.rows.length === 0) {
      console.log('❌ Referrer vendor not found');
      return;
    }

    console.log(`✅ Referrer Vendor: ${referrerVendor.rows[0].business_name} (${referrerVendor.rows[0].id})`);

    // Get referral code for this vendor
    const referralResult = await pool.query(
      `SELECT referral_code FROM vendor_referrals 
       WHERE referrer_vendor_id = $1 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [referrerVendorId]
    );

    if (referralResult.rows.length > 0) {
      referralCode = referralResult.rows[0].referral_code;
      console.log(`✅ Using existing referral code: ${referralCode}\n`);
    } else {
      // Generate new referral code
      referralCode = `VREF${referrerVendorId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      await pool.query(
        `INSERT INTO vendor_referrals 
         (referrer_vendor_id, referral_code, referred_phone, status, created_at, updated_at)
         VALUES ($1, $2, '', 'pending', NOW(), NOW())`,
        [referrerVendorId, referralCode]
      );
      console.log(`✅ Created new referral code: ${referralCode}\n`);
    }

    // Get referrer's wallet balance and loyalty points BEFORE
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
    const beforeLifetime = beforeLoyalty.rows.length > 0 ? parseFloat(beforeLoyalty.rows[0].lifetime_points_earned || 0) : 0;
    
    console.log(`💰 Referrer wallet balance BEFORE: ₹${beforeBalance.toFixed(2)}`);
    console.log(`💰 Referrer loyalty points BEFORE: ${beforePoints} (Lifetime: ${beforeLifetime})\n`);

    // STEP 2: Create test phone number
    console.log('STEP 2: Creating test phone number...\n');
    const timestamp = Date.now();
    const last4 = timestamp.toString().slice(-4);
    testPhone = `987654${last4}`; // 10 digits
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;
    console.log(`✅ Test Phone: ${normalizedPhone} (${fullPhone})\n`);

    // STEP 3: Simulate OTP verification with referral code
    console.log('STEP 3: Simulating OTP verification with referral code...\n');
    console.log(`   Phone: ${normalizedPhone}`);
    console.log(`   Referral Code: ${referralCode}`);
    
    // Call verify-otp API with referral code
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
      console.log(`❌ OTP verification failed: ${JSON.stringify(verifyResult.response, null, 2)}\n`);
      return;
    }

    console.log(`✅ OTP verified successfully`);
    console.log(`   Response: ${JSON.stringify(verifyResult.response, null, 2)}\n`);

    // Wait a bit for vendor_identity to be created
    await new Promise(resolve => setTimeout(resolve, 3000));

    // STEP 4: Verify vendor_identity was created with referral metadata
    console.log('STEP 4: Verifying vendor_identity creation...\n');
    
    // Try multiple phone formats
    console.log(`   Checking for phone: ${normalizedPhone}`);
    const identityCheck1 = await pool.query(
      `SELECT * FROM vendor_identity WHERE phone = $1`,
      [normalizedPhone]
    );
    console.log(`   Format 1 (${normalizedPhone}): ${identityCheck1.rows.length} records`);
    
    console.log(`   Checking for phone: ${fullPhone}`);
    const identityCheck2 = await pool.query(
      `SELECT * FROM vendor_identity WHERE phone = $1`,
      [fullPhone]
    );
    console.log(`   Format 2 (${fullPhone}): ${identityCheck2.rows.length} records`);
    
    console.log(`   Checking for phone pattern: %${normalizedPhone.slice(-10)}%`);
    const identityCheck3 = await pool.query(
      `SELECT * FROM vendor_identity WHERE phone LIKE $1`,
      [`%${normalizedPhone.slice(-10)}%`]
    );
    console.log(`   Format 3 (pattern): ${identityCheck3.rows.length} records`);
    
    // Also check all recent vendor_identity records
    const recentCheck = await pool.query(
      `SELECT * FROM vendor_identity 
       WHERE created_at > NOW() - INTERVAL '5 minutes'
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.log(`   Recent records (last 5 min): ${recentCheck.rows.length} records`);
    if (recentCheck.rows.length > 0) {
      console.log(`   Recent phones: ${recentCheck.rows.map(r => r.phone).join(', ')}`);
    }
    
    const identityCheck = identityCheck1.rows.length > 0 ? identityCheck1 : 
                          identityCheck2.rows.length > 0 ? identityCheck2 : 
                          identityCheck3;

    if (identityCheck.rows.length === 0) {
      console.log(`❌ ERROR: vendor_identity NOT created!\n`);
      return;
    }

    vendorIdentityId = identityCheck.rows[0].id;
    console.log(`✅ vendor_identity created: ${vendorIdentityId}`);
    console.log(`   Status: ${identityCheck.rows[0].onboarding_status}`);

    // Check metadata
    let metadata = identityCheck.rows[0].metadata || {};
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    if (metadata.referral_code_id) {
      console.log(`✅ Referral code found in metadata:`);
      console.log(`   - referral_code_id: ${metadata.referral_code_id}`);
      console.log(`   - referrer_vendor_id: ${metadata.referrer_vendor_id}`);
      console.log(`   - referral_code: ${metadata.referral_code}\n`);
    } else {
      console.log(`⚠️  WARNING: Referral code NOT in metadata, but will check vendor_referrals table\n`);
    }

    // STEP 5: Verify vendor_referrals record
    console.log('STEP 5: Verifying vendor_referrals record...\n');
    
    const referralCheck = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1 OR referred_phone LIKE $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [fullPhone, `%${normalizedPhone}%`]
    );

    if (referralCheck.rows.length > 0) {
      const refRecord = referralCheck.rows[0];
      console.log(`✅ Referral record found:`);
      console.log(`   - ID: ${refRecord.id}`);
      console.log(`   - Status: ${refRecord.status}`);
      console.log(`   - Referrer: ${refRecord.referrer_vendor_id}`);
      console.log(`   - Referred Phone: ${refRecord.referred_phone}\n`);
    } else {
      console.log(`⚠️  WARNING: Referral record not found by phone, but will check during approval\n`);
    }

    // STEP 6: Create vendor onboarding application
    console.log('STEP 6: Creating vendor onboarding application...\n');
    
    applicationId = randomUUID();
    const roleId = '072548c8-84a9-4165-a9ec-0387c8c76a0e'; // Default role
    
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

    // Link application_id to vendor_identity
    await pool.query(
      `UPDATE vendor_identity 
       SET application_id = $1
       WHERE id = $2`,
      [applicationId, vendorIdentityId]
    );

    console.log(`✅ Application created: ${applicationId}\n`);

    // STEP 7: Approve the vendor
    console.log('STEP 7: Approving vendor application...\n');
    console.log(`   Application ID: ${applicationId}\n`);
    
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      {
        method: 'POST',
      }
    );

    if (approveResult.statusCode !== 200) {
      console.log(`❌ Approval failed: ${JSON.stringify(approveResult.response, null, 2)}\n`);
      return;
    }

    console.log(`✅ Vendor approved successfully\n`);
    console.log(`   Response: ${JSON.stringify(approveResult.response, null, 2)}\n`);

    // Get vendor ID from response
    if (approveResult.response.vendorId) {
      referredVendorId = approveResult.response.vendorId;
      console.log(`✅ Referred Vendor ID: ${referredVendorId}\n`);
    }

    // STEP 8: Wait for referral processing
    console.log('STEP 8: Waiting for referral processing (5 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // STEP 9: Verify referral record was updated
    console.log('STEP 9: Verifying referral record was updated...\n');
    
    const updatedReferral = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE (referred_phone = $1 OR referred_phone LIKE $2 OR referred_vendor_id = $3)
       ORDER BY created_at DESC
       LIMIT 1`,
      [fullPhone, `%${normalizedPhone}%`, referredVendorId]
    );

    if (updatedReferral.rows.length > 0) {
      const refRecord = updatedReferral.rows[0];
      console.log(`✅ Referral record status: ${refRecord.status}`);
      console.log(`   - Referred Vendor ID: ${refRecord.referred_vendor_id}`);
      console.log(`   - Approved At: ${refRecord.approved_at}\n`);
      
      if (refRecord.status !== 'approved') {
        console.log(`⚠️  WARNING: Referral status is ${refRecord.status}, expected 'approved'\n`);
      }
    } else {
      console.log(`⚠️  WARNING: Could not find updated referral record\n`);
    }

    // STEP 10: Verify points were awarded - DETAILED CHECK
    console.log('STEP 10: Verifying points were awarded (DETAILED CHECK)...\n');
    
    // Wait a bit more for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const afterWallet = await pool.query(
      `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const afterBalance = afterWallet.rows.length > 0 ? parseFloat(afterWallet.rows[0].balance || 0) : 0;
    
    const balanceIncrease = afterBalance - beforeBalance;
    
    console.log(`💰 Referrer wallet balance:`);
    console.log(`   BEFORE: ₹${beforeBalance.toFixed(2)}`);
    console.log(`   AFTER:  ₹${afterBalance.toFixed(2)}`);
    console.log(`   INCREASE: ₹${balanceIncrease.toFixed(2)}\n`);

    // Check loyalty points
    const afterLoyalty = await pool.query(
      `SELECT total_points, lifetime_points_earned 
       FROM vendor_loyalty_points 
       WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (afterLoyalty.rows.length > 0) {
      const afterPoints = parseFloat(afterLoyalty.rows[0].total_points || 0);
      const afterLifetime = parseFloat(afterLoyalty.rows[0].lifetime_points_earned || 0);
      const pointsIncrease = afterPoints - beforePoints;
      const lifetimeIncrease = afterLifetime - beforeLifetime;
      
      console.log(`💰 Loyalty Points:`);
      console.log(`   BEFORE: ${beforePoints} (Lifetime: ${beforeLifetime})`);
      console.log(`   AFTER:  ${afterPoints} (Lifetime: ${afterLifetime})`);
      console.log(`   INCREASE: ${pointsIncrease} points (Lifetime: +${lifetimeIncrease})\n`);
    } else {
      console.log(`⚠️  WARNING: No loyalty points record found for referrer vendor!\n`);
    }

    // Check ALL loyalty transactions for vendor_referral (not just latest)
    const allLoyaltyTx = await pool.query(
      `SELECT * FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 5`,
      [referrerVendorId]
    );

    console.log(`📋 Referral Transactions (Last 5):`);
    if (allLoyaltyTx.rows.length > 0) {
      allLoyaltyTx.rows.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ${tx.points} points - ${tx.description}`);
        console.log(`      Created: ${tx.created_at}`);
        console.log(`      Reference ID: ${tx.reference_id}\n`);
      });
    } else {
      console.log(`   ⚠️  WARNING: No referral transactions found!\n`);
    }

    // Check wallet transactions
    const walletTx = await pool.query(
      `SELECT * FROM vendor_wallet_transactions 
       WHERE vendor_id = $1 
       AND transaction_type = 'credit'
       ORDER BY created_at DESC
       LIMIT 5`,
      [referrerVendorId]
    );

    console.log(`💳 Wallet Credit Transactions (Last 5):`);
    if (walletTx.rows.length > 0) {
      walletTx.rows.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ₹${parseFloat(tx.amount || 0).toFixed(2)} - ${tx.description || 'N/A'}`);
        console.log(`      Created: ${tx.created_at}`);
        console.log(`      Reference: ${tx.reference_type || 'N/A'} - ${tx.reference_id || 'N/A'}\n`);
      });
    } else {
      console.log(`   ⚠️  WARNING: No wallet credit transactions found!\n`);
    }

    // Verify the referral record was properly updated
    const finalReferralCheck = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE id = $1`,
      [referralCheck.rows[0].id]
    );

    if (finalReferralCheck.rows.length > 0) {
      const ref = finalReferralCheck.rows[0];
      console.log(`🔍 Final Referral Record Status:`);
      console.log(`   - ID: ${ref.id}`);
      console.log(`   - Status: ${ref.status}`);
      console.log(`   - Referrer Vendor ID: ${ref.referrer_vendor_id}`);
      console.log(`   - Referred Vendor ID: ${ref.referred_vendor_id || 'NOT SET'}`);
      console.log(`   - Approved At: ${ref.approved_at || 'NOT SET'}\n`);
    }

    // Final summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const testPassed = 
      vendorIdentityId !== null &&
      applicationId !== null &&
      referredVendorId !== null &&
      balanceIncrease > 0;

    if (testPassed) {
      console.log('✅ TEST PASSED: All checks successful!\n');
      console.log(`   - vendor_identity created: ${vendorIdentityId ? 'YES' : 'NO'}`);
      console.log(`   - Vendor approved: ${referredVendorId ? 'YES' : 'NO'}`);
      console.log(`   - Points awarded: ${balanceIncrease > 0 ? 'YES' : 'NO'} (₹${balanceIncrease.toFixed(2)})`);
    } else {
      console.log('❌ TEST FAILED: Some checks failed\n');
      console.log(`   - vendor_identity created: ${vendorIdentityId ? 'YES' : 'NO'}`);
      console.log(`   - Vendor approved: ${referredVendorId ? 'YES' : 'NO'}`);
      console.log(`   - Points awarded: ${balanceIncrease > 0 ? 'YES' : 'NO'}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ TEST ERROR:', error);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testCompleteFlow()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
