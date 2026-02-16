const { Pool } = require('pg');
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

async function debugVendorIdentityCreation() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DEBUGGING VENDOR_IDENTITY CREATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Generate unique test phone
    const testPhone = `9${Math.floor(Math.random() * 1000000000)}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    const fullPhone = `+91${normalizedPhone}`;
    const referralCode = 'VREFCA45O7N4';

    console.log(`Test Phone: ${normalizedPhone} (${fullPhone})`);
    console.log(`Referral Code: ${referralCode}\n`);

    // Step 1: Check database BEFORE OTP verification
    console.log('1️⃣  Checking database BEFORE OTP verification...\n');
    const beforeCheck = await pool.query(
      `SELECT * FROM vendor_identity WHERE phone = $1 OR phone = $2`,
      [normalizedPhone, fullPhone]
    );
    console.log(`   Found ${beforeCheck.rows.length} vendor_identity record(s) before OTP\n`);

    // Step 2: Send OTP
    console.log('2️⃣  Sending OTP...\n');
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
      await pool.end();
      return;
    }

    console.log(`✅ OTP sent successfully\n`);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Verify OTP with referral code
    console.log('3️⃣  Verifying OTP with referral code...\n');
    const verifyOtpResult = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      'POST',
      {
        phone: fullPhone,
        otp: '123456',
        role: 'vendor',
        referralCode: referralCode
      }
    );

    console.log(`   Status Code: ${verifyOtpResult.statusCode}`);
    console.log(`   User ID in response: ${verifyOtpResult.response?.data?.data?.user?.id || 'NOT FOUND'}\n`);

    // Wait 3 seconds for database operations
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Check database AFTER OTP verification
    console.log('4️⃣  Checking database AFTER OTP verification...\n');
    const afterCheck = await pool.query(
      `SELECT * FROM vendor_identity WHERE phone = $1 OR phone = $2`,
      [normalizedPhone, fullPhone]
    );
    console.log(`   Found ${afterCheck.rows.length} vendor_identity record(s) after OTP\n`);

    if (afterCheck.rows.length > 0) {
      const vi = afterCheck.rows[0];
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
      console.log(`   Onboarding Status: ${vi.onboarding_status}`);
      console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

      if (metadata.referral_code_id || metadata.referral_code) {
        console.log('✅ SUCCESS: Referral code stored in metadata!\n');
      } else {
        console.log('⚠️  Vendor identity created but NO referral code in metadata\n');
      }
    } else {
      console.log('❌ FAILURE: vendor_identity NOT created after OTP verification\n');
    }

    // Step 5: Check vendor_referrals
    console.log('5️⃣  Checking vendor_referrals...\n');
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referred_phone = $1 OR referred_phone = $2`,
      [fullPhone, `+91${normalizedPhone}`]
    );
    console.log(`   Found ${referrals.rows.length} referral record(s)\n`);
    if (referrals.rows.length > 0) {
      referrals.rows.forEach((ref, i) => {
        console.log(`   ${i + 1}. Referral ID: ${ref.id}`);
        console.log(`      Code: ${ref.referral_code}`);
        console.log(`      Status: ${ref.status}`);
        console.log(`      Created: ${new Date(ref.created_at).toLocaleString()}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugVendorIdentityCreation();
