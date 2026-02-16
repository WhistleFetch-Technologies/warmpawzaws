const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

// Vendor ID user is checking (vendor_identity ID)
const vendorIdentityId = '250a0ba2-823e-4bd7-a943-d509e5eb4655';

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

async function finalVerification() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Checking wallet for vendor: ${vendorIdentityId}\n`);

  const walletResult = await makeRequest(`${API_BASE_URL}/vendor/${vendorIdentityId}/wallet`);
  
  if (walletResult.statusCode === 200 && walletResult.response.success) {
    console.log('✅ Wallet API Response:');
    console.log(`   Balance: ₹${walletResult.response.wallet?.balance || 0}`);
    console.log(`   Points: ${walletResult.response.loyalty_points?.total_points || 0}`);
    console.log(`   Lifetime Earned: ${walletResult.response.loyalty_points?.lifetime_earned || 0}\n`);

    const balance = walletResult.response.wallet?.balance || 0;
    
    if (balance >= 10) {
      console.log('✅ SUCCESS: Wallet shows ₹10 or more!');
      console.log('   This means both referrals were processed correctly:\n');
      console.log('   - First referral: ₹5.00 (500 points)');
      console.log('   - Second referral: ₹5.00 (500 points)');
      console.log('   - Total: ₹10.00 (1000 points)\n');
    } else if (balance >= 5) {
      console.log('⚠️  Wallet shows ₹5, which means only one referral was processed.');
      console.log('   The second referral may still be processing, or there was an issue.\n');
    } else {
      console.log('❌ Wallet balance is less than ₹5. Something went wrong.\n');
    }

    // Check transactions
    const txResult = await makeRequest(`${API_BASE_URL}/vendor/${vendorIdentityId}/wallet/transactions?limit=5`);
    
    if (txResult.statusCode === 200 && txResult.response.success) {
      console.log(`Recent Transactions (${txResult.response.transactions?.length || 0}):\n`);
      txResult.response.transactions?.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
        console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
        console.log(`      Balance After: ₹${tx.balance_after}`);
        console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

  } else {
    console.log(`❌ Error: ${JSON.stringify(walletResult.response, null, 2)}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('Referral Code: VREFCA45O7N4');
  console.log('Referrer: Shreesha\'s Vet Solo');
  console.log('Expected: ₹10.00 (from 2 referrals)');
  console.log('Conversion Rate: 100 points = 1 rupee\n');
}

finalVerification();
