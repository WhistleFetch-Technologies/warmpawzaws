const https = require('https');
const { Pool } = require('pg');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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
    console.log('  COMPLETE FLOW TEST: OTP → VENDOR_IDENTITY → APPLICATION → APPROVAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const testPhone = `9${Math.floor(Math.random() * 1000000000)}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;
    const referralCode = 'VREFCA45O7N4';

    console.log(`Test Phone: ${normalizedPhone} (${fullPhone})`);
    console.log(`Referral Code: ${referralCode}\n`);

    // Step 1: Send OTP
    console.log('1️⃣  Sending OTP...\n');
    await makeRequest(`${API_BASE_URL}/auth/send-otp`, 'POST', {
      phone: fullPhone,
      role: 'vendor'
    });
    console.log(`✅ OTP sent\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Verify OTP with referral code
    console.log('2️⃣  Verifying OTP with referral code...\n');
    const verifyResult = await makeRequest(`${API_BASE_URL}/auth/verify-otp`, 'POST', {
      phone: fullPhone,
      otp: '123456',
      role: 'vendor',
      referralCode: referralCode
    });

    console.log(`   Status: ${verifyResult.statusCode}`);
    console.log(`   User ID: ${verifyResult.response?.data?.data?.user?.id || 'NOT FOUND'}\n`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Check vendor_identity
    console.log('3️⃣  Checking vendor_identity...\n');
    const viCheck = await pool.query(
      `SELECT * FROM vendor_identity WHERE phone = $1 OR phone = $2`,
      [normalizedPhone, fullPhone]
    );

    if (viCheck.rows.length === 0) {
      console.log('❌ vendor_identity NOT created!\n');
      await pool.end();
      return { success: false, reason: 'vendor_identity not created' };
    }

    const vi = viCheck.rows[0];
    let metadata = vi.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    console.log(`   ✅ Vendor Identity ID: ${vi.id}`);
    console.log(`   Phone: ${vi.phone}`);
    console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

    if (!metadata.referral_code_id) {
      console.log('❌ Referral code NOT in metadata!\n');
      await pool.end();
      return { success: false, reason: 'Referral code not in metadata' };
    }

    console.log('✅ Referral code found in metadata!\n');

    // Step 4: Create application
    console.log('4️⃣  Creating vendor application...\n');
    const appResult = await makeRequest(
      `${API_BASE_URL}/vendor/onboarding/application`,
      'POST',
      {
        phone: fullPhone,
        formData: {
          businessName: 'Test Business',
          fullName: 'Test User',
          phone: normalizedPhone,
          email: 'test@example.com',
          address: 'Test Address',
          city: 'Mumbai',
          state: 'Maharashtra',
          pin: '400001',
          aadhaarNumber: 'XXXX XXXX 1234',
          aadhaarNumber_verified: true,
          panNumber: 'CCJPT9305A',
          panNumber_verified: true,
          agreedToTerms: true,
        },
        documents: {},
      }
    );

    if (appResult.statusCode !== 200) {
      console.log(`❌ Application creation failed: ${JSON.stringify(appResult.response)}\n`);
      await pool.end();
      return { success: false, reason: 'Application creation failed' };
    }

    const applicationId = appResult.response?.data?.application?.id;
    console.log(`✅ Application created: ${applicationId}\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Approve application
    console.log('5️⃣  Approving application...\n');
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationId}/approve`,
      'POST',
      {},
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmMGVkNWZiNy03YmZkLTQwODAtYTkzOS1hNmNkNThlMDYwMTciLCJjb2duaXRvOnVzZXJuYW1lIjoiYWRtaW5Ad2FybXBhd3ouY29tIiwicGhvbmVfbnVtYmVyIjoiYWRtaW5Ad2FybXBhd3ouY29tIiwiY3VzdG9tOnVzZXJfdHlwZSI6ImFkbWluIiwiY29nbml0bzpncm91cHMiOlsidmVuZG9yIl0sInRva2VuX3VzZSI6ImFjY2VzcyIsImlhdCI6MTc3MTI2Nzc4NCwiZXhwIjoxNzcxMzU0MTg0LCJpc3MiOiJ3YXJtcGF3ei11YXQiLCJhdWQiOiJ3YXJtcGF3ei1hcGkifQ.test'
    );

    console.log(`   Status: ${approveResult.statusCode}\n`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 6: Check referrer wallet
    console.log('6️⃣  Checking referrer wallet...\n');
    const referrerVendorId = metadata.referrer_vendor_id;
    const wallet = await pool.query(
      `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (wallet.rows.length > 0) {
      console.log(`   ✅ Referrer wallet balance: ₹${wallet.rows[0].balance}\n`);
    } else {
      console.log(`   ⚠️  Referrer wallet not found\n`);
    }

    // Step 7: Check wallet transactions
    if (wallet.rows.length > 0) {
      const tx = await pool.query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [wallet.rows[0].id]
      );

      console.log(`   Found ${tx.rows.length} recent transaction(s):\n`);
      tx.rows.forEach((t, i) => {
        const isRecent = new Date(t.created_at) > new Date(Date.now() - 5 * 60 * 1000);
        const marker = isRecent ? '🆕' : '  ';
        console.log(`   ${marker} ${i + 1}. ${t.description || t.reference_type}`);
        console.log(`      Amount: ${t.transaction_type === 'credit' ? '+' : '-'}₹${t.amount}`);
        console.log(`      Created: ${new Date(t.created_at).toLocaleString()}\n`);
      });
    }

    await pool.end();
    return { success: true };

  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    return { success: false, reason: error.message };
  }
}

testCompleteFlow().then(result => {
  if (result.success) {
    console.log('🎉 COMPLETE FLOW TEST PASSED!\n');
    process.exit(0);
  } else {
    console.log(`❌ COMPLETE FLOW TEST FAILED: ${result.reason}\n`);
    process.exit(1);
  }
}).catch(console.error);
