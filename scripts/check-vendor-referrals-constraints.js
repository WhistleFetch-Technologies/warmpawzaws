const { Pool } = require('pg');

async function checkConstraints() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const result = await pool.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint 
      WHERE conrelid = 'vendor_referrals'::regclass
      ORDER BY conname;
    `);

    console.log('Constraints on vendor_referrals table:');
    console.log(JSON.stringify(result.rows, null, 2));

    // Check if referral_code_key still exists
    const hasReferralCodeKey = result.rows.some(r => r.constraint_name === 'vendor_referrals_referral_code_key');
    console.log(`\nHas vendor_referrals_referral_code_key: ${hasReferralCodeKey}`);

    // Check if new constraint exists
    const hasReferrerPhoneUnique = result.rows.some(r => r.constraint_name === 'vendor_referrals_referrer_phone_unique');
    console.log(`Has vendor_referrals_referrer_phone_unique: ${hasReferrerPhoneUnique}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkConstraints();
