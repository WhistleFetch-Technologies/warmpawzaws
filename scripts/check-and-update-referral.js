const { Pool } = require('pg');

async function checkAndUpdateReferral() {
  const referralCode = 'VREFE283EKHY';
  const applicationId = '7a00b0e3-41c1-49a3-9304-73fed099a3f2';
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283'; // Owner of VREFE283EKHY
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('=== STEP 1: Check Current State ===\n');

    // Get application and vendor details
    const appResult = await pool.query(
      `SELECT voa.*, vi.id as vendor_identity_id, vi.phone, vi.metadata, vi.vendor_id
       FROM vendor_onboarding_applications voa
       LEFT JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
       WHERE voa.id = $1`,
      [applicationId]
    );

    if (appResult.rows.length === 0) {
      console.log('❌ Application not found');
      return;
    }

    const app = appResult.rows[0];
    console.log('Application:', {
      id: app.id,
      phone: app.phone,
      status: app.status,
      vendor_identity_id: app.vendor_identity_id,
      vendor_id: app.vendor_id
    });

    // Get vendor ID (from vendors table)
    let vendorId = app.vendor_id;
    if (!vendorId) {
      // Check if vendor exists by phone
      const vendorResult = await pool.query(
        `SELECT id FROM vendors WHERE phone = $1 LIMIT 1`,
        [app.phone]
      );
      if (vendorResult.rows.length > 0) {
        vendorId = vendorResult.rows[0].id;
      }
    }

    console.log('Vendor ID:', vendorId);

    // Check referral record
    const referralResult = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referral_code = $1`,
      [referralCode]
    );

    console.log('\nReferral Record:', referralResult.rows[0]);

    // Check current points for referrer
    const pointsResult = await pool.query(
      `SELECT * FROM customer_loyalty_points WHERE customer_id = $1`,
      [referrerVendorId]
    );
    console.log('\nCurrent Points:', pointsResult.rows[0] || { total_points: 0 });

    const walletResult = await pool.query(
      `SELECT * FROM customer_wallets WHERE customer_id = $1`,
      [referrerVendorId]
    );
    console.log('Current Wallet:', walletResult.rows[0] || { balance: 0 });

    // Check if referral was already processed
    const referralTransactions = await pool.query(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 5`,
      [referrerVendorId]
    );
    console.log('\nReferral Transactions:', referralTransactions.rows);

    console.log('\n\n=== STEP 2: Update Referral Record ===\n');

    if (vendorId && referralResult.rows.length > 0) {
      const referral = referralResult.rows[0];
      
      // Normalize phone
      const phoneDigits = (app.phone || '').replace(/\D/g, '');
      const fullPhone = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;

      // Update referral record to mark as applied and approved
      await pool.query(
        `UPDATE vendor_referrals 
         SET referred_phone = $1,
             referred_vendor_id = $2,
             status = 'approved',
             applied_at = COALESCE(applied_at, NOW()),
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [fullPhone, vendorId, referral.id]
      );

      console.log('✅ Updated referral record to approved status');

      // Now manually trigger points award
      console.log('\n\n=== STEP 3: Award Points ===\n');
      
      // Import and use loyalty service
      const { LoyaltyPointsService } = require('../backend/lambda/src/lib/services/loyalty-points-service');
      const loyaltyPointsService = new LoyaltyPointsService();

      // Get vendor name
      const vendorResult = await pool.query(
        `SELECT business_name, owner_name FROM vendors WHERE id = $1`,
        [vendorId]
      );
      const vendorName = vendorResult.rows.length > 0 
        ? (vendorResult.rows[0].business_name || vendorResult.rows[0].owner_name || 'Vendor')
        : 'Vendor';

      try {
        const pointsResult = await loyaltyPointsService.awardPoints({
          vendorId: referrerVendorId,
          actionName: 'vendor_referral',
          referenceType: 'vendor_referral',
          referenceId: referral.id,
          description: `Vendor referral: ${vendorName} approved`,
        });

        console.log(`✅ Awarded ${pointsResult.points} points (₹${pointsResult.walletCredited}) to referring vendor ${referrerVendorId}`);
      } catch (pointsError) {
        console.error('❌ Error awarding points:', pointsError);
      }
    } else {
      console.log('❌ Cannot update: vendorId or referral record missing');
    }

    console.log('\n\n=== STEP 4: Verify Points After Award ===\n');

    // Check points again
    const finalPointsResult = await pool.query(
      `SELECT * FROM customer_loyalty_points WHERE customer_id = $1`,
      [referrerVendorId]
    );
    console.log('Final Points:', finalPointsResult.rows[0] || { total_points: 0 });

    const finalWalletResult = await pool.query(
      `SELECT * FROM customer_wallets WHERE customer_id = $1`,
      [referrerVendorId]
    );
    console.log('Final Wallet:', finalWalletResult.rows[0] || { balance: 0 });

    const finalTransactions = await pool.query(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 5`,
      [referrerVendorId]
    );
    console.log('\nFinal Referral Transactions:', finalTransactions.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndUpdateReferral();
