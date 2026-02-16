const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
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
  console.log('  CUSTOMER-TO-CUSTOMER REFERRAL - SIMPLE TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const referrerPhone = '9876543210'; // Fixed test referrer
  const referralCode = 'CREF189BO3CX';
  const testPhone = `987654${String(Date.now()).slice(-4)}`;

  // Get referrer customer ID
  const referrerCheck = await pool.query(
    `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
    [referrerPhone]
  );
  const referrerCustomerId = referrerCheck.rows[0]?.id;
  if (!referrerCustomerId) {
    console.error('❌ Referrer customer not found');
    await pool.end();
    return;
  }

  // Get initial wallet balance
  const initialWallet = await pool.query(
    `SELECT balance FROM customer_wallets WHERE customer_id = $1`,
    [referrerCustomerId]
  );
  const initialBalance = initialWallet.rows[0]?.balance || 0;
  console.log(`📊 Initial Referrer Wallet: ₹${initialBalance.toFixed(2)}\n`);

  // Delete test customer
  await pool.query(`DELETE FROM customers WHERE phone = $1`, [testPhone]);
  await pool.query(`DELETE FROM customer_identity WHERE phone = $1 OR phone = $2`, [testPhone, `+91${testPhone}`]);
  await pool.query(`DELETE FROM customer_referrals WHERE referred_phone = $1 OR referred_phone = $2`, [testPhone, `+91${testPhone}`]);

  // Step 1: Send OTP
  console.log(`[1] Sending OTP to ${testPhone}...`);
  await makeRequest(`${API_BASE_URL}/auth/send-otp`, {
    method: 'POST',
    body: { phone: testPhone, role: 'customer' },
  });

  // Step 2: Verify OTP with referral code
  console.log(`[2] Verifying OTP with referral code ${referralCode}...`);
  const verifyResult = await makeRequest(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    body: {
      phone: testPhone,
      otp: '123456',
      role: 'customer',
      referralCode: referralCode,
    },
  });

  console.log(`    Response status: ${verifyResult.statusCode}`);
  if (verifyResult.statusCode !== 200) {
    console.error('❌ OTP verification failed');
    await pool.end();
    return;
  }

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 3: Check customer_identity metadata
  console.log(`\n[3] Checking customer_identity metadata...`);
  const identityCheck = await pool.query(
    `SELECT * FROM customer_identity WHERE phone = $1 OR phone = $2`,
    [testPhone, `+91${testPhone}`]
  );

  if (identityCheck.rows.length > 0) {
    const identity = identityCheck.rows[0];
    const metadata = identity.metadata || {};
    if (metadata.referral_code_id) {
      console.log(`    ✅ Metadata has referral_code_id: ${metadata.referral_code_id}`);
    } else {
      console.log(`    ❌ Metadata missing referral_code_id`);
    }
  }

  // Step 4: Check customer_referrals
  console.log(`\n[4] Checking customer_referrals...`);
  const referralCheck = await pool.query(
    `SELECT * FROM customer_referrals WHERE referred_phone = $1 OR referred_phone = $2`,
    [testPhone, `+91${testPhone}`]
  );
  if (referralCheck.rows.length > 0) {
    console.log(`    ✅ Referral record found: ${referralCheck.rows[0].id}`);
    console.log(`    Status: ${referralCheck.rows[0].status}`);
  }

  // Step 5: Check referrer wallet
  console.log(`\n[5] Checking referrer wallet...`);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for points to be processed
  const finalWallet = await pool.query(
    `SELECT balance FROM customer_wallets WHERE customer_id = $1`,
    [referrerCustomerId]
  );
  const finalBalance = finalWallet.rows[0]?.balance || 0;
  const increase = finalBalance - initialBalance;

  console.log(`    Initial Balance: ₹${initialBalance.toFixed(2)}`);
  console.log(`    Final Balance: ₹${finalBalance.toFixed(2)}`);
  console.log(`    Increase: ₹${increase.toFixed(2)}`);

  if (increase > 0) {
    console.log(`\n✅ SUCCESS: Points awarded and reflected in wallet!`);
    console.log(`   Referrer received: ₹${increase.toFixed(2)}`);
  } else {
    console.log(`\n❌ FAILED: No points awarded or not reflected in wallet`);
  }

  // Check loyalty points
  const loyaltyCheck = await pool.query(
    `SELECT * FROM loyalty_transactions 
     WHERE customer_id = $1 
     AND reference_type = 'customer_referral'
     ORDER BY created_at DESC
     LIMIT 1`,
    [referrerCustomerId]
  );
  if (loyaltyCheck.rows.length > 0) {
    console.log(`\n✅ Loyalty transaction found:`);
    console.log(`   Points: ${loyaltyCheck.rows[0].points}`);
    console.log(`   Description: ${loyaltyCheck.rows[0].description}`);
  }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  await pool.end();
}

test().catch(console.error);
