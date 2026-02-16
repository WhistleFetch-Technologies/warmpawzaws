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

async function testWithCurl() {
  const testPhone = `9${Math.floor(Math.random() * 1000000000)}`;
  const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
  const fullPhone = `+91${normalizedPhone}`;
  const referralCode = 'VREFCA45O7N4';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTING WITH EXPLICIT PAYLOAD');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Phone: ${fullPhone}`);
  console.log(`Referral Code: ${referralCode}\n`);

  // Send OTP
  console.log('1️⃣  Sending OTP...\n');
  await makeRequest(`${API_BASE_URL}/auth/send-otp`, 'POST', {
    phone: fullPhone,
    role: 'vendor'
  });
  console.log('✅ OTP sent\n');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify OTP with EXPLICIT payload
  console.log('2️⃣  Verifying OTP with EXPLICIT payload...\n');
  const payload = {
    phone: fullPhone,
    otp: '123456',
    role: 'vendor',
    referralCode: referralCode
  };
  
  console.log(`Payload: ${JSON.stringify(payload, null, 2)}\n`);
  
  const result = await makeRequest(`${API_BASE_URL}/auth/verify-otp`, 'POST', payload);
  
  console.log(`Status: ${result.statusCode}`);
  console.log(`User ID: ${result.response?.data?.data?.user?.id || 'NOT FOUND'}`);
  console.log(`Profile ID: ${result.response?.data?.data?.profile?.id || 'NULL'}\n`);

  // Check database
  const { Pool } = require('pg');
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  const vi = await pool.query(
    `SELECT * FROM vendor_identity WHERE phone = $1 OR phone = $2`,
    [normalizedPhone, fullPhone]
  );

  if (vi.rows.length > 0) {
    console.log(`✅ vendor_identity created: ${vi.rows[0].id}`);
    let metadata = vi.rows[0].metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }
    console.log(`Metadata: ${JSON.stringify(metadata, null, 2)}\n`);
  } else {
    console.log('❌ vendor_identity NOT created\n');
  }

  await pool.end();
}

testWithCurl().catch(console.error);
