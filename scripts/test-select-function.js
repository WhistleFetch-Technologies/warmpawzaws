const { Pool } = require('pg');

async function testSelectFunction() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('Testing how select() function works...\n');

    // Simulate what select('loyalty_rules', { is_active: true }) does
    // The select function likely does: SELECT * FROM table WHERE conditions
    
    const result = await pool.query(
      `SELECT * FROM loyalty_rules WHERE is_active = true`
    );

    console.log(`Found ${result.rows.length} row(s)\n`);

    if (result.rows.length > 0) {
      const rule = result.rows[0];
      console.log('First row data:');
      console.log(JSON.stringify(rule, null, 2));
      console.log('\n');

      // Check conversion_rate
      console.log('Checking conversion_rate:');
      console.log(`  Raw value: ${rule.conversion_rate}`);
      console.log(`  Type: ${typeof rule.conversion_rate}`);
      console.log(`  Is null: ${rule.conversion_rate === null}`);
      console.log(`  Is undefined: ${rule.conversion_rate === undefined}`);
      
      if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
        const parsed = parseFloat(rule.conversion_rate);
        console.log(`  Parsed: ${parsed}`);
        console.log(`  Is NaN: ${isNaN(parsed)}`);
        console.log(`  Test calculation: 500 / ${parsed} = ${500 / parsed}`);
      }
    }

    // Also test with the exact query the code would use
    console.log('\n\nTesting exact code logic:\n');
    
    const loyaltyRules = result.rows; // Simulating select() return
    let conversionRate = 1.0;

    if (loyaltyRules.length > 0) {
      const rule = loyaltyRules[0];
      console.log(`Rule found: ${rule.rule_name}`);
      console.log(`conversion_rate check: ${rule.conversion_rate !== null && rule.conversion_rate !== undefined ? 'PASS' : 'FAIL'}`);
      
      if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
        conversionRate = parseFloat(rule.conversion_rate);
        console.log(`✅ Using conversion_rate: ${conversionRate}`);
      } else if (rule.redemption_rate !== null && rule.redemption_rate !== undefined) {
        conversionRate = parseFloat(rule.redemption_rate);
        console.log(`✅ Using redemption_rate: ${conversionRate}`);
      } else {
        console.log(`⚠️  Using default: ${conversionRate}`);
      }
    } else {
      console.log('No rules found, using default');
    }

    console.log(`\nFinal conversion rate: ${conversionRate}`);
    console.log(`Expected wallet amount for 500 points: ₹${(500 / conversionRate).toFixed(2)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testSelectFunction();
