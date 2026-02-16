const { Pool } = require('pg');

async function checkConversionRate() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('Checking loyalty conversion rate configuration...\n');

    const rules = await pool.query(
      `SELECT rule_name, points_per_rupee, redemption_rate, conversion_rate, auto_convert_to_wallet
       FROM loyalty_rules 
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 5`
    );

    console.log('Active Loyalty Rules:');
    if (rules.rows.length > 0) {
      rules.rows.forEach((r, i) => {
        console.log(`\n${i + 1}. ${r.rule_name}:`);
        console.log(`   Points per Rupee (earning): ${r.points_per_rupee}`);
        console.log(`   Redemption Rate (points per rupee for redemption): ${r.redemption_rate}`);
        console.log(`   Conversion Rate (points to rupees): ${r.conversion_rate || 'NULL (defaults to 1.0)'}`);
        console.log(`   Auto Convert: ${r.auto_convert_to_wallet || 'NULL'}`);
        
        // Calculate what 500 points would convert to
        const conversionRate = parseFloat(r.conversion_rate || '1.0');
        const walletAmount = 500 / conversionRate;
        console.log(`   Example: 500 points = ₹${walletAmount.toFixed(2)} (using conversion_rate: ${conversionRate})`);
      });
    } else {
      console.log('   No active loyalty rules found');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  CURRENT BEHAVIOR');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Code hardcodes: 1 point = 1 rupee');
    console.log('So: 500 points = ₹500\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  EXPECTED BEHAVIOR AFTER FIX');
    console.log('═══════════════════════════════════════════════════════════════\n');
    if (rules.rows.length > 0) {
      const conversionRate = parseFloat(rules.rows[0].conversion_rate || '1.0');
      console.log(`Using conversion_rate: ${conversionRate}`);
      console.log(`So: 500 points = ₹${(500 / conversionRate).toFixed(2)}`);
    } else {
      console.log('No active rule found - will default to 1.0 (1 point = 1 rupee)');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkConversionRate();
