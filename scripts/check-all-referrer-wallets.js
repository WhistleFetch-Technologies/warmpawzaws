const { Pool } = require('pg');

async function checkAllReferrerWallets() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CHECKING ALL POTENTIAL REFERRER WALLETS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check wallets of vendors who have referral codes
    const referrers = [
      { id: '1ba3dc9e-cd03-4231-8e32-37250f7be283', name: 'Taruna Infosoft', code: 'VREFE283EKHY' },
      { id: '8dc26f50-0ebe-4b33-91d4-f6d58402ca45', name: "Shreesha's Vet Solo", code: 'VREFCA45O7N4' },
      { id: 'bcff4da9-99b1-401f-ab62-5d70526331ec', name: 'Taruna Infosoft (old)', code: 'VREFE283EKHY' },
    ];

    for (const referrer of referrers) {
      console.log(`Checking: ${referrer.name} (${referrer.code})`);
      console.log(`  Vendor ID: ${referrer.id}\n`);

      const wallet = await pool.query(
        `SELECT vw.balance, vlp.total_points, vlp.lifetime_points_earned
         FROM vendor_wallets vw
         LEFT JOIN vendor_loyalty_points vlp ON vw.vendor_id = vlp.vendor_id
         WHERE vw.vendor_id = $1`,
        [referrer.id]
      );

      if (wallet.rows.length > 0) {
        console.log(`  Wallet Balance: ₹${wallet.rows[0].balance || 0}`);
        console.log(`  Points: ${wallet.rows[0].total_points || 0}`);
        console.log(`  Lifetime Earned: ${wallet.rows[0].lifetime_points_earned || 0}\n`);

        // Check recent transactions
        const transactions = await pool.query(
          `SELECT * FROM vendor_wallet_transactions vwt
           JOIN vendor_wallets vw ON vwt.wallet_id = vw.id
           WHERE vw.vendor_id = $1
           ORDER BY vwt.created_at DESC
           LIMIT 3`,
          [referrer.id]
        );

        if (transactions.rows.length > 0) {
          console.log(`  Recent Transactions:`);
          transactions.rows.forEach(tx => {
            console.log(`    - ${tx.description}: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
          });
          console.log('');
        }
      } else {
        console.log(`  No wallet found\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  WHICH VENDOR SHOULD HAVE RECEIVED POINTS?');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Please tell me which referral code you used when creating the new vendor.');
    console.log('The wallet balance above shows who has received points.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllReferrerWallets();
