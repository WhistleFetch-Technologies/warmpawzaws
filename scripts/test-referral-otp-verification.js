const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Test phone and referral code
const TEST_PHONE = `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
const REFERRAL_CODE = 'VREFCA45O7N4';

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

async function testOTPWithReferral() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTING OTP VERIFICATION WITH REFERRAL CODE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const fullPhone = `+91${TEST_PHONE}`;
  console.log(`Test Phone: ${TEST_PHONE} (${fullPhone})`);
  console.log(`Referral Code: ${REFERRAL_CODE}\n`);

  try {
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
      return;
    }

    console.log('✅ OTP sent successfully\n');
    console.log('⚠️  Please check your phone for OTP and enter it manually\n');
    console.log('   Then run: node scripts/check-referral-storage.js <phone> <otp>\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testOTPWithReferral();
