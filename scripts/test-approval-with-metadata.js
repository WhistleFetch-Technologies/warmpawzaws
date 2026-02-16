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

async function testApprovalWithMetadata() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING APPROVAL WITH REFERRAL IN METADATA');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check Shreesha's wallet
    console.log('1️⃣  Checking Shreesha\'s wallet...\n');
    const beforeWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const beforeBalance = beforeWallet.response.wallet?.balance || 0;
    console.log(`   Balance: ₹${beforeBalance}\n`);

    // Step 2: Get referral code info
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
    
    // Step 3: Create test vendor_identity with referral in metadata
    console.log('2️⃣  Creating test vendor_identity with referral in metadata...\n');
    const testPhone = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;
    
    // Create referral record
    const newReferral = await pool.query(
      `INSERT INTO vendor_referrals 
       (referrer_vendor_id, referral_code, referred_phone, status, applied_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'applied', NOW(), NOW(), NOW())
       RETURNING *`,
      [referrerVendorId, REFERRAL_CODE, fullPhone]
    );
    
    const referralRecord = newReferral.rows[0];
    console.log(`   Created referral record: ${referralRecord.id}\n`);

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

    // Step 4: Create vendor record
    console.log('3️⃣  Creating vendor record...\n');
    const vendorId = randomUUID();
    
    await pool.query(
      `INSERT INTO vendors (id, phone, email, business_name, owner_name, role_id, vendor_type, status, is_active, address, city, state, pincode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        vendorId,
        normalizedPhone,
        'test@test.com',
        'Test Vendor',
        'Test User',
        '072548c8-84a9-4165-a9ec-0387c8c76a0e',
        'solo',
        'approved',
        true,
        'Test Address',
        'Test City',
        'Test State',
        '123456'
      ]
    );

    // Update vendor_identity
    await pool.query(
      `UPDATE vendor_identity 
       SET vendor_id = $1, onboarding_status = 'ACTIVATED'
       WHERE id = $2`,
      [vendorId, vendorIdentityId]
    );

    console.log(`   ✅ Created vendor: ${vendorId}\n`);

    // Step 5: Create application
    console.log('4️⃣  Creating application...\n');
    const applicationId = randomUUID();
    
    await pool.query(
      `INSERT INTO vendor_onboarding_applications
       (id, vendor_identity_id, role_id, vendor_type, status, application_payload, form_version, submitted_at, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        applicationId,
        vendorIdentityId,
        '072548c8-84a9-4165-a9ec-0387c8c76a0e',
        'solo',
        'APPROVED',
        JSON.stringify({
          phone: normalizedPhone,
          businessName: 'Test Vendor',
        }),
        '1.0'
      ]
    );

    console.log(`   ✅ Created application: ${applicationId}\n`);

    // Step 6: Call approval endpoint (it should process the referral)
    console.log('5️⃣  Calling approval endpoint (should process referral automatically)...\n');
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      'POST'
    );

    console.log(`   Status: ${approveResult.statusCode}`);
    if (approveResult.statusCode === 200) {
      console.log(`   ✅ Approval endpoint called successfully!\n`);
    } else {
      console.log(`   Response: ${JSON.stringify(approveResult.response, null, 2)}\n`);
    }

    // Step 7: Wait and check wallet
    console.log('6️⃣  Waiting for referral processing...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const afterBalance = afterWallet.response.wallet?.balance || 0;
    
    console.log(`   Before: ₹${beforeBalance}`);
    console.log(`   After: ₹${afterBalance}`);
    console.log(`   Increase: ₹${(afterBalance - beforeBalance).toFixed(2)}\n`);

    if (afterBalance > beforeBalance) {
      console.log('✅ SUCCESS: Points were awarded automatically by the approval endpoint!\n');
    } else {
      console.log('❌ FAILURE: Points were NOT awarded!\n');
      console.log('   The approval endpoint did not process the referral from metadata.\n');
    }

    // Check referral record status
    const referralCheck = await pool.query(
      `SELECT * FROM vendor_referrals WHERE id = $1`,
      [referralRecord.id]
    );

    if (referralCheck.rows.length > 0) {
      console.log(`Referral Record Status: ${referralCheck.rows[0].status}`);
      console.log(`Approved At: ${referralCheck.rows[0].approved_at || 'NULL'}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testApprovalWithMetadata();
