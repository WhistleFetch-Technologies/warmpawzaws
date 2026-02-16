const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function investigate() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  INVESTIGATING REFERRAL CODE METADATA ISSUE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const referralCode = 'CREF189BO3CX';
  const testPhone = '9876540788'; // From last test

  // Step 1: Check if referral code exists
  console.log('[1] Checking if referral code exists in customer_referrals...');
  const codeCheck = await pool.query(
    `SELECT * FROM customer_referrals WHERE referral_code = $1`,
    [referralCode]
  );
  console.log(`   Found ${codeCheck.rows.length} records with code ${referralCode}`);
  if (codeCheck.rows.length > 0) {
    codeCheck.rows.forEach((row, i) => {
      console.log(`   Record ${i + 1}:`);
      console.log(`     ID: ${row.id}`);
      console.log(`     Referrer Customer ID: ${row.referrer_customer_id}`);
      console.log(`     Referred Phone: ${row.referred_phone || 'NULL'}`);
      console.log(`     Status: ${row.status}`);
      console.log(`     Created: ${row.created_at}`);
    });
  } else {
    console.log('   ❌ Referral code NOT FOUND in database!');
  }

  // Step 2: Check customer_identity for test phone
  console.log(`\n[2] Checking customer_identity for phone: ${testPhone}...`);
  const identityCheck1 = await pool.query(
    `SELECT * FROM customer_identity WHERE phone = $1`,
    [testPhone]
  );
  console.log(`   Found ${identityCheck1.rows.length} records with phone ${testPhone}`);
  
  const identityCheck2 = await pool.query(
    `SELECT * FROM customer_identity WHERE phone = $1`,
    [`+91${testPhone}`]
  );
  console.log(`   Found ${identityCheck2.rows.length} records with phone +91${testPhone}`);
  
  const allIdentities = [...identityCheck1.rows, ...identityCheck2.rows];
  if (allIdentities.length > 0) {
    allIdentities.forEach((row, i) => {
      console.log(`   Identity ${i + 1}:`);
      console.log(`     ID: ${row.id}`);
      console.log(`     Phone: ${row.phone}`);
      console.log(`     Status: ${row.onboarding_status}`);
      console.log(`     Metadata Type: ${typeof row.metadata}`);
      console.log(`     Metadata: ${JSON.stringify(row.metadata, null, 2)}`);
      if (row.metadata && typeof row.metadata === 'object') {
        console.log(`     Has referral_code_id: ${!!row.metadata.referral_code_id}`);
      }
    });
  }

  // Step 3: Check customer_referrals for test phone
  console.log(`\n[3] Checking customer_referrals for phone: ${testPhone}...`);
  const referralCheck1 = await pool.query(
    `SELECT * FROM customer_referrals WHERE referred_phone = $1`,
    [testPhone]
  );
  console.log(`   Found ${referralCheck1.rows.length} records with referred_phone ${testPhone}`);
  
  const referralCheck2 = await pool.query(
    `SELECT * FROM customer_referrals WHERE referred_phone = $1`,
    [`+91${testPhone}`]
  );
  console.log(`   Found ${referralCheck2.rows.length} records with referred_phone +91${testPhone}`);
  
  const allReferrals = [...referralCheck1.rows, ...referralCheck2.rows];
  if (allReferrals.length > 0) {
    allReferrals.forEach((row, i) => {
      console.log(`   Referral ${i + 1}:`);
      console.log(`     ID: ${row.id}`);
      console.log(`     Referrer: ${row.referrer_customer_id}`);
      console.log(`     Referred Phone: ${row.referred_phone}`);
      console.log(`     Code: ${row.referral_code}`);
      console.log(`     Status: ${row.status}`);
    });
  }

  // Step 4: Check referrer customer
  if (codeCheck.rows.length > 0) {
    const referrerId = codeCheck.rows[0].referrer_customer_id;
    console.log(`\n[4] Checking referrer customer: ${referrerId}...`);
    const referrerCheck = await pool.query(
      `SELECT id, phone, full_name FROM customers WHERE id = $1`,
      [referrerId]
    );
    if (referrerCheck.rows.length > 0) {
      console.log(`   Referrer exists: ${referrerCheck.rows[0].full_name || 'N/A'}`);
      console.log(`   Phone: ${referrerCheck.rows[0].phone}`);
    } else {
      console.log(`   ❌ Referrer customer NOT FOUND!`);
    }
  }

  // Step 5: Check table structure
  console.log(`\n[5] Checking customer_identity table structure...`);
  const tableInfo = await pool.query(`
    SELECT 
      column_name, 
      data_type, 
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_name = 'customer_identity'
    ORDER BY ordinal_position
  `);
  console.log('   Columns:');
  tableInfo.rows.forEach(col => {
    console.log(`     ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
  });

  // Step 6: Check constraints
  console.log(`\n[6] Checking constraints on customer_identity...`);
  const constraints = await pool.query(`
    SELECT 
      conname as constraint_name,
      contype as constraint_type
    FROM pg_constraint
    WHERE conrelid = 'customer_identity'::regclass
  `);
  console.log(`   Found ${constraints.rows.length} constraints:`);
  constraints.rows.forEach(con => {
    console.log(`     ${con.constraint_name}: ${con.constraint_type}`);
  });

  // Step 7: Test phone normalization
  console.log(`\n[7] Testing phone normalization logic...`);
  const phoneVariants = [
    testPhone,
    `+91${testPhone}`,
    `91${testPhone}`,
    `0${testPhone}`,
  ];
  for (const variant of phoneVariants) {
    const phoneDigits = variant.replace(/\D/g, '');
    const normalized = phoneDigits.length > 10 
      ? phoneDigits.slice(-10)  
      : phoneDigits.length === 9 
        ? '0' + phoneDigits      
        : phoneDigits;
    const fullPhone = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;
    console.log(`   Input: ${variant} -> Normalized (10-digit): ${normalized}, Full (+91): ${fullPhone}`);
  }

  await pool.end();
}

investigate().catch(console.error);
