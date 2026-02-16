const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

async function verifyWalletBalance() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const vendorIdentityId = '250a0ba2-823e-4bd7-a943-d509e5eb4655';
    const correctVendorId = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  VERIFYING WALLET BALANCE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check database directly
    console.log('1️⃣  Checking database directly...\n');
    const dbWallet = await pool.query(
      `SELECT vw.balance, vlp.total_points, vlp.lifetime_points_earned
       FROM vendor_wallets vw
       LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
       WHERE vw.vendor_id = $1`,
      [correctVendorId]
    );

    if (dbWallet.rows.length > 0) {
      console.log(`   Database Wallet Balance: ₹${dbWallet.rows[0].balance || 0}`);
      console.log(`   Database Points: ${dbWallet.rows[0].total_points || 0}`);
      console.log(`   Lifetime Earned: ${dbWallet.rows[0].lifetime_points_earned || 0}\n`);
    } else {
      console.log('   ⚠️  No wallet found in database\n');
    }

    // Check all transactions
    console.log('2️⃣  Checking all wallet transactions...\n');
    const transactions = await pool.query(
      `SELECT * FROM vendor_wallet_transactions vwt
       JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
       WHERE vw.vendor_id = $1
       ORDER BY vwt.created_at DESC`,
      [correctVendorId]
    );

    console.log(`   Found ${transactions.rows.length} transaction(s):\n`);
    transactions.rows.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
      console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
      console.log(`      Balance After: ₹${tx.balance_after}`);
      console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
    });

    // Test API endpoint with vendor_identity ID
    console.log('3️⃣  Testing API with vendor_identity ID...\n');
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

    const apiResult = await makeRequest(`${API_BASE_URL}/vendor/${vendorIdentityId}/wallet`);
    console.log(`   API Status: ${apiResult.statusCode}`);
    console.log(`   API Response: ${JSON.stringify(apiResult.response, null, 2)}\n`);

    // Test API endpoint with correct vendor_id
    console.log('4️⃣  Testing API with correct vendor_id...\n');
    const apiResult2 = await makeRequest(`${API_BASE_URL}/vendor/${correctVendorId}/wallet`);
    console.log(`   API Status: ${apiResult2.statusCode}`);
    console.log(`   API Response: ${JSON.stringify(apiResult2.response, null, 2)}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (dbWallet.rows.length > 0) {
      const dbBalance = parseFloat(dbWallet.rows[0].balance || 0);
      const apiBalance = apiResult.response?.wallet?.balance || 0;
      
      if (Math.abs(dbBalance - apiBalance) > 0.01) {
        console.log('⚠️  MISMATCH: Database and API show different balances!');
        console.log(`   Database: ₹${dbBalance}`);
        console.log(`   API: ₹${apiBalance}\n`);
      } else {
        console.log('✅ Balances match!\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

verifyWalletBalance();
