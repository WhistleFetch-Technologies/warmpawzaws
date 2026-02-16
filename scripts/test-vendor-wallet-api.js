const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const vendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283'; // Taruna Infosoft
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'uat-token-admin-1771240312983';

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

async function testWalletAPI() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTING VENDOR WALLET API ENDPOINTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Test 1: Get wallet balance
    console.log('1️⃣  Testing GET /vendor/:vendorId/wallet');
    const walletUrl = `${API_BASE_URL}/vendor/${vendorId}/wallet`;
    console.log(`   URL: ${walletUrl}\n`);

    const walletResult = await makeRequest(walletUrl);
    console.log(`   Status Code: ${walletResult.statusCode}`);
    console.log(`   Response: ${JSON.stringify(walletResult.response, null, 2)}\n`);

    if (walletResult.statusCode === 200 && walletResult.response.success) {
      console.log('   ✅ Wallet endpoint working!');
      console.log(`   Balance: ₹${walletResult.response.wallet?.balance || 0}`);
      console.log(`   Loyalty Points: ${walletResult.response.loyalty_points?.total_points || 0}\n`);
    } else {
      console.log('   ❌ Wallet endpoint failed!\n');
    }

    // Test 2: Get wallet transactions
    console.log('2️⃣  Testing GET /vendor/:vendorId/wallet/transactions');
    const transactionsUrl = `${API_BASE_URL}/vendor/${vendorId}/wallet/transactions?limit=10`;
    console.log(`   URL: ${transactionsUrl}\n`);

    const transactionsResult = await makeRequest(transactionsUrl);
    console.log(`   Status Code: ${transactionsResult.statusCode}`);
    console.log(`   Response: ${JSON.stringify(transactionsResult.response, null, 2)}\n`);

    if (transactionsResult.statusCode === 200 && transactionsResult.response.success) {
      console.log('   ✅ Transactions endpoint working!');
      console.log(`   Total Transactions: ${transactionsResult.response.total || 0}`);
      console.log(`   Returned: ${transactionsResult.response.transactions?.length || 0} transactions\n`);
    } else {
      console.log('   ❌ Transactions endpoint failed!\n');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const walletWorking = walletResult.statusCode === 200 && walletResult.response.success;
    const transactionsWorking = transactionsResult.statusCode === 200 && transactionsResult.response.success;

    console.log(`Wallet Endpoint: ${walletWorking ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Transactions Endpoint: ${transactionsWorking ? '✅ WORKING' : '❌ FAILED'}\n`);

    if (walletWorking && transactionsWorking) {
      console.log('🎉 ALL WALLET API ENDPOINTS ARE WORKING!');
    } else {
      console.log('⚠️  SOME ENDPOINTS ARE NOT WORKING');
      console.log('   Make sure the Lambda is deployed with the new endpoints.');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWalletAPI();
