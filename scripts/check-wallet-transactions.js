const { Pool } = require('pg');

const pool = new Pool({
  host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
});

async function check() {
  const referrerCustomerId = '0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b';
  
  console.log('Checking wallet and transactions for referrer:', referrerCustomerId);
  console.log('');
  
  // Check wallet
  const wallet = await pool.query(
    `SELECT * FROM customer_wallets WHERE customer_id = $1`,
    [referrerCustomerId]
  );
  console.log('Wallet:');
  if (wallet.rows.length > 0) {
    console.log(JSON.stringify(wallet.rows[0], null, 2));
  } else {
    console.log('  No wallet found');
  }
  
  // Check wallet transactions
  const walletTxs = await pool.query(
    `SELECT * FROM wallet_transactions 
     WHERE wallet_id = $1 
     ORDER BY created_at DESC 
     LIMIT 5`,
    [wallet.rows[0]?.id]
  );
  console.log('\nRecent Wallet Transactions:');
  if (walletTxs.rows.length > 0) {
    walletTxs.rows.forEach((tx, i) => {
      console.log(`  ${i + 1}. ${tx.transaction_type}: ₹${tx.amount} (Balance after: ₹${tx.balance_after})`);
      console.log(`     Description: ${tx.description}`);
      console.log(`     Created: ${tx.created_at}`);
    });
  } else {
    console.log('  No wallet transactions found');
  }
  
  // Check loyalty transactions
  const loyaltyTxs = await pool.query(
    `SELECT * FROM loyalty_transactions 
     WHERE customer_id = $1 
     AND reference_type = 'customer_referral'
     ORDER BY created_at DESC 
     LIMIT 5`,
    [referrerCustomerId]
  );
  console.log('\nRecent Loyalty Transactions (customer_referral):');
  if (loyaltyTxs.rows.length > 0) {
    loyaltyTxs.rows.forEach((tx, i) => {
      console.log(`  ${i + 1}. Points: ${tx.points}`);
      console.log(`     Description: ${tx.description}`);
      console.log(`     Created: ${tx.created_at}`);
    });
  } else {
    console.log('  No loyalty transactions found');
  }
  
  // Check conversion rate
  const loyaltyRules = await pool.query(
    `SELECT * FROM loyalty_rules WHERE is_active = true LIMIT 1`
  );
  console.log('\nLoyalty Rules (conversion rate):');
  if (loyaltyRules.rows.length > 0) {
    console.log(`  Conversion Rate: ${loyaltyRules.rows[0].conversion_rate || 'NULL'}`);
    console.log(`  Redemption Rate: ${loyaltyRules.rows[0].redemption_rate || 'NULL'}`);
    console.log(`  Rule: ${loyaltyRules.rows[0].rule_name}`);
  } else {
    console.log('  No active loyalty rules found');
  }
  
  await pool.end();
}

check().catch(console.error);
