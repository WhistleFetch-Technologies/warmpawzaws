const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'uat-token-admin-1771240312983';

// Test vendor ID (the one we've been testing with)
const testVendorId = 'bcff4da9-99b1-401f-ab62-5d70526331ec'; // Taruna Infosoft

async function makeRequest(url, options = {}) {
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

async function checkConversionRate() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING CONVERSION RATE FIX');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check current conversion rate in database
    console.log('1️⃣  Checking conversion rate in loyalty_rules...');
    const rules = await pool.query(
      `SELECT rule_name, points_per_rupee, redemption_rate, conversion_rate, auto_convert_to_wallet
       FROM loyalty_rules 
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 1`
    );

    let conversionRate = 1.0;
    if (rules.rows.length > 0) {
      const rule = rules.rows[0];
      console.log(`   Found rule: ${rule.rule_name}`);
      console.log(`   Conversion Rate: ${rule.conversion_rate || 'NULL (will default to 1.0)'}`);
      console.log(`   Redemption Rate: ${rule.redemption_rate || 'NULL'}`);
      
      if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
        conversionRate = parseFloat(rule.conversion_rate);
      } else if (rule.redemption_rate !== null && rule.redemption_rate !== undefined) {
        conversionRate = parseFloat(rule.redemption_rate);
      }
    } else {
      console.log('   No active loyalty rule found - will default to 1.0');
    }

    console.log(`\n   Using conversion_rate: ${conversionRate}`);
    console.log(`   Expected: 500 points = ₹${(500 / conversionRate).toFixed(2)}\n`);

    // Step 2: Check current wallet balance
    console.log('2️⃣  Checking current wallet balance...');
    const walletResult = await makeRequest(`${API_BASE_URL}/vendor/${testVendorId}/wallet`);
    
    if (walletResult.statusCode === 200 && walletResult.response.success) {
      const currentBalance = walletResult.response.wallet?.balance || 0;
      const currentPoints = walletResult.response.loyalty_points?.total_points || 0;
      console.log(`   Current Balance: ₹${currentBalance}`);
      console.log(`   Current Points: ${currentPoints}\n`);
    } else {
      console.log(`   Could not fetch wallet: ${walletResult.response.error || 'Unknown error'}\n`);
    }

    // Step 3: Check recent transactions
    console.log('3️⃣  Checking recent wallet transactions...');
    const txResult = await makeRequest(`${API_BASE_URL}/vendor/${testVendorId}/wallet/transactions?limit=5`);
    
    if (txResult.statusCode === 200 && txResult.response.success) {
      const transactions = txResult.response.transactions || [];
      console.log(`   Found ${transactions.length} recent transactions:\n`);
      
      transactions.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
        console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
        console.log(`      Balance After: ₹${tx.balance_after}`);
        console.log(`      Date: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

    // Step 4: Analysis
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (txResult.statusCode === 200 && txResult.response.success) {
      const latestTx = txResult.response.transactions?.[0];
      if (latestTx && latestTx.description) {
        // Check if description contains conversion rate info
        if (latestTx.description.includes('conversion_rate') || latestTx.description.includes('rate:')) {
          console.log('✅ NEW CODE IS ACTIVE!');
          console.log(`   Transaction description includes conversion rate info.`);
        } else {
          console.log('⚠️  OLD CODE STILL ACTIVE');
          console.log(`   Transaction description doesn't include conversion rate info.`);
          console.log(`   Description: ${latestTx.description}`);
        }
      }
    }

    console.log('\n   Conversion Rate Logic:');
    console.log(`   - Code now fetches conversion_rate from loyalty_rules`);
    console.log(`   - If conversion_rate is NULL, uses redemption_rate`);
    console.log(`   - If both are NULL, defaults to 1.0`);
    console.log(`   - Wallet amount = points / conversion_rate`);
    console.log(`   - Current setting: ${conversionRate} points = 1 rupee`);
    console.log(`   - So 500 points = ₹${(500 / conversionRate).toFixed(2)}`);

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

checkConversionRate();
