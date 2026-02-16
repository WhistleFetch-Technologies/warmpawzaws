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
const referralCode = 'CREF189BO3CX';
const testPhone = `987654${String(Date.now()).slice(-4)}`;

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
  console.log('=== CHECKING REFERRAL RECORD CREATION ===\n');
  console.log(`Phone: ${testPhone}`);
  console.log(`Referral Code: ${referralCode}\n`);

  // Delete existing
  await pool.query(`DELETE FROM customers WHERE phone = $1`, [testPhone]);
  await pool.query(`DELETE FROM customer_identity WHERE phone = $1 OR phone = $2`, [testPhone, `+91${testPhone}`]);
  await pool.query(`DELETE FROM customer_referrals WHERE referred_phone = $1 OR referred_phone = $2`, [testPhone, `+91${testPhone}`]);

  // Check referral code exists
  const codeCheck = await pool.query(
    `SELECT * FROM customer_referrals WHERE referral_code = $1 LIMIT 1`,
    [referralCode]
  );
  console.log(`Referral code exists: ${codeCheck.rows.length > 0}`);
  if (codeCheck.rows.length > 0) {
    console.log(`  Referrer: ${codeCheck.rows[0].referrer_customer_id}`);
    console.log(`  Existing phone: ${codeCheck.rows[0].referred_phone || 'NULL'}\n`);
  }

  // Send OTP
  await makeRequest(`${API_BASE_URL}/auth/send-otp`, {
    method: 'POST',
    body: { phone: testPhone, role: 'customer' },
  });

  // Verify OTP with referral code
  console.log('Sending verify-otp with referral code...');
  const result = await makeRequest(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    body: {
      phone: testPhone,
      otp: '123456',
      role: 'customer',
      referralCode: referralCode,
    },
  });

  console.log(`Response status: ${result.statusCode}\n`);

  // Wait
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check customer_referrals
  console.log('Checking customer_referrals...');
  const referralCheck1 = await pool.query(
    `SELECT * FROM customer_referrals WHERE referred_phone = $1`,
    [testPhone]
  );
  const referralCheck2 = await pool.query(
    `SELECT * FROM customer_referrals WHERE referred_phone = $1`,
    [`+91${testPhone}`]
  );
  
  const allReferrals = [...referralCheck1.rows, ...referralCheck2.rows];
  console.log(`Found ${allReferrals.length} referral records`);
  if (allReferrals.length > 0) {
    allReferrals.forEach((r, i) => {
      console.log(`  Record ${i + 1}:`);
      console.log(`    ID: ${r.id}`);
      console.log(`    Referrer: ${r.referrer_customer_id}`);
      console.log(`    Phone: ${r.referred_phone}`);
      console.log(`    Code: ${r.referral_code}`);
      console.log(`    Status: ${r.status}`);
    });
  } else {
    console.log('  ❌ NO REFERRAL RECORD CREATED!');
  }

  // Check customer_identity
  console.log('\nChecking customer_identity...');
  const identityCheck = await pool.query(
    `SELECT * FROM customer_identity WHERE phone = $1 OR phone = $2`,
    [testPhone, `+91${testPhone}`]
  );
  console.log(`Found ${identityCheck.rows.length} identity records`);
  if (identityCheck.rows.length > 0) {
    identityCheck.rows.forEach((i, idx) => {
      console.log(`  Identity ${idx + 1}:`);
      console.log(`    ID: ${i.id}`);
      console.log(`    Phone: ${i.phone}`);
      console.log(`    Metadata: ${JSON.stringify(i.metadata || {}, null, 2)}`);
      if (i.metadata && typeof i.metadata === 'object' && i.metadata.referral_code_id) {
        console.log(`    ✅ Has referral_code_id: ${i.metadata.referral_code_id}`);
      } else {
        console.log(`    ❌ NO referral_code_id in metadata!`);
      }
    });
  }

  await pool.end();
}

test().catch(console.error);
