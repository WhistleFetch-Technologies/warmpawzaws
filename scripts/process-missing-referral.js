const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';

const NEW_VENDOR_ID = 'b2cf522e-4456-4441-bdf8-3875baa702be';
const NEW_VENDOR_PHONE = '6583548643';
const VENDOR_ID = 'fbe87199-a12e-4221-b60b-ef669bcd4a92'; // Actual vendor_id
const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, response: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, response: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function processMissingReferral() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  PROCESSING MISSING REFERRAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check Shreesha's wallet
    console.log('1️⃣  Checking Shreesha\'s wallet...\n');
    const initialWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const initialBalance = initialWallet.response.wallet?.balance || 0;
    console.log(`   Initial Balance: ₹${initialBalance}\n`);

    // Step 2: Get referral record
    console.log('2️⃣  Getting referral record...\n');
    const referral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referral_code = $1 ORDER BY created_at ASC LIMIT 1`,
      [REFERRAL_CODE]
    );

    if (referral.rows.length === 0) {
      console.log('❌ Referral code not found!\n');
      return;
    }

    const referralId = referral.rows[0].id;
    console.log(`   Referral ID: ${referralId}`);
    console.log(`   Referrer Vendor ID: ${referral.rows[0].referrer_vendor_id}\n`);

    // Step 3: Create or update referral record for this vendor
    console.log('3️⃣  Creating/updating referral record...\n');
    const normalizedPhone = NEW_VENDOR_PHONE.replace(/\D/g, '');
    const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;

    // Check if referral record exists
    const existingReferral = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE (referred_phone = $1 OR referred_vendor_id = $2)
       AND referral_code = $3`,
      [fullPhone, VENDOR_ID, REFERRAL_CODE]
    );

    let referralRecord;
    if (existingReferral.rows.length > 0) {
      referralRecord = existingReferral.rows[0];
      console.log(`   Found existing referral record: ${referralRecord.id}\n`);
    } else {
      // Create new referral record
      const newReferral = await pool.query(
        `INSERT INTO vendor_referrals 
         (referrer_vendor_id, referral_code, referred_phone, referred_vendor_id, status, applied_at, approved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'approved', NOW(), NOW(), NOW(), NOW())
         RETURNING *`,
        [SHREESHA_VENDOR_ID, REFERRAL_CODE, fullPhone, VENDOR_ID]
      );
      referralRecord = newReferral.rows[0];
      console.log(`   ✅ Created referral record: ${referralRecord.id}\n`);
    }

    // Step 4: Check if points were already awarded
    const txCheck = await pool.query(
      `SELECT * FROM vendor_wallet_transactions vwt
       JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
       WHERE vw.vendor_id = $1
       AND vwt.reference_id = $2
       AND vwt.reference_type = 'vendor_referral'`,
      [SHREESHA_VENDOR_ID, referralRecord.id]
    );

    if (txCheck.rows.length > 0) {
      console.log('⚠️  Points were already awarded for this referral!\n');
      return;
    }

    // Step 5: Award points
    console.log('4️⃣  Awarding points...\n');

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
        [SHREESHA_VENDOR_ID]
      );

      if (loyaltyPoints.rows.length === 0) {
        await pool.query(
          `INSERT INTO vendor_loyalty_points (vendor_id, total_points, lifetime_points_earned, lifetime_points_redeemed)
           VALUES ($1, 0, 0, 0)`,
          [SHREESHA_VENDOR_ID]
        );
        loyaltyPoints = await pool.query(
          `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
          [SHREESHA_VENDOR_ID]
        );
      }

      // Create loyalty transaction
      await pool.query(
        `INSERT INTO vendor_loyalty_transactions 
         (vendor_id, transaction_type, points, reference_type, reference_id, description)
         VALUES ($1, 'earned', $2, 'vendor_referral', $3, $4)`,
        [SHREESHA_VENDOR_ID, pointsToAward, referralRecord.id, `Vendor referral: ${VENDOR_ID} approved`]
      );

      // Update loyalty points
      await pool.query(
        `UPDATE vendor_loyalty_points
         SET total_points = total_points + $1,
             lifetime_points_earned = lifetime_points_earned + $1,
             updated_at = NOW()
         WHERE vendor_id = $2`,
        [pointsToAward, SHREESHA_VENDOR_ID]
      );

      // Get or create wallet
      let wallet = await pool.query(
        `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
        [SHREESHA_VENDOR_ID]
      );

      if (wallet.rows.length === 0) {
        await pool.query(
          `INSERT INTO vendor_wallets (vendor_id, balance) VALUES ($1, 0)`,
          [SHREESHA_VENDOR_ID]
        );
        wallet = await pool.query(
          `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
          [SHREESHA_VENDOR_ID]
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
          SHREESHA_VENDOR_ID,
          walletAmount,
          newBalance,
          referralRecord.id,
          `Loyalty points converted: ${pointsToAward} points = ₹${walletAmount.toFixed(2)} (rate: ${conversionRate} points/rupee)`
        ]
      );

      await pool.query('COMMIT');

      console.log(`   ✅ Awarded ${pointsToAward} points (₹${walletAmount.toFixed(2)}) to referrer vendor ${SHREESHA_VENDOR_ID}\n`);

      // Verify
      await new Promise(resolve => setTimeout(resolve, 2000));
      const finalWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
      const finalBalance = finalWallet.response.wallet?.balance || 0;
      
      console.log(`   Initial Balance: ₹${initialBalance}`);
      console.log(`   Final Balance: ₹${finalBalance}`);
      console.log(`   Increase: ₹${(finalBalance - initialBalance).toFixed(2)}\n`);

      if (finalBalance > initialBalance) {
        console.log('✅ SUCCESS: Points were awarded!\n');
      }

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

processMissingReferral();
