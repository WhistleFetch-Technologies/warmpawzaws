const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655';

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function checkAndApproveApplication() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const applicationId = 'ac822fb7-465c-42e2-a3e4-944e1cd1c3e6';

    console.log('Checking application status...\n');
    const app = await pool.query(
      `SELECT * FROM vendor_onboarding_applications WHERE id = $1`,
      [applicationId]
    );

    if (app.rows.length === 0) {
      console.log('❌ Application not found!\n');
      return;
    }

    console.log(`Application ID: ${app.rows[0].id}`);
    console.log(`Status: ${app.rows[0].status}`);
    console.log(`Vendor Identity ID: ${app.rows[0].vendor_identity_id}\n`);

    // Check Shreesha's wallet
    console.log('Checking Shreesha\'s wallet...\n');
    const initialWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const initialBalance = initialWallet.response.wallet?.balance || 0;
    console.log(`Initial Balance: ₹${initialBalance}\n`);

    // Try to approve directly via database (simulating admin approval)
    console.log('Approving application directly...\n');
    await pool.query(
      `UPDATE vendor_onboarding_applications 
       SET status = 'APPROVED',
           reviewed_at = NOW(),
           reviewed_by = NULL
       WHERE id = $1`,
      [applicationId]
    );

    // Get vendor_identity
    const identity = await pool.query(
      `SELECT * FROM vendor_identity WHERE id = $1`,
      [app.rows[0].vendor_identity_id]
    );

    if (identity.rows.length > 0) {
      // Create vendor record
      const vendorId = identity.rows[0].vendor_id || identity.rows[0].id;
      console.log(`Creating vendor record: ${vendorId}\n`);
      
      await pool.query(
        `INSERT INTO vendors (id, phone, email, business_name, owner_name, role_id, vendor_type, status, is_active, address, city, state, pincode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          vendorId,
          identity.rows[0].phone,
          'test@test.com',
          'Test Vendor',
          'Test User',
          '072548c8-84a9-4165-a9ec-0387c8c76a0e',
          'solo',
          'approved',
          true,
          'Test Address',
          'Test City',
          'Test State',
          '123456'
        ]
      );

      // Update vendor_identity
      await pool.query(
        `UPDATE vendor_identity 
         SET vendor_id = $1, onboarding_status = 'ACTIVATED'
         WHERE id = $2`,
        [vendorId, identity.rows[0].id]
      );

      // Process referral
      console.log('Processing referral...\n');
      let metadata = identity.rows[0].metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }

      if (metadata.referral_code_id) {
        // Update referral record
        await pool.query(
          `UPDATE vendor_referrals 
           SET referred_vendor_id = $1,
               status = 'approved',
               approved_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [vendorId, metadata.referral_code_id]
        );

        // Award points using LoyaltyPointsService logic
        const referral = await pool.query(
          `SELECT * FROM vendor_referrals WHERE id = $1`,
          [metadata.referral_code_id]
        );

        if (referral.rows.length > 0) {
          const referrerVendorId = referral.rows[0].referrer_vendor_id;

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

          if (actionRule.rows.length > 0) {
            const pointsToAward = parseFloat(actionRule.rows[0].points_value);
            const walletAmount = pointsToAward / conversionRate;

            console.log(`Awarding ${pointsToAward} points (₹${walletAmount.toFixed(2)}) to referrer ${referrerVendorId}\n`);

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
                [referrerVendorId, pointsToAward, metadata.referral_code_id, `Vendor referral: ${vendorId} approved`]
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
                  metadata.referral_code_id,
                  `Loyalty points converted: ${pointsToAward} points = ₹${walletAmount.toFixed(2)} (rate: ${conversionRate} points/rupee)`
                ]
              );

              await pool.query('COMMIT');
              console.log('✅ Points awarded successfully!\n');
            } catch (error) {
              await pool.query('ROLLBACK');
              throw error;
            }
          }
        }
      }
    }

    // Wait and check wallet
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Checking Shreesha\'s wallet after approval...\n');
    const finalWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    const finalBalance = finalWallet.response.wallet?.balance || 0;
    
    console.log(`Initial Balance: ₹${initialBalance}`);
    console.log(`Final Balance: ₹${finalBalance}`);
    console.log(`Increase: ₹${(finalBalance - initialBalance).toFixed(2)}\n`);

    if (finalBalance > initialBalance) {
      console.log('✅ SUCCESS: Points were awarded!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndApproveApplication();
