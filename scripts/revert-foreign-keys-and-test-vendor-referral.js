const { Pool } = require('pg');

async function revertAndTest() {
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
    console.log('=== STEP 1: Re-adding Foreign Key Constraints ===\n');

    // Re-add foreign key constraints (if they were dropped)
    try {
      await pool.query(`
        ALTER TABLE customer_loyalty_points 
        ADD CONSTRAINT customer_loyalty_points_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
      `);
      console.log('✅ Re-added foreign key on customer_loyalty_points');
    } catch (e) {
      if (e.code === '42P07' || e.message?.includes('already exists')) {
        console.log('ℹ️  Foreign key on customer_loyalty_points already exists');
      } else {
        console.log('⚠️  Could not re-add foreign key on customer_loyalty_points:', e.message);
      }
    }

    try {
      await pool.query(`
        ALTER TABLE loyalty_transactions 
        ADD CONSTRAINT loyalty_transactions_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
      `);
      console.log('✅ Re-added foreign key on loyalty_transactions');
    } catch (e) {
      if (e.code === '42P07' || e.message?.includes('already exists')) {
        console.log('ℹ️  Foreign key on loyalty_transactions already exists');
      } else {
        console.log('⚠️  Could not re-add foreign key on loyalty_transactions:', e.message);
      }
    }

    try {
      await pool.query(`
        ALTER TABLE customer_wallets 
        ADD CONSTRAINT customer_wallets_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE
      `);
      console.log('✅ Re-added foreign key on customer_wallets');
    } catch (e) {
      if (e.code === '42P07' || e.message?.includes('already exists')) {
        console.log('ℹ️  Foreign key on customer_wallets already exists');
      } else {
        console.log('⚠️  Could not re-add foreign key on customer_wallets:', e.message);
      }
    }

    console.log('\n\n=== STEP 2: Testing Vendor Referral Points (Using Vendor Tables) ===\n');

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
      return;
    }

    const rule = ruleResult.rows[0];
    const pointsToAward = Math.floor(parseFloat(rule.points_value || 500));

    console.log(`Awarding ${pointsToAward} points to vendor ${referrerVendorId}\n`);

    // Get or create vendor loyalty profile
    let profileResult = await pool.query(
      `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (profileResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO vendor_loyalty_points (vendor_id, total_points, lifetime_points_earned, lifetime_points_redeemed)
         VALUES ($1, 0, 0, 0)`,
        [referrerVendorId]
      );
      console.log('✅ Created vendor loyalty profile');
    }

    // Create vendor loyalty transaction
    await pool.query(
      `INSERT INTO vendor_loyalty_transactions 
       (vendor_id, transaction_type, points, reference_type, reference_id, description)
       VALUES ($1, 'earned', $2, 'vendor_referral', $3, $4)`,
      [
        referrerVendorId,
        pointsToAward,
        referralRecordId,
        `Vendor referral: Application ${applicationId} approved`
      ]
    );
    console.log('✅ Created vendor loyalty transaction');

    // Update vendor loyalty profile
    await pool.query(
      `UPDATE vendor_loyalty_points
       SET total_points = total_points + $1,
           lifetime_points_earned = lifetime_points_earned + $1,
           updated_at = NOW()
       WHERE vendor_id = $2`,
      [pointsToAward, referrerVendorId]
    );
    console.log('✅ Updated vendor loyalty points');

    // Get or create vendor wallet
    let walletResult = await pool.query(
      `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (walletResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO vendor_wallets (vendor_id, balance)
         VALUES ($1, 0)`,
        [referrerVendorId]
      );
      walletResult = await pool.query(
        `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
        [referrerVendorId]
      );
      console.log('✅ Created vendor wallet');
    }

    const walletId = walletResult.rows[0].id;
    const currentBalance = parseFloat(walletResult.rows[0].balance || 0);
    const newBalance = currentBalance + pointsToAward;

    // Credit vendor wallet
    await pool.query(
      `UPDATE vendor_wallets
       SET balance = balance + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [pointsToAward, walletId]
    );
    console.log('✅ Credited vendor wallet');

    // Create vendor wallet transaction
    await pool.query(
      `INSERT INTO vendor_wallet_transactions 
       (wallet_id, vendor_id, transaction_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, $2, 'credit', $3, $4, 'vendor_referral', $5, $6)`,
      [
        walletId,
        referrerVendorId,
        pointsToAward,
        newBalance,
        referralRecordId,
        `Loyalty points converted: ${pointsToAward} points = ₹${pointsToAward}`
      ]
    );
    console.log('✅ Created vendor wallet transaction');

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

    console.log('\n\n=== STEP 3: Verification ===\n');

    // Check vendor loyalty points
    const finalPoints = await pool.query(
      `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    console.log('Vendor Loyalty Points:', finalPoints.rows[0] || { total_points: 0 });

    // Check vendor wallet
    const finalWallet = await pool.query(
      `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    console.log('Vendor Wallet:', finalWallet.rows[0] || { balance: 0 });

    // Check vendor loyalty transactions
    const finalTransactions = await pool.query(
      `SELECT * FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 3`,
      [referrerVendorId]
    );
    console.log('\nVendor Loyalty Transactions:');
    finalTransactions.rows.forEach(t => {
      console.log(`  - ${t.description}: ${t.points} points at ${t.created_at}`);
    });

    // Check vendor wallet transactions
    if (finalWallet.rows.length > 0) {
      const walletTx = await pool.query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         ORDER BY created_at DESC
         LIMIT 3`,
        [finalWallet.rows[0].id]
      );
      console.log('\nVendor Wallet Transactions:');
      walletTx.rows.forEach(t => {
        console.log(`  - ${t.description || t.transaction_type}: ₹${t.amount} | Balance After: ₹${t.balance_after}`);
      });
    }

    console.log('\n✅ Test completed successfully using vendor-specific tables!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

revertAndTest().catch(console.error);
