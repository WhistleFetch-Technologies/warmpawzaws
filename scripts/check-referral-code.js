const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function checkReferralCode() {
  const referralCode = 'CREF189BO3CX';
  const phone = '9876544600';
  const phoneDigits = phone.replace(/\D/g, '');
  const fullPhone = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;
  
  console.log(`Checking referral code: ${referralCode}`);
  console.log(`Phone formats: ${phone}, ${fullPhone}\n`);
  
  // Check if code exists
  const codeCheck = await pool.query(
    `SELECT * FROM customer_referrals WHERE referral_code = $1`,
    [referralCode]
  );
  
  console.log(`Referral codes found: ${codeCheck.rows.length}`);
  if (codeCheck.rows.length > 0) {
    console.log(`   ID: ${codeCheck.rows[0].id}`);
    console.log(`   Referrer Customer ID: ${codeCheck.rows[0].referrer_customer_id}`);
    console.log(`   Referred Phone: ${codeCheck.rows[0].referred_phone}`);
    console.log(`   Status: ${codeCheck.rows[0].status}\n`);
  }
  
  // Check lookup by code only
  const codeLookup = await pool.query(
    `SELECT DISTINCT referrer_customer_id FROM customer_referrals 
     WHERE referral_code = $1 
     LIMIT 1`,
    [referralCode]
  );
  
  console.log(`Code lookup (by code only): ${codeLookup.rows.length} results`);
  if (codeLookup.rows.length > 0) {
    console.log(`   Referrer Customer ID: ${codeLookup.rows[0].referrer_customer_id}\n`);
  }
  
  await pool.end();
}

checkReferralCode();
