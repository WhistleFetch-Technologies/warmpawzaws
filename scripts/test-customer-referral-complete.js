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
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
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

async function test() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CUSTOMER-TO-CUSTOMER REFERRAL FLOW - COMPLETE TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Step 1: Create referrer customer
  const referrerPhone = `987654${String(Date.now()).slice(-4)}`;
  console.log(`[1] Creating referrer customer with phone: ${referrerPhone}`);
  
  // Send OTP
  await makeRequest(`${API_BASE_URL}/auth/send-otp`, {
    method: 'POST',
    body: { phone: referrerPhone, role: 'customer' },
  });
  
  // Verify OTP
  const referrerResult = await makeRequest(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    body: { phone: referrerPhone, otp: '123456', role: 'customer' },
  });
  
  if (referrerResult.statusCode !== 200 || !referrerResult.response?.data?.user?.id) {
    console.error('❌ Failed to create referrer customer');
    await pool.end();
    return;
  }
  
  const referrerCustomerId = referrerResult.response.data.user.id;
  const referrerToken = referrerResult.response.data.token.access_token;
  console.log(`✅ Referrer customer created: ${referrerCustomerId}\n`);

  // Step 2: Get referral code
  console.log(`[2] Getting referral code for customer ${referrerCustomerId}`);
  const referralCodeResult = await makeRequest(
    `${API_BASE_URL}/customer/${referrerCustomerId}/referral`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${referrerToken}` },
    }
  );
  
  let referralCode;
  if (referralCodeResult.statusCode === 200 && referralCodeResult.response?.data?.referralCode) {
    referralCode = referralCodeResult.response.data.referralCode;
    console.log(`✅ Referral code: ${referralCode}\n`);
  } else {
    console.error('❌ Failed to get referral code');
    console.error('Response:', JSON.stringify(referralCodeResult.response, null, 2));
    await pool.end();
    return;
  }

  // Step 3: Create referred customer with referral code
  const referredPhone = `987654${String(Date.now() + 1000).slice(-4)}`;
  console.log(`[3] Creating referred customer with phone: ${referredPhone}`);
  console.log(`    Using referral code: ${referralCode}`);
  
  // Delete any existing records
  await pool.query(`DELETE FROM customers WHERE phone = $1`, [referredPhone]);
  await pool.query(`DELETE FROM customer_identity WHERE phone = $1 OR phone = $2`, [referredPhone, `+91${referredPhone}`]);
  await pool.query(`DELETE FROM customer_referrals WHERE referred_phone = $1 OR referred_phone = $2`, [referredPhone, `+91${referredPhone}`]);
  
  // Send OTP
  await makeRequest(`${API_BASE_URL}/auth/send-otp`, {
    method: 'POST',
    body: { phone: referredPhone, role: 'customer' },
  });
  
  // Verify OTP with referral code
  const referredResult = await makeRequest(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    body: { 
      phone: referredPhone, 
      otp: '123456', 
      role: 'customer',
      referralCode: referralCode,
    },
  });
  
  console.log(`Response status: ${referredResult.statusCode}`);
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 4: Verify customer_identity has metadata
  console.log(`\n[4] Verifying customer_identity metadata...`);
  const identityCheck = await pool.query(
    `SELECT * FROM customer_identity WHERE phone = $1 OR phone = $2`,
    [referredPhone, `+91${referredPhone}`]
  );

  if (identityCheck.rows.length > 0) {
    const identity = identityCheck.rows[0];
    console.log(`✅ Customer identity found: ${identity.id}`);
    console.log(`   Phone: ${identity.phone}`);
    console.log(`   Status: ${identity.onboarding_status}`);
    console.log(`   Metadata: ${JSON.stringify(identity.metadata || {}, null, 2)}`);
    
    if (identity.metadata && typeof identity.metadata === 'object' && identity.metadata.referral_code_id) {
      console.log(`\n✅ SUCCESS: Referral code metadata found in customer_identity!`);
      console.log(`   Referral Code ID: ${identity.metadata.referral_code_id}`);
      console.log(`   Referrer Customer ID: ${identity.metadata.referrer_customer_id}`);
      console.log(`   Referral Code: ${identity.metadata.referral_code}`);
    } else {
      console.log(`\n❌ FAILED: Referral code metadata NOT found in customer_identity!`);
    }
  } else {
    console.log(`❌ Customer identity not found!`);
  }

  // Step 5: Verify customer_referrals record
  console.log(`\n[5] Verifying customer_referrals record...`);
  const referralCheck = await pool.query(
    `SELECT * FROM customer_referrals WHERE referred_phone = $1 OR referred_phone = $2`,
    [`+91${referredPhone}`, referredPhone]
  );
  
  console.log(`Customer Referrals Records: ${referralCheck.rows.length}`);
  if (referralCheck.rows.length > 0) {
    const referral = referralCheck.rows[0];
    console.log(`✅ Referral record found:`);
    console.log(`   ID: ${referral.id}`);
    console.log(`   Referrer: ${referral.referrer_customer_id}`);
    console.log(`   Referred Phone: ${referral.referred_phone}`);
    console.log(`   Status: ${referral.status}`);
    console.log(`   Code: ${referral.referral_code}`);
  } else {
    console.log(`❌ No referral record found!`);
  }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log('  TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await pool.end();
}

test().catch(console.error);
