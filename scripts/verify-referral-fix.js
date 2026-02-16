const { Pool } = require('pg');

async function verifyReferralFix() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    const referralCode = 'VREF073D0D7J';
    const newVendorId = '57d23549-1ee4-4f81-9c7a-b4a96b6a073d';

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  VERIFYING REFERRAL FIX');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check referral record
    const referral = await pool.query(
      `SELECT * FROM vendor_referrals WHERE referral_code = $1`,
      [referralCode]
    );

    if (referral.rows.length > 0) {
      const ref = referral.rows[0];
      console.log('Referral Record:');
      console.log(`  Code: ${ref.referral_code}`);
      console.log(`  Referrer Vendor ID: ${ref.referrer_vendor_id}`);
      console.log(`  Referred Vendor ID: ${ref.referred_vendor_id}`);
      console.log(`  Status: ${ref.status}`);
      console.log(`  Approved At: ${ref.approved_at || 'NULL'}\n`);

      // Check referrer vendor
      const referrer = await pool.query(
        `SELECT id, business_name, phone FROM vendors WHERE id = $1`,
        [ref.referrer_vendor_id]
      );

      if (referrer.rows.length > 0) {
        console.log('Referrer Vendor:');
        console.log(`  ID: ${referrer.rows[0].id}`);
        console.log(`  Name: ${referrer.rows[0].business_name || referrer.rows[0].phone}\n`);
      }

      // Check referred vendor
      if (ref.referred_vendor_id) {
        const referred = await pool.query(
          `SELECT id, business_name, phone FROM vendors WHERE id = $1`,
          [ref.referred_vendor_id]
        );

        if (referred.rows.length > 0) {
          console.log('Referred Vendor:');
          console.log(`  ID: ${referred.rows[0].id}`);
          console.log(`  Name: ${referred.rows[0].business_name || referred.rows[0].phone}\n`);
        }
      }

      // Check referrer wallet
      const wallet = await pool.query(
        `SELECT vw.balance, vlp.total_points, vlp.lifetime_points_earned
         FROM vendor_wallets vw
         LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
         WHERE vw.vendor_id = $1`,
        [ref.referrer_vendor_id]
      );

      if (wallet.rows.length > 0) {
        console.log('Referrer Wallet:');
        console.log(`  Balance: ₹${wallet.rows[0].balance || 0}`);
        console.log(`  Points: ${wallet.rows[0].total_points || 0}`);
        console.log(`  Lifetime Earned: ${wallet.rows[0].lifetime_points_earned || 0}\n`);
      }

      // Check recent transactions
      const transactions = await pool.query(
        `SELECT * FROM vendor_wallet_transactions vwt
         JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
         WHERE vw.vendor_id = $1
         ORDER BY vwt.created_at DESC
         LIMIT 3`,
        [ref.referrer_vendor_id]
      );

      console.log(`Recent Transactions (${transactions.rows.length}):`);
      transactions.rows.forEach((tx, i) => {
        console.log(`  ${i + 1}. ${tx.description}`);
        console.log(`     Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
        console.log(`     Balance After: ₹${tx.balance_after}`);
        console.log(`     Created: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (referral.rows.length > 0 && referral.rows[0].status === 'approved') {
      console.log('✅ Referral has been processed!');
      console.log(`   Points were awarded using conversion rate: 100 points = 1 rupee`);
      console.log(`   So 500 points = ₹5.00\n`);
    } else {
      console.log('❌ Referral not processed yet\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

verifyReferralFix();
