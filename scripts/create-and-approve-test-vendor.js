const { Pool } = require('pg');
const https = require('https');
const { randomUUID } = require('crypto');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';

// Generate a test phone number
const testPhone = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;

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

async function createAndApproveTestVendor() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CREATE AND APPROVE TEST VENDOR WITH REFERRAL CODE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check Shreesha's current wallet
    console.log('1️⃣  Checking Shreesha\'s current wallet...\n');
    const initialWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    
    if (initialWallet.statusCode === 200 && initialWallet.response.success) {
      const initialBalance = initialWallet.response.wallet?.balance || 0;
      const initialPoints = initialWallet.response.loyalty_points?.total_points || 0;
      console.log(`   Initial Balance: ₹${initialBalance}`);
      console.log(`   Initial Points: ${initialPoints}\n`);
    } else {
      console.log(`   ❌ Error: ${JSON.stringify(initialWallet.response, null, 2)}\n`);
      return;
    }

    // Step 2: Get referral record
    console.log('2️⃣  Getting referral record...\n');
    const referral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referral_code = $1 ORDER BY created_at ASC LIMIT 1`,
      [REFERRAL_CODE]
    );

    if (referral.rows.length === 0) {
      console.log('❌ Referral code not found!\n');
      return;
    }

    const referrerVendorId = referral.rows[0].referrer_vendor_id;
    console.log(`   Referrer Vendor ID: ${referrerVendorId}\n`);

    // Step 3: Create vendor_identity with referral code
    console.log('3️⃣  Creating vendor_identity with referral code...\n');
    const vendorIdentityId = randomUUID();
    const fullPhone = `+91${normalizedPhone}`;
    
    await pool.query(
      `INSERT INTO vendor_identity 
       (id, phone, onboarding_status, metadata, selected_role_id, vendor_type)
       VALUES ($1, $2, 'FORM_PENDING', $3, $4, $5)`,
      [
        vendorIdentityId,
        normalizedPhone,
        JSON.stringify({
          referral_code_id: referral.rows[0].id,
          referrer_vendor_id: referrerVendorId,
          referral_code: REFERRAL_CODE,
        }),
        '072548c8-84a9-4165-a9ec-0387c8c76a0e', // vet_solo role
        'solo'
      ]
    );

    console.log(`   ✅ Created vendor_identity: ${vendorIdentityId}`);
    console.log(`   Phone: ${normalizedPhone}\n`);

    // Step 4: Create vendor_onboarding_application
    console.log('4️⃣  Creating vendor_onboarding_application...\n');
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
          panNumber: 'TEST1234A',
          aadhaarNumber: 'XXXX XXXX 1234',
          agreedToTerms: true,
        }),
        '1.0'
      ]
    );

    console.log(`   ✅ Created application: ${applicationId}\n`);

    // Step 5: Update referral record (don't set referred_vendor_id yet - vendor doesn't exist)
    console.log('5️⃣  Updating referral record...\n');
    await pool.query(
      `UPDATE vendor_referrals 
       SET referred_phone = $1,
           status = 'applied',
           applied_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [fullPhone, referral.rows[0].id]
    );

    console.log(`   ✅ Updated referral record (will link vendor_id after approval)\n`);

    // Step 6: Approve the application
    console.log('6️⃣  Approving application via admin API...\n');
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      'POST'
    );

    console.log(`   Status: ${approveResult.statusCode}`);
    if (approveResult.statusCode === 200) {
      console.log(`   ✅ Application approved successfully!\n`);
    } else {
      console.log(`   ❌ Error: ${JSON.stringify(approveResult.response, null, 2)}\n`);
    }

    // Step 7: Wait for processing
    console.log('7️⃣  Waiting for referral processing...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 8: Check Shreesha's wallet
    console.log('8️⃣  Checking Shreesha\'s wallet after approval...\n');
    const finalWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    
    if (finalWallet.statusCode === 200 && finalWallet.response.success) {
      const finalBalance = finalWallet.response.wallet?.balance || 0;
      const finalPoints = finalWallet.response.loyalty_points?.total_points || 0;
      const initialBalance = initialWallet.response.wallet?.balance || 0;
      const initialPoints = initialWallet.response.loyalty_points?.total_points || 0;
      
      console.log(`   Initial Balance: ₹${initialBalance}`);
      console.log(`   Final Balance: ₹${finalBalance}`);
      console.log(`   Initial Points: ${initialPoints}`);
      console.log(`   Final Points: ${finalPoints}\n`);
      
      const balanceIncrease = finalBalance - initialBalance;
      const pointsIncrease = finalPoints - initialPoints;
      
      if (balanceIncrease > 0) {
        console.log(`   ✅ SUCCESS: Wallet increased by ₹${balanceIncrease.toFixed(2)}!`);
        console.log(`   ✅ Points increased by ${pointsIncrease}!\n`);
      } else {
        console.log(`   ⚠️  No increase in wallet balance.\n`);
      }

      // Check recent transactions
      const txResult = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet/transactions?limit=5`);
      
      if (txResult.statusCode === 200 && txResult.response.success) {
        console.log(`   Recent Transactions (${txResult.response.transactions?.length || 0}):\n`);
        txResult.response.transactions?.forEach((tx, i) => {
          console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
          console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
          console.log(`      Balance After: ₹${tx.balance_after}`);
          console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
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

createAndApproveTestVendor();
