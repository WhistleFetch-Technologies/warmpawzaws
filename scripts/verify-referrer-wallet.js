const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function verifyReferrerWallet() {
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283';
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  VERIFYING REFERRER VENDOR WALLET & POINTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Check wallet balance
    const wallet = await pool.query(
      `SELECT balance FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    const balance = wallet.rows.length > 0 ? parseFloat(wallet.rows[0].balance || 0) : 0;
    console.log(`💰 Current Wallet Balance: ₹${balance.toFixed(2)}\n`);
    
    // Check loyalty points
    const loyalty = await pool.query(
      `SELECT total_points, lifetime_points_earned FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );
    if (loyalty.rows.length > 0) {
      console.log(`💰 Loyalty Points:`);
      console.log(`   - Total Points: ${loyalty.rows[0].total_points}`);
      console.log(`   - Lifetime Earned: ${loyalty.rows[0].lifetime_points_earned}\n`);
    } else {
      console.log(`⚠️  No loyalty points record found\n`);
    }
    
    // Count referral transactions
    const refTx = await pool.query(
      `SELECT COUNT(*) as count FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 AND reference_type = 'vendor_referral'`,
      [referrerVendorId]
    );
    console.log(`📋 Total Referral Transactions: ${refTx.rows[0]?.count || 0}\n`);
    
    // Get wallet credit transactions
    const walletTx = await pool.query(
      `SELECT COUNT(*) as count, SUM(amount::numeric) as total 
       FROM vendor_wallet_transactions 
       WHERE vendor_id = $1 AND transaction_type = 'credit'`,
      [referrerVendorId]
    );
    console.log(`💳 Wallet Credit Transactions:`);
    console.log(`   - Count: ${walletTx.rows[0]?.count || 0}`);
    console.log(`   - Total Credited: ₹${parseFloat(walletTx.rows[0]?.total || 0).toFixed(2)}\n`);
    
    // Get recent referral transactions with details
    const recentRefTx = await pool.query(
      `SELECT * FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 10`,
      [referrerVendorId]
    );
    
    console.log(`📋 Recent Referral Transactions (Last 10):`);
    if (recentRefTx.rows.length > 0) {
      recentRefTx.rows.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ${tx.points} points - ${tx.description}`);
        console.log(`      Created: ${tx.created_at}`);
        console.log(`      Reference ID: ${tx.reference_id}\n`);
      });
    } else {
      console.log(`   ⚠️  No referral transactions found\n`);
    }
    
    // Get recent wallet credits
    const recentWalletTx = await pool.query(
      `SELECT * FROM vendor_wallet_transactions 
       WHERE vendor_id = $1 AND transaction_type = 'credit'
       ORDER BY created_at DESC
       LIMIT 10`,
      [referrerVendorId]
    );
    
    console.log(`💳 Recent Wallet Credits (Last 10):`);
    if (recentWalletTx.rows.length > 0) {
      recentWalletTx.rows.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ₹${parseFloat(tx.amount || 0).toFixed(2)} - ${tx.description || 'N/A'}`);
        console.log(`      Created: ${tx.created_at}`);
        console.log(`      Reference: ${tx.reference_type || 'N/A'} - ${tx.reference_id || 'N/A'}\n`);
      });
    } else {
      console.log(`   ⚠️  No wallet credit transactions found\n`);
    }
    
    // Verify referral records
    const referralRecords = await pool.query(
      `SELECT COUNT(*) as count, 
              COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
       FROM vendor_referrals 
       WHERE referrer_vendor_id = $1`,
      [referrerVendorId]
    );
    
    console.log(`🔍 Referral Records:`);
    console.log(`   - Total: ${referralRecords.rows[0]?.count || 0}`);
    console.log(`   - Approved: ${referralRecords.rows[0]?.approved_count || 0}\n`);
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ VERIFICATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

verifyReferrerWallet();
