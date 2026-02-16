const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const PHONE = process.argv[2];
const OTP = process.argv[3];
const REFERRAL_CODE = process.argv[4] || 'VREFCA45O7N4';

if (!PHONE || !OTP) {
  console.log('Usage: node scripts/check-referral-storage.js <phone> <otp> [referralCode]');
  process.exit(1);
}

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function checkReferralStorage() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CHECKING REFERRAL CODE STORAGE AFTER OTP VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const normalizedPhone = PHONE.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;

    console.log(`Phone: ${PHONE} (${fullPhone})`);
    console.log(`OTP: ${OTP}`);
    console.log(`Referral Code: ${REFERRAL_CODE}\n`);

    // Step 1: Verify OTP with referral code
    console.log('1️⃣  Verifying OTP with referral code...\n');
    const verifyResult = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      'POST',
      {
        phone: fullPhone,
        otp: OTP,
        role: 'vendor',
        referralCode: REFERRAL_CODE
      }
    );

    if (verifyResult.statusCode !== 200) {
      console.log(`❌ OTP verification failed: ${JSON.stringify(verifyResult.response)}\n`);
      return;
    }

    console.log('✅ OTP verified successfully\n');

    // Step 2: Check vendor_identity metadata
    console.log('2️⃣  Checking vendor_identity metadata...\n');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for DB update

    const identity = await pool.query(
      `SELECT id, phone, metadata, onboarding_status, created_at
       FROM vendor_identity 
       WHERE phone = $1 OR phone = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedPhone, fullPhone.replace('+', '')]
    );

    if (identity.rows.length === 0) {
      console.log('❌ vendor_identity NOT FOUND!\n');
      return;
    }

    const vi = identity.rows[0];
    console.log(`   Vendor Identity ID: ${vi.id}`);
    console.log(`   Phone: ${vi.phone}`);
    console.log(`   Onboarding Status: ${vi.onboarding_status}`);
    
    let metadata = vi.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }
    console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);

    const hasReferral = !!(metadata.referral_code_id || metadata.referral_code);
    if (hasReferral) {
      console.log('   ✅ SUCCESS: Referral code stored in metadata!\n');
      console.log(`      Referral Code ID: ${metadata.referral_code_id || 'NULL'}`);
      console.log(`      Referrer Vendor ID: ${metadata.referrer_vendor_id || 'NULL'}`);
      console.log(`      Referral Code: ${metadata.referral_code || 'NULL'}\n`);
    } else {
      console.log('   ❌ FAILURE: Referral code NOT stored in metadata!\n');
    }

    // Step 3: Check vendor_referrals
    console.log('3️⃣  Checking vendor_referrals...\n');
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referred_phone = $1 OR referred_phone = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [fullPhone, normalizedPhone]
    );

    if (referrals.rows.length > 0) {
      const ref = referrals.rows[0];
      console.log('   ✅ Referral record found:\n');
      console.log(`      ID: ${ref.id}`);
      console.log(`      Code: ${ref.referral_code}`);
      console.log(`      Status: ${ref.status}`);
      console.log(`      Referrer: ${ref.referrer_vendor_id}\n`);
    } else {
      console.log('   ❌ No referral record found\n');
    }

    // Final verdict
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FINAL VERDICT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (hasReferral && referrals.rows.length > 0) {
      console.log('✅ SUCCESS: Referral code was stored correctly!');
      console.log('✅ Flow is working - points will be awarded on approval\n');
    } else {
      console.log('❌ FAILURE: Referral code was NOT stored!');
      console.log('❌ Flow is broken - needs investigation\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkReferralStorage();
