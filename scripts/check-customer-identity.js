const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function checkCustomerIdentity() {
  const phone = process.argv[2] || '9876541418';
  const phoneDigits = phone.replace(/\D/g, '');
  const normalizedPhone = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;
  
  console.log(`Checking for phone: ${phone} or ${normalizedPhone}\n`);
  
  const result = await pool.query(
    `SELECT id, phone, metadata, onboarding_status, created_at 
     FROM customer_identity 
     WHERE phone = $1 OR phone = $2 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [phone, normalizedPhone]
  );
  
  if (result.rows.length === 0) {
    console.log('❌ No customer_identity found\n');
  } else {
    const identity = result.rows[0];
    console.log('✅ Customer Identity Found:');
    console.log(`   ID: ${identity.id}`);
    console.log(`   Phone: ${identity.phone}`);
    console.log(`   Onboarding Status: ${identity.onboarding_status}`);
    console.log(`   Created At: ${identity.created_at}`);
    
    let metadata = identity.metadata || {};
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }
    
    console.log(`   Metadata: ${JSON.stringify(metadata, null, 2)}\n`);
    
    if (metadata.referral_code_id) {
      console.log('✅ Referral code found in metadata!');
      console.log(`   Referral Code ID: ${metadata.referral_code_id}`);
      console.log(`   Referrer Customer ID: ${metadata.referrer_customer_id}`);
      console.log(`   Referral Code: ${metadata.referral_code}\n`);
    } else {
      console.log('❌ Referral code NOT in metadata\n');
    }
  }
  
  await pool.end();
}

checkCustomerIdentity();
