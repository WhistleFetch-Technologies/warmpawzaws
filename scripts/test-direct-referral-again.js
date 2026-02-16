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

// Use the exact same phone format as the test
const testPhone = '9876542493';

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
  console.log('=== TESTING WITH EXACT SAME PHONE AS FAILED TEST ===\n');
  console.log(`Phone: ${testPhone}`);
  console.log(`Referral Code: ${referralCode}\n`);

  // Delete existing customer and identity to test fresh
  console.log('Deleting existing customer and identity...');
  await pool.query(`DELETE FROM customers WHERE phone = $1`, [testPhone]);
  await pool.query(`DELETE FROM customer_identity WHERE phone = $1 OR phone = $2`, [testPhone, `+91${testPhone}`]);
  console.log('Deleted.\n');

  const requestBody = {
    phone: testPhone,
    otp: '123456',
    role: 'customer',
    referralCode: referralCode,
  };

  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  console.log('');

  try {
    const result = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      {
        method: 'POST',
        body: requestBody,
      }
    );

    console.log('Response status:', result.statusCode);
    console.log('');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check customer_identity
    const identityCheck = await pool.query(
      `SELECT * FROM customer_identity WHERE phone = $1 OR phone = $2`,
      [testPhone, `+91${testPhone}`]
    );

    console.log('=== RESULTS ===\n');
    console.log(`Customer Identity Records: ${identityCheck.rows.length}`);
    
    if (identityCheck.rows.length > 0) {
      const identity = identityCheck.rows[0];
      console.log(`ID: ${identity.id}`);
      console.log(`Phone: ${identity.phone}`);
      console.log(`Onboarding Status: ${identity.onboarding_status}`);
      console.log(`Metadata: ${JSON.stringify(identity.metadata || {}, null, 2)}`);
      
      if (identity.metadata && typeof identity.metadata === 'object' && identity.metadata.referral_code_id) {
        console.log('\n✅ SUCCESS: Referral code metadata found!');
      } else {
        console.log('\n❌ FAILED: Referral code metadata NOT found!');
      }
    } else {
      console.log('\n❌ FAILED: No customer_identity found!');
    }

  } catch (error) {
    console.error('Error:', error);
  }

  await pool.end();
}

test();
