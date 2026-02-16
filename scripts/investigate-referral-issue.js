const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function investigate() {
  const phone = '9876549999';
  const referralCode = 'CREF189BO3CX';
  
  console.log('=== INVESTIGATING REFERRAL CODE ISSUE ===\n');
  
  // 1. Check if referral code exists
  console.log('1. Checking referral code in customer_referrals...');
  const codeCheck = await pool.query(
    `SELECT * FROM customer_referrals WHERE referral_code = $1`,
    [referralCode]
  );
  console.log(`   Found ${codeCheck.rows.length} records`);
  if (codeCheck.rows.length > 0) {
    console.log(`   Referrer Customer ID: ${codeCheck.rows[0].referrer_customer_id}`);
    console.log(`   Status: ${codeCheck.rows[0].status}`);
    console.log(`   Referred Phone: ${codeCheck.rows[0].referred_phone || 'EMPTY'}`);
  }
  console.log('');
  
  // 2. Check customer_identity
  console.log('2. Checking customer_identity...');
  const phoneDigits = phone.replace(/\D/g, '');
  const normalizedPhone = phoneDigits.length === 10 ? phoneDigits : `0${phoneDigits}`;
  const fullPhone = `+91${normalizedPhone}`;
  
  const identityCheck = await pool.query(
    `SELECT * FROM customer_identity WHERE phone = $1 OR phone = $2 OR phone = $3`,
    [phone, normalizedPhone, fullPhone]
  );
  console.log(`   Found ${identityCheck.rows.length} records`);
  identityCheck.rows.forEach((row, idx) => {
    console.log(`   Record ${idx + 1}:`);
    console.log(`     ID: ${row.id}`);
    console.log(`     Phone: ${row.phone}`);
    console.log(`     Onboarding Status: ${row.onboarding_status}`);
    console.log(`     Metadata: ${JSON.stringify(row.metadata || {})}`);
    console.log(`     Created At: ${row.created_at}`);
  });
  console.log('');
  
  // 3. Check if customer exists
  console.log('3. Checking customers table...');
  const customerCheck = await pool.query(
    `SELECT * FROM customers WHERE phone = $1 OR phone = $2 OR phone = $3`,
    [phone, normalizedPhone, fullPhone]
  );
  console.log(`   Found ${customerCheck.rows.length} records`);
  if (customerCheck.rows.length > 0) {
    console.log(`   Customer ID: ${customerCheck.rows[0].id}`);
    console.log(`   Customer Identity ID: ${customerCheck.rows[0].customer_identity_id || 'NULL'}`);
  }
  console.log('');
  
  // 4. Check for any referral records with this phone
  console.log('4. Checking customer_referrals for this phone...');
  const phoneReferralCheck = await pool.query(
    `SELECT * FROM customer_referrals WHERE referred_phone = $1 OR referred_phone = $2 OR referred_phone = $3`,
    [phone, normalizedPhone, fullPhone]
  );
  console.log(`   Found ${phoneReferralCheck.rows.length} records`);
  phoneReferralCheck.rows.forEach((row, idx) => {
    console.log(`   Record ${idx + 1}:`);
    console.log(`     ID: ${row.id}`);
    console.log(`     Referrer Customer ID: ${row.referrer_customer_id}`);
    console.log(`     Referral Code: ${row.referral_code}`);
    console.log(`     Referred Phone: ${row.referred_phone}`);
    console.log(`     Status: ${row.status}`);
    console.log(`     Applied At: ${row.applied_at || 'NULL'}`);
  });
  console.log('');
  
  await pool.end();
}

investigate();
