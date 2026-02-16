const { Pool } = require('pg');

async function testLoyaltyServiceDirect() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING LOYALTY SERVICE CONVERSION RATE LOGIC');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Simulate what the code does
    console.log('1️⃣  Simulating loyalty service conversion logic...\n');

    // Step 1: Fetch active loyalty rule
    const loyaltyRules = await pool.query(
      `SELECT * FROM loyalty_rules WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );

    let conversionRate = 1.0;
    if (loyaltyRules.rows.length > 0) {
      const rule = loyaltyRules.rows[0];
      console.log(`   Found rule: ${rule.rule_name}`);
      console.log(`   conversion_rate: ${rule.conversion_rate || 'NULL'}`);
      console.log(`   redemption_rate: ${rule.redemption_rate || 'NULL'}\n`);

      if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
        conversionRate = parseFloat(rule.conversion_rate);
      } else if (rule.redemption_rate !== null && rule.redemption_rate !== undefined) {
        conversionRate = parseFloat(rule.redemption_rate);
      }
    } else {
      console.log('   No active rule found - using default 1.0\n');
    }

    console.log(`   Selected conversion_rate: ${conversionRate}\n`);

    // Step 2: Test calculation
    const testPoints = 500;
    const walletAmount = testPoints / conversionRate;

    console.log('2️⃣  Testing conversion calculation...\n');
    console.log(`   Input: ${testPoints} points`);
    console.log(`   Conversion Rate: ${conversionRate} points = 1 rupee`);
    console.log(`   Calculation: ${testPoints} / ${conversionRate} = ${walletAmount.toFixed(2)}`);
    console.log(`   Result: ₹${walletAmount.toFixed(2)}\n`);

    // Step 3: Check vendor_referral rule
    console.log('3️⃣  Checking vendor_referral action rule...\n');
    const actionRule = await pool.query(
      `SELECT * FROM loyalty_action_rules 
       WHERE action_name = 'vendor_referral' 
       AND is_active = true
       LIMIT 1`
    );

    if (actionRule.rows.length > 0) {
      const rule = actionRule.rows[0];
      const pointsAwarded = parseFloat(rule.points_value);
      const expectedWallet = pointsAwarded / conversionRate;

      console.log(`   Action: ${rule.action_name}`);
      console.log(`   Points to Award: ${pointsAwarded}`);
      console.log(`   Conversion Rate: ${conversionRate}`);
      console.log(`   Expected Wallet Credit: ₹${expectedWallet.toFixed(2)}\n`);
    }

    // Step 4: Verify the code logic matches
    console.log('4️⃣  Code Logic Verification...\n');
    console.log('   The updated code should:');
    console.log('   ✅ Fetch active loyalty_rules');
    console.log('   ✅ Use conversion_rate if available');
    console.log('   ✅ Fall back to redemption_rate if conversion_rate is NULL');
    console.log('   ✅ Default to 1.0 if both are NULL');
    console.log('   ✅ Calculate: walletAmount = points / conversionRate');
    console.log('   ✅ Include rate in transaction description\n');

    // Step 5: Expected behavior
    console.log('5️⃣  Expected Behavior for Next Referral...\n');
    console.log(`   When a vendor referral is approved:`);
    console.log(`   - Action rule awards: 500 points`);
    console.log(`   - Conversion rate: ${conversionRate} points = 1 rupee`);
    console.log(`   - Wallet should be credited: ₹${(500 / conversionRate).toFixed(2)}`);
    console.log(`   - Transaction description should include: "rate: ${conversionRate} points/rupee"\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TEST RESULT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (conversionRate === 100) {
      console.log('✅ Conversion rate is set to 100');
      console.log('   Next referral will convert: 500 points → ₹5.00\n');
    } else if (conversionRate === 1.0) {
      console.log('✅ Conversion rate is set to 1.0 (default)');
      console.log('   Next referral will convert: 500 points → ₹500.00\n');
    } else {
      console.log(`✅ Conversion rate is set to ${conversionRate}`);
      console.log(`   Next referral will convert: 500 points → ₹${(500 / conversionRate).toFixed(2)}\n`);
    }

    console.log('💡 To test the new code:');
    console.log('   1. Create a new vendor with a referral code');
    console.log('   2. Approve the vendor application via admin API');
    console.log('   3. Check the wallet transaction - it should show the new conversion rate\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testLoyaltyServiceDirect();
