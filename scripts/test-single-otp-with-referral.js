const https = require('https');

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

async function testSingleOtpWithReferral() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING OTP VERIFICATION WITH REFERRAL CODE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Generate unique test phone
    const testPhone = `9${Math.floor(Math.random() * 1000000000)}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;
    const referralCode = 'VREFCA45O7N4';

    console.log(`Test Phone: ${normalizedPhone} (${fullPhone})`);
    console.log(`Referral Code: ${referralCode}\n`);

    // Step 1: Send OTP
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

    console.log(`✅ OTP sent successfully\n`);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Verify OTP with referral code
    console.log('2️⃣  Verifying OTP with referral code...\n');
    console.log(`   Payload: { phone: "${fullPhone}", otp: "123456", role: "vendor", referralCode: "${referralCode}" }\n`);
    
    const verifyOtpResult = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      'POST',
      {
        phone: fullPhone,
        otp: '123456', // UAT mode
        role: 'vendor',
        referralCode: referralCode
      }
    );

    console.log(`   Status Code: ${verifyOtpResult.statusCode}`);
    console.log(`   Response: ${JSON.stringify(verifyOtpResult.response, null, 2)}\n`);

    if (verifyOtpResult.statusCode !== 200) {
      console.log(`❌ OTP verification failed\n`);
      return { success: false, reason: 'OTP verification failed' };
    }

    // Wait 3 seconds for database operations
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Check if vendor_identity was created with referral in metadata
    console.log('3️⃣  Checking vendor_identity metadata...\n');
    const { Pool } = require('pg');
    const pool = new Pool({
      host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
      port: 5432,
      database: 'warmpawz',
      user: 'warmpawz_admin',
      password: 'Warmpawz2026',
    });

    const identity = await pool.query(
      `SELECT id, phone, metadata, onboarding_status 
       FROM vendor_identity 
       WHERE phone = $1 OR phone = $2`,
      [normalizedPhone, fullPhone]
    );

    if (identity.rows.length === 0) {
      console.log('❌ vendor_identity NOT created!\n');
      await pool.end();
      return { success: false, reason: 'vendor_identity not created', phone: normalizedPhone };
    }

    const vi = identity.rows[0];
    let metadata = vi.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    console.log(`   Vendor Identity ID: ${vi.id}`);
    console.log(`   Phone: ${vi.phone}`);
    console.log(`   Onboarding Status: ${vi.onboarding_status}`);
    console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

    if (metadata.referral_code_id || metadata.referral_code) {
      console.log('✅ SUCCESS: Referral code stored in metadata!\n');
      await pool.end();
      return { success: true, vendorIdentityId: vi.id, phone: normalizedPhone };
    } else {
      console.log('❌ FAILURE: Referral code NOT stored in metadata!\n');
      await pool.end();
      return { success: false, reason: 'Referral code not in metadata', phone: normalizedPhone };
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, reason: error.message };
  }
}

testSingleOtpWithReferral().then(result => {
  if (result.success) {
    console.log('🎉 TEST PASSED: Referral code was stored correctly!\n');
    process.exit(0);
  } else {
    console.log(`❌ TEST FAILED: ${result.reason}\n`);
    process.exit(1);
  }
}).catch(console.error);
