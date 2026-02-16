const { Pool } = require('pg');

async function debugConversionRate() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DEBUGGING CONVERSION RATE ISSUE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check what the code should be doing
    console.log('1️⃣  Simulating what the code does...\n');

    // Step 1: Check active loyalty rules (what select() would return)
    const loyaltyRules = await pool.query(
      `SELECT * FROM loyalty_rules WHERE is_active = true ORDER BY created_at DESC`
    );

    console.log(`   Found ${loyaltyRules.rows.length} active rule(s):\n`);
    
    if (loyaltyRules.rows.length > 0) {
      loyaltyRules.rows.forEach((rule, i) => {
        console.log(`   Rule ${i + 1}: ${rule.rule_name}`);
        console.log(`      conversion_rate: ${rule.conversion_rate} (type: ${typeof rule.conversion_rate})`);
        console.log(`      redemption_rate: ${rule.redemption_rate} (type: ${typeof rule.redemption_rate})`);
        console.log(`      is_active: ${rule.is_active}\n`);
      });

      const rule = loyaltyRules.rows[0];
      let conversionRate = 1.0;

      // Simulate the code logic
      if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
        conversionRate = parseFloat(rule.conversion_rate);
        console.log(`   ✅ Using conversion_rate: ${conversionRate}`);
      } else if (rule.redemption_rate !== null && rule.redemption_rate !== undefined) {
        conversionRate = parseFloat(rule.redemption_rate);
        console.log(`   ✅ Using redemption_rate: ${conversionRate}`);
      } else {
        console.log(`   ⚠️  Both are NULL, using default: ${conversionRate}`);
      }

      console.log(`\n   Calculated conversion rate: ${conversionRate}`);
      console.log(`   Expected: 500 points / ${conversionRate} = ₹${(500 / conversionRate).toFixed(2)}\n`);
    } else {
      console.log('   ⚠️  No active rules found - would default to 1.0\n');
    }

    // Step 2: Check recent wallet transactions
    console.log('2️⃣  Checking recent wallet transactions...\n');
    const vendorId = 'bcff4da9-99b1-401f-ab62-5d70526331ec';
    
    const transactions = await pool.query(
      `SELECT vwt.*, vw.balance as current_balance
       FROM vendor_wallet_transactions vwt
       JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
       WHERE vwt.vendor_id = $1
       ORDER BY vwt.created_at DESC
       LIMIT 5`,
      [vendorId]
    );

    if (transactions.rows.length > 0) {
      transactions.rows.forEach((tx, i) => {
        console.log(`   Transaction ${i + 1}:`);
        console.log(`      Description: ${tx.description}`);
        console.log(`      Amount: ₹${tx.amount}`);
        console.log(`      Balance After: ₹${tx.balance_after}`);
        console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}`);
        
        // Check if it has conversion rate info
        if (tx.description && (tx.description.includes('rate:') || tx.description.includes('conversion_rate'))) {
          console.log(`      ✅ NEW CODE - Has conversion rate info`);
        } else {
          console.log(`      ⚠️  OLD CODE - No conversion rate info`);
        }
        console.log('');
      });
    } else {
      console.log('   No transactions found\n');
    }

    // Step 3: Check if there's a SELECT issue
    console.log('3️⃣  Testing SELECT query (what the code uses)...\n');
    
    // The code uses: select('loyalty_rules', { is_active: true })
    // This should return rows where is_active = true
    const selectTest = await pool.query(
      `SELECT * FROM loyalty_rules WHERE is_active = true`
    );

    console.log(`   SELECT query returned ${selectTest.rows.length} row(s)`);
    if (selectTest.rows.length > 0) {
      const first = selectTest.rows[0];
      console.log(`   First row:`);
      console.log(`      rule_name: ${first.rule_name}`);
      console.log(`      conversion_rate: ${first.conversion_rate} (${typeof first.conversion_rate})`);
      console.log(`      is_active: ${first.is_active}`);
      
      // Check if conversion_rate is actually a number
      if (first.conversion_rate !== null && first.conversion_rate !== undefined) {
        const rate = parseFloat(first.conversion_rate);
        console.log(`      Parsed: ${rate}`);
        console.log(`      Is NaN: ${isNaN(rate)}`);
        console.log(`      Calculation test: 500 / ${rate} = ${500 / rate}`);
      }
    }
    console.log('');

    // Step 4: Check if there are multiple active rules
    console.log('4️⃣  Checking for multiple active rules...\n');
    const allRules = await pool.query(
      `SELECT rule_name, is_active, conversion_rate, created_at
       FROM loyalty_rules
       ORDER BY created_at DESC`
    );

    console.log(`   Total rules in table: ${allRules.rows.length}`);
    const activeCount = allRules.rows.filter(r => r.is_active).length;
    const inactiveCount = allRules.rows.filter(r => !r.is_active).length;
    console.log(`   Active: ${activeCount}, Inactive: ${inactiveCount}\n`);

    if (allRules.rows.length > 0) {
      console.log('   All rules:');
      allRules.rows.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.rule_name} (active: ${r.is_active}, rate: ${r.conversion_rate || 'NULL'})`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (loyaltyRules.rows.length === 0) {
      console.log('❌ PROBLEM: No active loyalty rules found!');
      console.log('   The code will default to 1.0 (1 point = 1 rupee)');
      console.log('   Solution: Ensure there is an active loyalty rule with conversion_rate set.\n');
    } else {
      const rule = loyaltyRules.rows[0];
      const rate = parseFloat(rule.conversion_rate || rule.redemption_rate || '1.0');
      
      if (rate === 1.0) {
        console.log('⚠️  Conversion rate is 1.0 (1 point = 1 rupee)');
        console.log('   This means 500 points = ₹500');
        console.log('   If you want 500 points = ₹5, set conversion_rate = 100\n');
      } else {
        console.log(`✅ Conversion rate is ${rate}`);
        console.log(`   This means 500 points should = ₹${(500 / rate).toFixed(2)}`);
        console.log('   If you\'re still seeing ₹500, the code might not be using it correctly.\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugConversionRate();
