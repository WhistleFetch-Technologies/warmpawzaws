const { Pool } = require('pg');

async function fixReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const referralCode = 'VREFCA45O7N4';
    const newVendorId = '1cd54010-b639-420b-ae89-0b5e5b57967a'; // Actual vendor_id from vendor_identity
    const newVendorPhone = '3242342342';
    const vendorIdentityId = 'd6e9a9d9-6466-4317-957f-edf849944211';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FIXING REFERRAL: VREFCA45O7N4');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Find referral record
    const referral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referral_code = $1`,
      [referralCode]
    );

    if (referral.rows.length === 0) {
      console.log('❌ Referral code not found!\n');
      return;
    }

    const ref = referral.rows[0];
    const referrerVendorId = ref.referrer_vendor_id;

    console.log(`Referral Code: ${ref.referral_code}`);
    console.log(`Referrer Vendor ID: ${referrerVendorId}`);
    console.log(`New Vendor ID: ${newVendorId}\n`);

    // Step 2: Update referral record
    console.log('1️⃣  Updating referral record...\n');
    const normalizedPhone = newVendorPhone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;

    await pool.query(
      `UPDATE vendor_referrals 
       SET referred_phone = $1,
           referred_vendor_id = $2,
           status = 'applied',
           applied_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [fullPhone, newVendorId, ref.id]
    );

    console.log('   ✅ Updated referral record\n');

    // Step 3: Mark as approved
    console.log('2️⃣  Marking referral as approved...\n');
    await pool.query(
      `UPDATE vendor_referrals 
       SET status = 'approved',
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [ref.id]
    );

    console.log('   ✅ Marked as approved\n');

    // Step 4: Award points
    console.log('3️⃣  Awarding points to referrer...\n');

    // Get conversion rate
    const loyaltyRules = await pool.query(
      `SELECT conversion_rate, redemption_rate FROM loyalty_rules WHERE is_active = true LIMIT 1`
    );
    let conversionRate = 1.0;
    if (loyaltyRules.rows.length > 0) {
      const rule = loyaltyRules.rows[0];
      if (rule.conversion_rate !== null && rule.conversion_rate !== undefined) {
        conversionRate = parseFloat(rule.conversion_rate);
      } else if (rule.redemption_rate !== null && rule.redemption_rate !== undefined) {
        conversionRate = parseFloat(rule.redemption_rate);
      }
    }

    // Get action rule
    const actionRule = await pool.query(
      `SELECT * FROM loyalty_action_rules 
       WHERE action_name = 'vendor_referral' AND is_active = true LIMIT 1`
    );

    if (actionRule.rows.length === 0) {
      console.log('❌ vendor_referral action rule not found!\n');
      return;
    }

    const pointsToAward = parseFloat(actionRule.rows[0].points_value);
    const walletAmount = pointsToAward / conversionRate;

    console.log(`   Points to award: ${pointsToAward}`);
    console.log(`   Conversion rate: ${conversionRate}`);
    console.log(`   Wallet amount: ₹${walletAmount.toFixed(2)}\n`);

    // Award points in transaction
    await pool.query('BEGIN');

    try {
      // Get or create loyalty points
      let loyaltyPoints = await pool.query(
        `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
        [referrerVendorId]
      );

      if (loyaltyPoints.rows.length === 0) {
        await pool.query(
          `INSERT INTO vendor_loyalty_points (vendor_id, total_points, lifetime_points_earned, lifetime_points_redeemed)
           VALUES ($1, 0, 0, 0)`,
          [referrerVendorId]
        );
        loyaltyPoints = await pool.query(
          `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
          [referrerVendorId]
        );
      }

      // Create loyalty transaction
      await pool.query(
        `INSERT INTO vendor_loyalty_transactions 
         (vendor_id, transaction_type, points, reference_type, reference_id, description)
         VALUES ($1, 'earned', $2, 'vendor_referral', $3, $4)`,
        [referrerVendorId, pointsToAward, ref.id, `Vendor referral: ${newVendorId} approved`]
      );

      // Update loyalty points
      await pool.query(
        `UPDATE vendor_loyalty_points
         SET total_points = total_points + $1,
             lifetime_points_earned = lifetime_points_earned + $1,
             updated_at = NOW()
         WHERE vendor_id = $2`,
        [pointsToAward, referrerVendorId]
      );

      // Get or create wallet
      let wallet = await pool.query(
        `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
        [referrerVendorId]
      );

      if (wallet.rows.length === 0) {
        await pool.query(
          `INSERT INTO vendor_wallets (vendor_id, balance) VALUES ($1, 0)`,
          [referrerVendorId]
        );
        wallet = await pool.query(
          `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
          [referrerVendorId]
        );
      }

      const currentBalance = parseFloat(wallet.rows[0].balance || 0);
      const newBalance = currentBalance + walletAmount;

      // Update wallet
      await pool.query(
        `UPDATE vendor_wallets
         SET balance = $1, updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.rows[0].id]
      );

      // Create wallet transaction
      await pool.query(
        `INSERT INTO vendor_wallet_transactions
         (wallet_id, vendor_id, transaction_type, amount, balance_after, reference_type, reference_id, description)
         VALUES ($1, $2, 'credit', $3, $4, 'vendor_referral', $5, $6)`,
        [
          wallet.rows[0].id,
          referrerVendorId,
          walletAmount,
          newBalance,
          ref.id,
          `Loyalty points converted: ${pointsToAward} points = ₹${walletAmount.toFixed(2)} (rate: ${conversionRate} points/rupee)`
        ]
      );

      await pool.query('COMMIT');

      console.log(`   ✅ Awarded ${pointsToAward} points (₹${walletAmount.toFixed(2)}) to referrer vendor ${referrerVendorId}\n`);

      // Verify
      console.log('4️⃣  Verifying...\n');
      const finalWallet = await pool.query(
        `SELECT vw.balance, vlp.total_points
         FROM vendor_wallets vw
         LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
         WHERE vw.vendor_id = $1`,
        [referrerVendorId]
      );

      if (finalWallet.rows.length > 0) {
        console.log(`   Referrer Wallet Balance: ₹${finalWallet.rows[0].balance}`);
        console.log(`   Referrer Points: ${finalWallet.rows[0].total_points || 0}\n`);
      }

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ REFERRAL PROCESSING COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixReferral();
