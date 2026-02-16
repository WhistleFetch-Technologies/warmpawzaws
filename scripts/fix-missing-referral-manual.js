const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const VENDOR_IDENTITY_ID = '400bfec0-4def-4d36-8c46-9290ed97a96f';
const VENDOR_ID = 'cff8a4c0-5973-4369-a6d2-78c66fa6179d'; // From the check
const PHONE = '5767543675';
const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';

async function fixMissingReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FIXING MISSING REFERRAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Get referrer vendor ID from referral code
    console.log('1️⃣  Looking up referrer vendor ID...\n');
    const codeLookup = await pool.query(
      `SELECT DISTINCT referrer_vendor_id FROM vendor_referrals 
       WHERE referral_code = $1 
       LIMIT 1`,
      [REFERRAL_CODE]
    );

    if (codeLookup.rows.length === 0) {
      console.log('❌ Referral code not found in database!\n');
      return;
    }

    const referrerVendorId = codeLookup.rows[0].referrer_vendor_id;
    console.log(`   ✅ Found referrer vendor ID: ${referrerVendorId}\n`);

    // Step 2: Check if referral record exists, create or update
    console.log('2️⃣  Checking for existing referral record...\n');
    const normalizedPhone = PHONE.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;

    // Check if referral exists
    const existingReferral = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referrer_vendor_id = $1 
       AND referred_phone = $2
       LIMIT 1`,
      [referrerVendorId, fullPhone]
    );

    let referralRecord;
    if (existingReferral.rows.length > 0) {
      // Update existing record
      referralRecord = existingReferral.rows[0];
      console.log(`   ✅ Found existing referral record: ${referralRecord.id}`);
      console.log(`   Updating to approved status...\n`);
      
      await pool.query(
        `UPDATE vendor_referrals 
         SET referral_code = $1,
             referred_vendor_id = $2,
             status = 'approved',
             applied_at = COALESCE(applied_at, NOW()),
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [REFERRAL_CODE, VENDOR_ID, referralRecord.id]
      );
      
      // Refresh record
      const updated = await pool.query(
        `SELECT * FROM vendor_referrals WHERE id = $1`,
        [referralRecord.id]
      );
      referralRecord = updated.rows[0];
      console.log(`   ✅ Updated referral record\n`);
    } else {
      // Create new record
      const newReferral = await pool.query(
        `INSERT INTO vendor_referrals 
         (referrer_vendor_id, referral_code, referred_phone, referred_vendor_id, status, applied_at, approved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'approved', NOW(), NOW(), NOW(), NOW())
         RETURNING *`,
        [referrerVendorId, REFERRAL_CODE, fullPhone, VENDOR_ID]
      );

      referralRecord = newReferral.rows[0];
      console.log(`   ✅ Created referral record: ${referralRecord.id}\n`);
    }

    // Step 3: Update vendor_identity metadata
    console.log('3️⃣  Updating vendor_identity metadata...\n');
    const metadata = {
      referral_code_id: referralRecord.id,
      referrer_vendor_id: referrerVendorId,
      referral_code: REFERRAL_CODE,
    };

    await pool.query(
      `UPDATE vendor_identity 
       SET metadata = $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(metadata), VENDOR_IDENTITY_ID]
    );

    console.log(`   ✅ Updated vendor_identity metadata\n`);

    // Step 4: Award points directly (simulating LoyaltyPointsService logic)
    console.log('4️⃣  Awarding points to referrer...\n');
    
    // Get vendor name
    const vendor = await pool.query(
      `SELECT business_name, owner_name FROM vendors WHERE id = $1`,
      [VENDOR_ID]
    );
    const vendorName = vendor.rows.length > 0 
      ? (vendor.rows[0].business_name || vendor.rows[0].owner_name || 'Vendor')
      : 'Vendor';

    // Get loyalty rule for vendor_referral action
    const loyaltyRule = await pool.query(
      `SELECT * FROM loyalty_action_rules 
       WHERE action_name = 'vendor_referral' 
       AND is_active = true 
       AND (user_type = 'vendor' OR user_type = 'both')
       ORDER BY priority DESC, created_at DESC 
       LIMIT 1`
    );

    if (loyaltyRule.rows.length === 0) {
      console.log('   ⚠️  No active loyalty rule found for vendor_referral');
      console.log('   Using default: 500 points\n');
      // Use default values
      var pointsToAward = 500;
      var conversionRate = 100.0; // Default conversion rate
    } else {
      const rule = loyaltyRule.rows[0];
      pointsToAward = parseInt(rule.points_value) || 500;
      
      // Get conversion rate from loyalty_rules (basic rules table)
      const basicRule = await pool.query(
        `SELECT conversion_rate, redemption_rate FROM loyalty_rules 
         WHERE is_active = true 
         ORDER BY created_at DESC 
         LIMIT 1`
      );
      
      conversionRate = 100.0; // Default
      if (basicRule.rows.length > 0) {
        const br = basicRule.rows[0];
        if (br.conversion_rate !== null && br.conversion_rate !== undefined) {
          conversionRate = parseFloat(br.conversion_rate);
        } else if (br.redemption_rate !== null && br.redemption_rate !== undefined) {
          conversionRate = parseFloat(br.redemption_rate);
        }
      }
    }

    const walletAmount = pointsToAward / conversionRate;
    console.log(`   Points to award: ${pointsToAward}`);
    console.log(`   Conversion rate: ${conversionRate} points/rupee`);
    console.log(`   Wallet amount: ₹${walletAmount}\n`);

    // Update or create loyalty points
    await pool.query(
      `INSERT INTO vendor_loyalty_points (vendor_id, total_points, lifetime_points_earned, updated_at)
       VALUES ($1, $2, $2, NOW())
       ON CONFLICT (vendor_id) 
       DO UPDATE SET 
         total_points = vendor_loyalty_points.total_points + $2,
         lifetime_points_earned = vendor_loyalty_points.lifetime_points_earned + $2,
         updated_at = NOW()`,
      [referrerVendorId, pointsToAward]
    );

    // Create loyalty transaction
    await pool.query(
      `INSERT INTO vendor_loyalty_transactions 
       (vendor_id, transaction_type, points, reference_type, reference_id, description, created_at)
       VALUES ($1, 'earned', $2, 'vendor_referral', $3, $4, NOW())`,
      [referrerVendorId, pointsToAward, referralRecord.id, `Vendor referral: ${vendorName} approved`]
    );

    // Update or create wallet
    await pool.query(
      `INSERT INTO vendor_wallets (vendor_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (vendor_id)
       DO UPDATE SET 
         balance = vendor_wallets.balance + $2,
         updated_at = NOW()`,
      [referrerVendorId, walletAmount]
    );

    // Get updated wallet balance
    const updatedWallet = await pool.query(
      `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const newBalance = updatedWallet.rows[0]?.balance || 0;

    // Create wallet transaction
    await pool.query(
      `INSERT INTO vendor_wallet_transactions 
       (wallet_id, vendor_id, transaction_type, amount, balance_after, reference_type, reference_id, description, created_at)
       SELECT id, $5, 'credit', $1, $2, 'vendor_referral', $3, $4, NOW()
       FROM vendor_wallets WHERE vendor_id = $5`,
      [walletAmount, newBalance, referralRecord.id, `Loyalty points converted: ${pointsToAward} points = ₹${walletAmount} (rate: ${conversionRate} points/rupee)`, referrerVendorId]
    );

    console.log(`   ✅ Awarded ${pointsToAward} points (₹${walletAmount}) to referrer`);
    console.log(`   ✅ New wallet balance: ₹${newBalance}\n`);

    // Step 5: Verify wallet balance
    console.log('5️⃣  Verifying wallet balance...\n');
    const wallet = await pool.query(
      `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (wallet.rows.length > 0) {
      console.log(`   ✅ Current balance: ₹${wallet.rows[0].balance}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUCCESS: Referral processed and points awarded!');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixMissingReferral();
