const { Pool } = require('pg');

async function checkPointsSummary() {
  const referralCode = 'VREFE283EKHY';
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283'; // Owner of VREFE283EKHY
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  VENDOR REFERRAL POINTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Get vendor details
    const vendorResult = await pool.query(
      `SELECT id, business_name, owner_name, phone FROM vendors WHERE id = $1`,
      [referrerVendorId]
    );
    const vendor = vendorResult.rows[0] || {};
    console.log('📋 REFERRING VENDOR (Owner of VREFE283EKHY):');
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Business: ${vendor.business_name || 'N/A'}`);
    console.log(`   Owner: ${vendor.owner_name || 'N/A'}`);
    console.log(`   Phone: ${vendor.phone || 'N/A'}\n`);

    // Check vendor loyalty points (using vendor-specific tables)
    const pointsResult = await pool.query(
      `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const points = pointsResult.rows[0];
    console.log('💰 VENDOR LOYALTY POINTS:');
    if (points) {
      console.log(`   Total Points: ${points.total_points}`);
      console.log(`   Lifetime Earned: ${points.lifetime_points_earned}`);
      console.log(`   Lifetime Redeemed: ${points.lifetime_points_redeemed}`);
    } else {
      console.log('   No points record found');
    }
    console.log('');

    // Check vendor wallet
    const walletResult = await pool.query(
      `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const wallet = walletResult.rows[0];
    console.log('💳 VENDOR WALLET BALANCE:');
    if (wallet) {
      console.log(`   Balance: ₹${parseFloat(wallet.balance || 0).toFixed(2)}`);
      console.log(`   Wallet ID: ${wallet.id}`);
    } else {
      console.log('   No wallet found');
    }
    console.log('');

    // Check vendor referral transactions
    const transactionsResult = await pool.query(
      `SELECT * FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 10`,
      [referrerVendorId]
    );
    console.log('📊 VENDOR REFERRAL TRANSACTIONS (Last 10):');
    if (transactionsResult.rows.length > 0) {
      transactionsResult.rows.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.description}`);
        console.log(`      Points: ${t.points} | Date: ${new Date(t.created_at).toLocaleString()}`);
      });
    } else {
      console.log('   No referral transactions found');
    }
    console.log('');

    // Check vendor wallet transactions
    if (wallet) {
      const walletTxResult = await pool.query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         AND (reference_type = 'vendor_referral' OR description LIKE '%loyalty_points%')
         ORDER BY created_at DESC
         LIMIT 10`,
        [wallet.id]
      );
      console.log('💸 VENDOR WALLET TRANSACTIONS (Last 10):');
      if (walletTxResult.rows.length > 0) {
        walletTxResult.rows.forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.description || t.transaction_type}`);
          console.log(`      Amount: ₹${parseFloat(t.amount || 0).toFixed(2)} | Balance After: ₹${parseFloat(t.balance_after || 0).toFixed(2)}`);
          console.log(`      Date: ${new Date(t.created_at).toLocaleString()}`);
        });
      } else {
        console.log('   No wallet transactions found');
      }
      console.log('');
    }

    // Check referral records
    const referralsResult = await pool.query(
      `SELECT vr.*, v.business_name as referred_business_name
       FROM vendor_referrals vr
       LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
       WHERE vr.referrer_vendor_id = $1 
       AND vr.status = 'approved'
       ORDER BY vr.approved_at DESC
       LIMIT 10`,
      [referrerVendorId]
    );
    console.log('🎯 APPROVED REFERRALS:');
    if (referralsResult.rows.length > 0) {
      referralsResult.rows.forEach((r, i) => {
        console.log(`   ${i + 1}. Code: ${r.referral_code}`);
        console.log(`      Referred Vendor: ${r.referred_business_name || r.referred_vendor_id || 'N/A'}`);
        console.log(`      Status: ${r.status}`);
        console.log(`      Approved At: ${r.approved_at ? new Date(r.approved_at).toLocaleString() : 'N/A'}`);
      });
    } else {
      console.log('   No approved referrals found');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ Points are reflected in:');
    console.log('   1. vendor_loyalty_points table (total_points, lifetime_points_earned)');
    console.log('   2. vendor_wallets table (balance in rupees)');
    console.log('   3. vendor_loyalty_transactions table (transaction history)');
    console.log('   4. vendor_wallet_transactions table (wallet credit history)');
    console.log('   5. vendor_referrals table (status = approved, approved_at timestamp)');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPointsSummary();
