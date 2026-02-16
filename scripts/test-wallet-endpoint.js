const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

// Correct vendor ID for Shreesha's Vet Solo
const correctVendorId = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';
// User was checking this (doesn't exist)
const wrongVendorId = '250a0ba2-823e-4bd7-a943-d509e5eb4655';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
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
    req.end();
  });
}

async function testWalletEndpoint() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTING WALLET ENDPOINT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test correct vendor ID
  console.log(`1️⃣  Testing correct vendor ID: ${correctVendorId}\n`);
  const correctResult = await makeRequest(`${API_BASE_URL}/vendor/${correctVendorId}/wallet`);
  
  console.log(`   Status: ${correctResult.statusCode}`);
  console.log(`   Response: ${JSON.stringify(correctResult.response, null, 2)}\n`);

  if (correctResult.statusCode === 200 && correctResult.response.success) {
    console.log(`   ✅ Wallet Balance: ₹${correctResult.response.wallet?.balance || 0}`);
    console.log(`   ✅ Points: ${correctResult.response.loyalty_points?.total_points || 0}\n`);
  }

  // Test wrong vendor ID (user was checking this)
  console.log(`2️⃣  Testing wrong vendor ID: ${wrongVendorId}\n`);
  const wrongResult = await makeRequest(`${API_BASE_URL}/vendor/${wrongVendorId}/wallet`);
  
  console.log(`   Status: ${wrongResult.statusCode}`);
  console.log(`   Response: ${JSON.stringify(wrongResult.response, null, 2)}\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Correct Vendor ID: ${correctVendorId} (Shreesha's Vet Solo)`);
  console.log(`Wrong Vendor ID: ${wrongVendorId} (doesn't exist)`);
  console.log('\nYou should check the wallet using the correct vendor ID!\n');
}

testWalletEndpoint();
