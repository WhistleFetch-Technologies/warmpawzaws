const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function check() {
  console.log('Checking loyalty_action_rules for customer_referral...\n');
  
  const result = await pool.query(
    `SELECT * FROM loyalty_action_rules WHERE action_name = $1`,
    ['customer_referral']
  );
  
  if (result.rows.length > 0) {
    console.log('✅ Rule found:');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } else {
    console.log('❌ Rule NOT FOUND!');
    console.log('\nCreating rule...');
    
    await pool.query(`
      INSERT INTO loyalty_action_rules (
        action_name,
        action_category,
        user_type,
        points_type,
        points_value,
        frequency_type,
        frequency_limit,
        is_active,
        priority
      ) VALUES (
        'customer_referral',
        'referral',
        'customer',
        'fixed',
        100,
        'one_time',
        1,
        true,
        100
      )
      ON CONFLICT (action_name, user_type) 
      DO UPDATE SET 
        points_value = 100,
        is_active = true
    `);
    
    console.log('✅ Rule created/updated');
  }
  
  await pool.end();
}

check().catch(console.error);
