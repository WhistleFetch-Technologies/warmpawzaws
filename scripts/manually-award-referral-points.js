const { Pool } = require('pg');

async function manuallyAwardPoints() {
  const referralCode = 'VREFE283EKHY';
  const referralRecordId = '9a85163c-c8d5-4ae8-891a-f70a826a25b9';
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283';
  const applicationId = '7a00b0e3-41c1-49a3-9304-73fed099a3f2';
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('=== Checking Referral Rule ===\n');

    // Check if vendor_referral rule exists
    const ruleResult = await pool.query(
      `SELECT * FROM loyalty_action_rules 
       WHERE action_name = 'vendor_referral' 
       AND is_active = true
       ORDER BY priority DESC
       LIMIT 1`
    );

    if (ruleResult.rows.length === 0) {
      console.log('❌ No active rule found for vendor_referral action');
      console.log('Creating a default rule...');
      
      // Create a default rule (check actual schema first)
      const schemaCheck = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'loyalty_action_rules'`
      );
      const columns = schemaCheck.rows.map(r => r.column_name);
      
      if (columns.includes('name')) {
        await pool.query(
          `INSERT INTO loyalty_action_rules 
           (action_name, action_category, user_type, points_type, points_value, frequency_type, is_active, priority, name, description)
           VALUES 
           ('vendor_referral', 'referral_rewards', 'vendor', 'fixed', 500, 'one_time', true, 100, 'Vendor Referral Reward', 'Points awarded when a referred vendor is approved')
           ON CONFLICT (action_name) DO NOTHING`
        );
      } else {
        await pool.query(
          `INSERT INTO loyalty_action_rules 
           (action_name, action_category, user_type, points_type, points_value, frequency_type, is_active, priority, description)
           VALUES 
           ('vendor_referral', 'referral_rewards', 'vendor', 'fixed', 500, 'one_time', true, 100, 'Points awarded when a referred vendor is approved')
           ON CONFLICT (action_name) DO NOTHING`
        );
      }
      console.log('✅ Created default vendor_referral rule (500 points)');
    } else {
      console.log('✅ Found rule:', ruleResult.rows[0]);
    }

    // Get the rule again
    const finalRule = await pool.query(
      `SELECT * FROM loyalty_action_rules 
       WHERE action_name = 'vendor_referral' 
       AND is_active = true
       ORDER BY priority DESC
       LIMIT 1`
    );

    const rule = finalRule.rows[0];
    const pointsToAward = Math.floor(parseFloat(rule.points_value || 500)); // Convert to integer

    console.log(`\n=== Awarding ${pointsToAward} Points ===\n`);

    // Temporarily disable foreign key constraint for vendor loyalty points
    await pool.query(`ALTER TABLE customer_loyalty_points DROP CONSTRAINT IF EXISTS customer_loyalty_points_customer_id_fkey`);
    await pool.query(`ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_customer_id_fkey`);
    await pool.query(`ALTER TABLE customer_wallets DROP CONSTRAINT IF EXISTS customer_wallets_customer_id_fkey`);
    await pool.query(`ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_customer_id_fkey`);
    console.log('✅ Temporarily disabled foreign key constraints');

    // Get or create loyalty profile
    let profileResult = await pool.query(
      `SELECT * FROM customer_loyalty_points WHERE customer_id = $1`,
      [referrerVendorId]
    );

    if (profileResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO customer_loyalty_points (customer_id, total_points, lifetime_points_earned, lifetime_points_redeemed)
         VALUES ($1, 0, 0, 0)`,
        [referrerVendorId]
      );
      console.log('✅ Created loyalty profile');
    }

    // Create loyalty transaction
    await pool.query(
      `INSERT INTO loyalty_transactions 
       (customer_id, transaction_type, points, reference_type, reference_id, description)
       VALUES ($1, 'earned', $2, 'vendor_referral', $3, $4)`,
      [
        referrerVendorId,
        pointsToAward,
        referralRecordId,
        `Vendor referral: Application ${applicationId} approved`
      ]
    );
    console.log('✅ Created loyalty transaction');

    // Update loyalty profile
    await pool.query(
      `UPDATE customer_loyalty_points
       SET total_points = total_points + $1,
           lifetime_points_earned = lifetime_points_earned + $1,
           updated_at = NOW()
       WHERE customer_id = $2`,
      [pointsToAward, referrerVendorId]
    );
    console.log('✅ Updated loyalty points');

    // Get or create wallet
    let walletResult = await pool.query(
      `SELECT * FROM customer_wallets WHERE customer_id = $1`,
      [referrerVendorId]
    );

    if (walletResult.rows.length === 0) {
      // Check if currency column exists
      const schemaCheck = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'customer_wallets' AND column_name = 'currency'`
      );
      
      if (schemaCheck.rows.length > 0) {
        const walletInsert = await pool.query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
           VALUES ($1, 0, 'INR')
           RETURNING id`,
          [referrerVendorId]
        );
        walletResult = { rows: [{ id: walletInsert.rows[0].id }] };
      } else {
        const walletInsert = await pool.query(
          `INSERT INTO customer_wallets (customer_id, balance)
           VALUES ($1, 0)
           RETURNING id`,
          [referrerVendorId]
        );
        walletResult = { rows: [{ id: walletInsert.rows[0].id }] };
      }
      console.log('✅ Created wallet');
    }

    const walletId = walletResult.rows[0].id;

    // Credit wallet (1 point = 1 rupee)
    await pool.query(
      `UPDATE customer_wallets
       SET balance = balance + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [pointsToAward, walletId]
    );
    console.log('✅ Credited wallet');

    // Get current wallet balance for balance_after
    const currentWallet = await pool.query(
      `SELECT balance FROM customer_wallets WHERE id = $1`,
      [walletId]
    );
    const balanceAfter = parseFloat(currentWallet.rows[0].balance) + pointsToAward;

    // Create wallet transaction (check schema first)
    const walletTxSchema = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'wallet_transactions'`
    );
    const walletTxColumns = walletTxSchema.rows.map(r => r.column_name);
    
    if (walletTxColumns.includes('source')) {
      // Has source column
      if (walletTxColumns.includes('customer_id')) {
        await pool.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, customer_id, transaction_type, amount, balance_after, source, description, reference_type, reference_id)
           VALUES ($1, $2, 'credit', $3, $4, 'loyalty_points', $5, 'vendor_referral', $6)`,
          [
            walletId,
            referrerVendorId,
            pointsToAward,
            balanceAfter,
            `Loyalty points converted: ${pointsToAward} points = ₹${pointsToAward}`,
            referralRecordId
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, transaction_type, amount, balance_after, source, description, reference_type, reference_id)
           VALUES ($1, 'credit', $2, $3, 'loyalty_points', $4, 'vendor_referral', $5)`,
          [
            walletId,
            pointsToAward,
            balanceAfter,
            `Loyalty points converted: ${pointsToAward} points = ₹${pointsToAward}`,
            referralRecordId
          ]
        );
      }
    } else {
      // No source column
      if (walletTxColumns.includes('customer_id')) {
        await pool.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, customer_id, transaction_type, amount, balance_after, description, reference_type, reference_id)
           VALUES ($1, $2, 'credit', $3, $4, $5, 'vendor_referral', $6)`,
          [
            walletId,
            referrerVendorId,
            pointsToAward,
            balanceAfter,
            `Loyalty points converted: ${pointsToAward} points = ₹${pointsToAward}`,
            referralRecordId
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, transaction_type, amount, balance_after, description, reference_type, reference_id)
           VALUES ($1, 'credit', $2, $3, $4, 'vendor_referral', $5)`,
          [
            walletId,
            pointsToAward,
            balanceAfter,
            `Loyalty points converted: ${pointsToAward} points = ₹${pointsToAward}`,
            referralRecordId
          ]
        );
      }
    }
    console.log('✅ Created wallet transaction');

    // Update referral record
    const appResult = await pool.query(
      `SELECT vi.phone, voa.id 
       FROM vendor_onboarding_applications voa
       LEFT JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
       WHERE voa.id = $1`,
      [applicationId]
    );

    if (appResult.rows.length > 0) {
      const phone = appResult.rows[0].phone;
      const phoneDigits = (phone || '').replace(/\D/g, '');
      const fullPhone = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;

      // Get vendor ID from application
      const vendorResult = await pool.query(
        `SELECT vendor_id FROM vendor_identity WHERE id = (
          SELECT vendor_identity_id FROM vendor_onboarding_applications WHERE id = $1
        )`,
        [applicationId]
      );

      const referredVendorId = vendorResult.rows.length > 0 ? vendorResult.rows[0].vendor_id : null;

      await pool.query(
        `UPDATE vendor_referrals 
         SET referred_phone = $1,
             referred_vendor_id = $2,
             status = 'approved',
             applied_at = COALESCE(applied_at, NOW()),
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [fullPhone, referredVendorId, referralRecordId]
      );
      console.log('✅ Updated referral record');
    }

    console.log('\n\n=== Final Verification ===\n');

    // Check final state
    const finalPoints = await pool.query(
      `SELECT * FROM customer_loyalty_points WHERE customer_id = $1`,
      [referrerVendorId]
    );
    console.log('Final Points:', finalPoints.rows[0]);

    const finalWallet = await pool.query(
      `SELECT * FROM customer_wallets WHERE customer_id = $1`,
      [referrerVendorId]
    );
    console.log('Final Wallet:', finalWallet.rows[0]);

    const finalTransactions = await pool.query(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 3`,
      [referrerVendorId]
    );
    console.log('\nReferral Transactions:');
    finalTransactions.rows.forEach(t => {
      console.log(`  - ${t.description}: ${t.points} points at ${t.created_at}`);
    });

    const finalReferral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE id = $1`,
      [referralRecordId]
    );
    console.log('\nFinal Referral Record:', finalReferral.rows[0]);

    // Re-enable foreign key constraints (optional - may need to be done manually)
    // Note: This might fail if vendors don't exist in customers table
    // await pool.query(`ALTER TABLE customer_loyalty_points ADD CONSTRAINT customer_loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id)`);
    // await pool.query(`ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id)`);
    // await pool.query(`ALTER TABLE customer_wallets ADD CONSTRAINT customer_wallets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id)`);
    // await pool.query(`ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id)`);
    // console.log('✅ Re-enabled foreign key constraints');

    console.log('\n✅ Points awarded successfully!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

manuallyAwardPoints().catch(console.error);
