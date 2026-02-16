const { Pool } = require('pg');

async function fixNewVendorReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const referralCode = 'VREFCA45O7N4';
    const newVendorIdentityId = '8cbcf701-864b-49c1-9286-9408e2d2f5a2';
    const newVendorPhone = '5675467775';
    const applicationId = 'd94679d2-ea35-4289-9e58-6f59738f09e1';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FIXING NEW VENDOR REFERRAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Get vendor_id from vendor_identity
    const identity = await pool.query(
      `SELECT id, phone, vendor_id FROM vendor_identity WHERE id = $1`,
      [newVendorIdentityId]
    );

    if (identity.rows.length === 0) {
      console.log('❌ Vendor identity not found!\n');
      return;
    }

    const vendorId = identity.rows[0].vendor_id;
    console.log(`Vendor Identity ID: ${identity.rows[0].id}`);
    console.log(`Vendor ID: ${vendorId || 'NULL'}\n`);

    if (!vendorId) {
      console.log('❌ Vendor ID not found! Application may not have been approved yet.\n');
      return;
    }

    // Step 2: Get referral code owner
    const referral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referral_code = $1 ORDER BY created_at ASC LIMIT 1`,
      [referralCode]
    );

    if (referral.rows.length === 0) {
      console.log('❌ Referral code not found!\n');
      return;
    }

    const referrerVendorId = referral.rows[0].referrer_vendor_id;
    console.log(`Referrer Vendor ID: ${referrerVendorId}\n`);

    // Step 3: Check if referral already exists for this vendor
    const normalizedPhone = newVendorPhone.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;

    const existingReferral = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE (referred_phone = $1 OR referred_vendor_id = $2)
       AND referral_code = $3`,
      [fullPhone, vendorId, referralCode]
    );

    let referralRecord;
    if (existingReferral.rows.length > 0) {
      referralRecord = existingReferral.rows[0];
      console.log(`Found existing referral record: ${referralRecord.id}\n`);
    } else {
      // Create new referral record
      console.log('Creating new referral record...\n');
      const newReferral = await pool.query(
        `INSERT INTO vendor_referrals 
         (referrer_vendor_id, referral_code, referred_phone, referred_vendor_id, status, applied_at, approved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'approved', NOW(), NOW(), NOW(), NOW())
         RETURNING *`,
        [referrerVendorId, referralCode, fullPhone, vendorId]
      );
      referralRecord = newReferral.rows[0];
      console.log(`✅ Created referral record: ${referralRecord.id}\n`);
    }

    // Step 4: Check if points were already awarded
    const walletCheck = await pool.query(
      `SELECT vw.balance, vlp.total_points
       FROM vendor_wallets vw
       LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
       WHERE vw.vendor_id = $1`,
      [referrerVendorId]
    );

    const currentBalance = walletCheck.rows.length > 0 ? parseFloat(walletCheck.rows[0].balance || 0) : 0;
    console.log(`Current referrer wallet balance: ₹${currentBalance}\n`);

    // Check if there's a transaction for this referral
    const txCheck = await pool.query(
      `SELECT * FROM vendor_wallet_transactions vwt
       JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
       WHERE vw.vendor_id = $1
       AND vwt.reference_id = $2
       AND vwt.reference_type = 'vendor_referral'`,
      [referrerVendorId, referralRecord.id]
    );

    if (txCheck.rows.length > 0) {
      console.log('⚠️  Points were already awarded for this referral!\n');
      console.log(`Transaction: ${txCheck.rows[0].description}`);
      console.log(`Amount: ₹${txCheck.rows[0].amount}\n`);
      return;
    }

    // Step 5: Award points
    console.log('5️⃣  Awarding points to referrer...\n');

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
        [referrerVendorId, pointsToAward, referralRecord.id, `Vendor referral: ${vendorId} approved`]
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

      const newBalance = parseFloat(wallet.rows[0].balance || 0) + walletAmount;

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
          referralRecord.id,
          `Loyalty points converted: ${pointsToAward} points = ₹${walletAmount.toFixed(2)} (rate: ${conversionRate} points/rupee)`
        ]
      );

      await pool.query('COMMIT');

      console.log(`   ✅ Awarded ${pointsToAward} points (₹${walletAmount.toFixed(2)}) to referrer vendor ${referrerVendorId}\n`);

      // Verify
      console.log('6️⃣  Verifying...\n');
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
    console.log(`Referrer Vendor ID: ${referrerVendorId}`);
    console.log(`New Vendor ID: ${vendorId}`);
    console.log(`Points Awarded: ${pointsToAward} (₹${walletAmount.toFixed(2)})\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixNewVendorReferral();
