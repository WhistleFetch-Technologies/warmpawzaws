const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const testPhone = '9876543210';
const authToken = `uat-token-customer-${Date.now()}`;

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-UAT-Mode': 'true',
        'X-Phone': testPhone,
        ...options.headers,
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
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function test() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTING REFERRAL ENDPOINTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Using phone: ${testPhone}`);
  console.log(`Auth token: ${authToken}\n`);

  // Test 1: /referrals/stats
  console.log('[1] Testing GET /referrals/stats...');
  try {
    const result1 = await makeRequest(`${API_BASE_URL}/referrals/stats`);
    console.log(`    Status: ${result1.statusCode}`);
    console.log(`    Response: ${JSON.stringify(result1.response, null, 2)}`);
    if (result1.statusCode === 200 && result1.response.success) {
      console.log('    ✅ SUCCESS');
    } else {
      console.log('    ❌ FAILED');
    }
  } catch (error) {
    console.log(`    ❌ ERROR: ${error.message}`);
  }

  console.log('');

  // Test 2: /referrals/list
  console.log('[2] Testing GET /referrals/list...');
  try {
    const result2 = await makeRequest(`${API_BASE_URL}/referrals/list`);
    console.log(`    Status: ${result2.statusCode}`);
    console.log(`    Response: ${JSON.stringify(result2.response, null, 2)}`);
    if (result2.statusCode === 200 && result2.response.success) {
      console.log('    ✅ SUCCESS');
    } else {
      console.log('    ❌ FAILED');
    }
  } catch (error) {
    console.log(`    ❌ ERROR: ${error.message}`);
  }

  console.log('');

  // Test 3: /referrals/rewards
  console.log('[3] Testing GET /referrals/rewards...');
  try {
    const result3 = await makeRequest(`${API_BASE_URL}/referrals/rewards`);
    console.log(`    Status: ${result3.statusCode}`);
    console.log(`    Response: ${JSON.stringify(result3.response, null, 2)}`);
    if (result3.statusCode === 200 && result3.response.success) {
      console.log('    ✅ SUCCESS');
    } else {
      console.log('    ❌ FAILED');
    }
  } catch (error) {
    console.log(`    ❌ ERROR: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

test().catch(console.error);
