const { Pool } = require('pg');

async function checkWalletBalance() {
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283'; // Taruna Infosoft
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  VENDOR WALLET BALANCE VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Get vendor details
    const vendor = await pool.query(
      `SELECT id, business_name, owner_name FROM vendors WHERE id = $1`,
      [referrerVendorId]
    );
    console.log(`Vendor: ${vendor.rows[0]?.business_name || 'N/A'} (${referrerVendorId})\n`);

    // Check vendor loyalty points
    console.log('1️⃣  LOYALTY POINTS:');
    const points = await pool.query(
      `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (points.rows.length > 0) {
      const p = points.rows[0];
      console.log(`   Total Points: ${p.total_points}`);
      console.log(`   Lifetime Earned: ${p.lifetime_points_earned}`);
      console.log(`   Lifetime Redeemed: ${p.lifetime_points_redeemed}`);
      console.log(`   Expected Wallet Balance: ₹${p.total_points}.00 (1 point = ₹1)\n`);
    } else {
      console.log('   ❌ No loyalty points record found\n');
    }

    // Check vendor wallet
    console.log('2️⃣  WALLET BALANCE:');
    const wallet = await pool.query(
      `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (wallet.rows.length > 0) {
      const w = wallet.rows[0];
      const balance = parseFloat(w.balance || 0);
      console.log(`   Current Balance: ₹${balance.toFixed(2)}`);
      console.log(`   Wallet ID: ${w.id}`);
      console.log(`   Created: ${new Date(w.created_at).toLocaleString()}`);
      console.log(`   Updated: ${new Date(w.updated_at).toLocaleString()}\n`);

      // Compare with points
      if (points.rows.length > 0) {
        const expectedBalance = points.rows[0].total_points;
        const difference = balance - expectedBalance;
        console.log(`   Comparison:`);
        console.log(`   - Points: ${points.rows[0].total_points}`);
        console.log(`   - Wallet: ₹${balance.toFixed(2)}`);
        console.log(`   - Difference: ₹${difference.toFixed(2)}`);
        
        if (Math.abs(difference) < 0.01) {
          console.log(`   ✅ Wallet balance matches points (1 point = ₹1)\n`);
        } else {
          console.log(`   ⚠️  Wallet balance does NOT match points!\n`);
        }
      }
    } else {
      console.log('   ❌ No wallet found\n');
    }

    // Check wallet transactions
    if (wallet.rows.length > 0) {
      console.log('3️⃣  WALLET TRANSACTIONS (Last 10):');
      const transactions = await pool.query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         ORDER BY created_at DESC
         LIMIT 10`,
        [wallet.rows[0].id]
      );

      if (transactions.rows.length > 0) {
        console.log(`   Found ${transactions.rows.length} transaction(s):\n`);
        transactions.rows.forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.description || t.transaction_type}`);
          console.log(`      Type: ${t.transaction_type}`);
          console.log(`      Amount: ₹${parseFloat(t.amount || 0).toFixed(2)}`);
          console.log(`      Balance After: ₹${parseFloat(t.balance_after || 0).toFixed(2)}`);
          console.log(`      Reference: ${t.reference_type || 'N/A'}`);
          console.log(`      Date: ${new Date(t.created_at).toLocaleString()}`);
          console.log('');
        });

        // Check for loyalty points conversions
        const loyaltyConversions = transactions.rows.filter(t => 
          t.description?.includes('loyalty_points') || 
          t.description?.includes('Loyalty points') ||
          t.reference_type === 'vendor_referral'
        );

        if (loyaltyConversions.length > 0) {
          console.log(`   ✅ Found ${loyaltyConversions.length} loyalty point conversion(s)\n`);
        } else {
          console.log(`   ⚠️  No loyalty point conversions found in transactions\n`);
        }
      } else {
        console.log('   ⚠️  No wallet transactions found\n');
      }
    }

    // Check loyalty transactions that should have converted to wallet
    console.log('4️⃣  LOYALTY TRANSACTIONS (Last 10):');
    const loyaltyTx = await pool.query(
      `SELECT * FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 
       ORDER BY created_at DESC
       LIMIT 10`,
      [referrerVendorId]
    );

    if (loyaltyTx.rows.length > 0) {
      console.log(`   Found ${loyaltyTx.rows.length} transaction(s):\n`);
      loyaltyTx.rows.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.description || 'N/A'}`);
        console.log(`      Points: ${t.points}`);
        console.log(`      Type: ${t.transaction_type}`);
        console.log(`      Reference: ${t.reference_type || 'N/A'}`);
        console.log(`      Date: ${new Date(t.created_at).toLocaleString()}`);
        console.log(`      Expected Wallet Credit: ₹${t.points}.00\n`);
      });
    } else {
      console.log('   ⚠️  No loyalty transactions found\n');
    }

    // Final summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const hasPoints = points.rows.length > 0;
    const hasWallet = wallet.rows.length > 0;
    const pointsValue = hasPoints ? points.rows[0].total_points : 0;
    const walletBalance = hasWallet ? parseFloat(wallet.rows[0].balance || 0) : 0;
    const balanceMatches = Math.abs(walletBalance - pointsValue) < 0.01;

    console.log(`Points Record: ${hasPoints ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`Wallet Record: ${hasWallet ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`Balance Match: ${balanceMatches ? '✅ YES' : '❌ NO'}`);
    console.log(`   Points: ${pointsValue}`);
    console.log(`   Wallet: ₹${walletBalance.toFixed(2)}`);
    console.log(`   Difference: ₹${Math.abs(walletBalance - pointsValue).toFixed(2)}\n`);

    if (hasPoints && hasWallet && balanceMatches) {
      console.log('🎉 POINTS ARE BEING REFLECTED IN WALLET!');
      console.log('   ✅ Points are automatically converted to wallet balance');
      console.log('   ✅ 1 point = ₹1 conversion is working');
    } else {
      console.log('⚠️  POINTS MAY NOT BE FULLY REFLECTED IN WALLET');
      if (!hasPoints) console.log('   - Missing loyalty points record');
      if (!hasWallet) console.log('   - Missing wallet record');
      if (!balanceMatches) console.log('   - Balance does not match points');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkWalletBalance();
