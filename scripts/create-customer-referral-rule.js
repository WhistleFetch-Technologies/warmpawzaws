const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function createRule() {
  console.log('Creating customer_referral action rule...\n');
  
  try {
    // Check if exists
    const check = await pool.query(
      `SELECT * FROM loyalty_action_rules WHERE action_name = $1`,
      ['customer_referral']
    );
    
    if (check.rows.length > 0) {
      console.log('✅ Rule already exists:');
      console.log(JSON.stringify(check.rows[0], null, 2));
      await pool.end();
      return;
    }
    
    // Create rule
    const result = await pool.query(`
      INSERT INTO loyalty_action_rules (
        action_name,
        action_category,
        user_type,
        points_type,
        points_value,
        frequency_type,
        frequency_limit,
        is_active,
        priority,
        description
      ) VALUES (
        'customer_referral',
        'referral_rewards',
        'customer',
        'fixed',
        100,
        'unlimited',
        NULL,
        true,
        100,
        'Points awarded when a referred customer creates an account using referral code'
      )
      RETURNING *
    `);
    
    console.log('✅ Rule created:');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    if (error.code === '23505') {
      // Unique constraint violation - rule already exists
      console.log('✅ Rule already exists (unique constraint)');
      const existing = await pool.query(
        `SELECT * FROM loyalty_action_rules WHERE action_name = $1`,
        ['customer_referral']
      );
      if (existing.rows.length > 0) {
        console.log(JSON.stringify(existing.rows[0], null, 2));
      }
    } else {
      console.error('❌ Error:', error.message);
      console.error('Code:', error.code);
    }
  }
  
  await pool.end();
}

createRule().catch(console.error);
