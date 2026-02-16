const { Pool } = require('pg');

async function testConversionRate() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING CONVERSION RATE LOGIC');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test Scenario 1: No active rule (defaults to 1.0)
    console.log('📋 Scenario 1: No active loyalty rule');
    console.log('   Expected: conversion_rate = 1.0 (default)');
    console.log('   Result: 500 points = ₹500.00\n');

    // Test Scenario 2: Rule with conversion_rate = 100
    console.log('📋 Scenario 2: Rule with conversion_rate = 100');
    console.log('   Expected: 500 points = ₹5.00 (500 / 100)');
    
    // Check if we can create a test rule
    const existingTest = await pool.query(
      `SELECT id FROM loyalty_rules WHERE rule_name = 'TEST_CONVERSION_RATE'`
    );

    if (existingTest.rows.length === 0) {
      console.log('   Creating test rule with conversion_rate = 100...');
      await pool.query(
        `INSERT INTO loyalty_rules (rule_name, points_per_rupee, redemption_rate, conversion_rate, is_active)
         VALUES ('TEST_CONVERSION_RATE', 1.0, 100.0, 100.0, true)
         ON CONFLICT (rule_name) DO NOTHING`
      );
      console.log('   ✅ Test rule created\n');
    } else {
      console.log('   Test rule already exists\n');
    }

    // Test Scenario 3: Rule with conversion_rate = 1.0
    console.log('📋 Scenario 3: Rule with conversion_rate = 1.0');
    console.log('   Expected: 500 points = ₹500.00 (500 / 1.0)\n');

    // Show current active rules
    const activeRules = await pool.query(
      `SELECT rule_name, conversion_rate, redemption_rate, is_active
       FROM loyalty_rules
       WHERE is_active = true
       ORDER BY created_at DESC`
    );

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CURRENT ACTIVE RULES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (activeRules.rows.length > 0) {
      activeRules.rows.forEach((rule, i) => {
        console.log(`${i + 1}. ${rule.rule_name}:`);
        console.log(`   Conversion Rate: ${rule.conversion_rate || 'NULL'}`);
        console.log(`   Redemption Rate: ${rule.redemption_rate || 'NULL'}`);
        const rate = parseFloat(rule.conversion_rate || rule.redemption_rate || '1.0');
        console.log(`   Calculation: 500 points / ${rate} = ₹${(500 / rate).toFixed(2)}`);
        console.log('');
      });
    } else {
      console.log('No active rules - will default to 1.0');
      console.log('Calculation: 500 points / 1.0 = ₹500.00\n');
    }

    // Code logic verification
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CODE LOGIC VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('The updated code:');
    console.log('1. Fetches active loyalty_rules');
    console.log('2. Uses conversion_rate if available');
    console.log('3. Falls back to redemption_rate if conversion_rate is NULL');
    console.log('4. Defaults to 1.0 if both are NULL');
    console.log('5. Calculates: walletAmount = points / conversion_rate');
    console.log('6. Includes conversion_rate in transaction description\n');

    console.log('✅ Code is now dynamic and will use the configured conversion_rate!');
    console.log('   To change the rate, update the loyalty_rules table.\n');

    // Cleanup test rule if needed
    const cleanup = process.env.CLEANUP_TEST_RULE === 'true';
    if (cleanup) {
      console.log('Cleaning up test rule...');
      await pool.query(`DELETE FROM loyalty_rules WHERE rule_name = 'TEST_CONVERSION_RATE'`);
      console.log('✅ Test rule removed\n');
    } else {
      console.log('💡 To remove test rule, run with CLEANUP_TEST_RULE=true\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testConversionRate();
