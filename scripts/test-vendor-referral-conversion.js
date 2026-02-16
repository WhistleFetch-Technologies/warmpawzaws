const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'uat-token-admin-1771240312983';

// Test vendor ID (the referrer)
const referrerVendorId = 'bcff4da9-99b1-401f-ab62-5d70526331ec'; // Taruna Infosoft

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

async function testVendorReferralConversion() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING VENDOR REFERRAL ENDPOINT WITH CONVERSION RATE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check current conversion rate
    console.log('1️⃣  Checking conversion rate configuration...');
    const rules = await pool.query(
      `SELECT rule_name, conversion_rate, redemption_rate, is_active
       FROM loyalty_rules 
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 1`
    );

    let conversionRate = 1.0;
    if (rules.rows.length > 0) {
      const rule = rules.rows[0];
      console.log(`   Active Rule: ${rule.rule_name}`);
      if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
        conversionRate = parseFloat(rule.conversion_rate);
      } else if (rule.redemption_rate !== null && rule.redemption_rate !== undefined) {
        conversionRate = parseFloat(rule.redemption_rate);
      }
      console.log(`   Conversion Rate: ${conversionRate}`);
      console.log(`   Expected: 500 points = ₹${(500 / conversionRate).toFixed(2)}\n`);
    } else {
      console.log('   No active rule - defaulting to 1.0');
      console.log(`   Expected: 500 points = ₹500.00\n`);
    }

    // Step 2: Check current wallet state
    console.log('2️⃣  Checking current wallet state...');
    const walletBefore = await makeRequest(`${API_BASE_URL}/vendor/${referrerVendorId}/wallet`);
    
    if (walletBefore.statusCode === 200 && walletBefore.response.success) {
      const balanceBefore = walletBefore.response.wallet?.balance || 0;
      const pointsBefore = walletBefore.response.loyalty_points?.total_points || 0;
      console.log(`   Balance Before: ₹${balanceBefore}`);
      console.log(`   Points Before: ${pointsBefore}\n`);
    } else {
      console.log(`   ❌ Could not fetch wallet: ${walletBefore.response.error || 'Unknown error'}\n`);
      return;
    }

    // Step 3: Check vendor_referral action rule
    console.log('3️⃣  Checking vendor_referral action rule...');
    const actionRule = await pool.query(
      `SELECT * FROM loyalty_action_rules 
       WHERE action_name = 'vendor_referral' 
       AND is_active = true
       LIMIT 1`
    );

    if (actionRule.rows.length > 0) {
      const rule = actionRule.rows[0];
      console.log(`   Action: ${rule.action_name}`);
      console.log(`   Points Value: ${rule.points_value}`);
      console.log(`   Points Type: ${rule.points_type}`);
      console.log(`   Expected Points: ${rule.points_value}`);
      console.log(`   Expected Wallet Credit: ₹${(rule.points_value / conversionRate).toFixed(2)}\n`);
    } else {
      console.log('   ⚠️  No vendor_referral rule found!\n');
    }

    // Step 4: Check recent transactions before
    console.log('4️⃣  Checking recent transactions (before)...');
    const txBefore = await makeRequest(`${API_BASE_URL}/vendor/${referrerVendorId}/wallet/transactions?limit=3`);
    
    const txCountBefore = txBefore.statusCode === 200 && txBefore.response.success 
      ? txBefore.response.transactions?.length || 0 
      : 0;
    console.log(`   Transaction count: ${txCountBefore}\n`);

    // Step 5: Test the referral endpoint
    console.log('5️⃣  Testing referral endpoint...');
    console.log(`   GET /vendor/${referrerVendorId}/referral\n`);
    
    const referralResult = await makeRequest(`${API_BASE_URL}/vendor/${referrerVendorId}/referral`);
    
    if (referralResult.statusCode === 200 && referralResult.response.success) {
      console.log('   ✅ Referral endpoint working');
      console.log(`   Referral Code: ${referralResult.response.referralCode || 'N/A'}\n`);
    } else {
      console.log(`   ❌ Referral endpoint failed: ${referralResult.response.error || 'Unknown error'}\n`);
    }

    // Step 6: Check if we can find a pending referral to test approval
    console.log('6️⃣  Looking for pending referrals to test approval...');
    const pendingReferrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referrer_vendor_id = $1 
       AND status = 'applied'
       ORDER BY created_at DESC
       LIMIT 1`,
      [referrerVendorId]
    );

    if (pendingReferrals.rows.length > 0) {
      const referral = pendingReferrals.rows[0];
      console.log(`   Found pending referral: ${referral.id}`);
      console.log(`   Referral Code: ${referral.referral_code}`);
      console.log(`   Status: ${referral.status}\n`);

      // Check if there's a vendor application linked to this
      const application = await pool.query(
        `SELECT * FROM vendor_onboarding_applications 
         WHERE vendor_identity_id IN (
           SELECT id FROM vendor_identity 
           WHERE metadata->>'referral_code' = $1
         )
         AND application_status = 'APPROVED'
         LIMIT 1`,
        [referral.referral_code]
      );

      if (application.rows.length > 0) {
        console.log(`   Found approved application: ${application.rows[0].id}`);
        console.log(`   This referral should have already been processed.\n`);
      } else {
        console.log(`   No approved application found for this referral.\n`);
      }
    } else {
      console.log('   No pending referrals found.\n');
    }

    // Step 7: Check wallet after (to see if any new transactions)
    console.log('7️⃣  Checking wallet state after...');
    const walletAfter = await makeRequest(`${API_BASE_URL}/vendor/${referrerVendorId}/wallet`);
    
    if (walletAfter.statusCode === 200 && walletAfter.response.success) {
      const balanceAfter = walletAfter.response.wallet?.balance || 0;
      const pointsAfter = walletAfter.response.loyalty_points?.total_points || 0;
      console.log(`   Balance After: ₹${balanceAfter}`);
      console.log(`   Points After: ${pointsAfter}\n`);
    }

    // Step 8: Check latest transaction
    console.log('8️⃣  Checking latest transaction...');
    const txAfter = await makeRequest(`${API_BASE_URL}/vendor/${referrerVendorId}/wallet/transactions?limit=1`);
    
    if (txAfter.statusCode === 200 && txAfter.response.success) {
      const latestTx = txAfter.response.transactions?.[0];
      if (latestTx) {
        console.log(`   Latest Transaction:`);
        console.log(`   Description: ${latestTx.description}`);
        console.log(`   Amount: ${latestTx.transaction_type === 'credit' ? '+' : '-'}₹${latestTx.amount}`);
        console.log(`   Balance After: ₹${latestTx.balance_after}`);
        console.log(`   Date: ${new Date(latestTx.created_at).toLocaleString()}\n`);

        // Check if new code is active
        if (latestTx.description.includes('conversion_rate') || latestTx.description.includes('rate:')) {
          console.log('   ✅ NEW CODE IS ACTIVE!');
          console.log('   Transaction description includes conversion rate info.\n');
        } else {
          console.log('   ⚠️  OLD CODE - Transaction description does not include conversion rate.\n');
        }
      } else {
        console.log('   No transactions found.\n');
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Conversion Rate Configuration:');
    console.log(`   Active Rate: ${conversionRate} points = 1 rupee`);
    console.log(`   So 500 points = ₹${(500 / conversionRate).toFixed(2)}\n`);

    console.log('Endpoint Status:');
    console.log(`   GET /vendor/:vendorId/referral: ${referralResult.statusCode === 200 ? '✅ Working' : '❌ Failed'}`);
    console.log(`   GET /vendor/:vendorId/wallet: ${walletAfter.statusCode === 200 ? '✅ Working' : '❌ Failed'}`);
    console.log(`   GET /vendor/:vendorId/wallet/transactions: ${txAfter.statusCode === 200 ? '✅ Working' : '❌ Failed'}\n`);

    console.log('Next Steps:');
    console.log('   To test the conversion rate with a new referral:');
    console.log('   1. Create a new vendor with a referral code');
    console.log('   2. Approve the vendor application');
    console.log('   3. Check if points are converted using the new rate\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testVendorReferralConversion();
