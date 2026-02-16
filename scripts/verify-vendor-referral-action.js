const { Pool } = require('pg');

async function verifyVendorReferralAction() {
  const referralCode = 'VREFE283EKHY';
  const referrerVendorId = '1ba3dc9e-cd03-4231-8e32-37250f7be283';
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  VENDOR REFERRAL ACTION VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Check if vendor_referral rule exists and is active
    console.log('1️⃣  Checking vendor_referral action rule...');
    const ruleResult = await pool.query(
      `SELECT * FROM loyalty_action_rules 
       WHERE action_name = 'vendor_referral' 
       AND is_active = true
       ORDER BY priority DESC
       LIMIT 1`
    );

    if (ruleResult.rows.length === 0) {
      console.log('   ❌ No active vendor_referral rule found!');
      console.log('   ⚠️  Action will not work without a rule.');
      return;
    }

    const rule = ruleResult.rows[0];
    console.log('   ✅ Rule found:');
    console.log(`      - Points: ${rule.points_value}`);
    console.log(`      - Type: ${rule.points_type}`);
    console.log(`      - User Type: ${rule.user_type}`);
    console.log(`      - Active: ${rule.is_active}`);
    console.log('');

    // 2. Check vendor loyalty points (should be in vendor_loyalty_points, not customer_loyalty_points)
    console.log('2️⃣  Checking vendor loyalty points (vendor_loyalty_points table)...');
    const vendorPoints = await pool.query(
      `SELECT * FROM vendor_loyalty_points WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (vendorPoints.rows.length > 0) {
      const points = vendorPoints.rows[0];
      console.log('   ✅ Vendor loyalty points found:');
      console.log(`      - Total Points: ${points.total_points}`);
      console.log(`      - Lifetime Earned: ${points.lifetime_points_earned}`);
    } else {
      console.log('   ⚠️  No vendor loyalty points record found');
    }

    // Check customer_loyalty_points (should NOT have vendor data)
    const customerPoints = await pool.query(
      `SELECT * FROM customer_loyalty_points WHERE customer_id = $1`,
      [referrerVendorId]
    );
    if (customerPoints.rows.length > 0) {
      console.log('   ⚠️  WARNING: Vendor data found in customer_loyalty_points (should be cleaned up)');
    } else {
      console.log('   ✅ No vendor data in customer_loyalty_points (correct)');
    }
    console.log('');

    // 3. Check vendor wallet (should be in vendor_wallets, not customer_wallets)
    console.log('3️⃣  Checking vendor wallet (vendor_wallets table)...');
    const vendorWallet = await pool.query(
      `SELECT * FROM vendor_wallets WHERE vendor_id = $1`,
      [referrerVendorId]
    );

    if (vendorWallet.rows.length > 0) {
      const wallet = vendorWallet.rows[0];
      console.log('   ✅ Vendor wallet found:');
      console.log(`      - Balance: ₹${parseFloat(wallet.balance || 0).toFixed(2)}`);
    } else {
      console.log('   ⚠️  No vendor wallet found');
    }

    // Check customer_wallets (should NOT have vendor data)
    const customerWallet = await pool.query(
      `SELECT * FROM customer_wallets WHERE customer_id = $1`,
      [referrerVendorId]
    );
    if (customerWallet.rows.length > 0) {
      console.log('   ⚠️  WARNING: Vendor data found in customer_wallets (should be cleaned up)');
    } else {
      console.log('   ✅ No vendor data in customer_wallets (correct)');
    }
    console.log('');

    // 4. Check vendor loyalty transactions
    console.log('4️⃣  Checking vendor loyalty transactions...');
    const vendorTx = await pool.query(
      `SELECT * FROM vendor_loyalty_transactions 
       WHERE vendor_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 5`,
      [referrerVendorId]
    );

    if (vendorTx.rows.length > 0) {
      console.log(`   ✅ Found ${vendorTx.rows.length} vendor referral transaction(s):`);
      vendorTx.rows.forEach((t, i) => {
        console.log(`      ${i + 1}. ${t.description}`);
        console.log(`         Points: ${t.points} | Date: ${new Date(t.created_at).toLocaleString()}`);
      });
    } else {
      console.log('   ⚠️  No vendor referral transactions found');
    }
    console.log('');

    // 5. Check vendor wallet transactions
    if (vendorWallet.rows.length > 0) {
      console.log('5️⃣  Checking vendor wallet transactions...');
      const walletTx = await pool.query(
        `SELECT * FROM vendor_wallet_transactions 
         WHERE wallet_id = $1 
         ORDER BY created_at DESC
         LIMIT 5`,
        [vendorWallet.rows[0].id]
      );

      if (walletTx.rows.length > 0) {
        console.log(`   ✅ Found ${walletTx.rows.length} vendor wallet transaction(s):`);
        walletTx.rows.forEach((t, i) => {
          console.log(`      ${i + 1}. ${t.description || t.transaction_type}`);
          console.log(`         Amount: ₹${parseFloat(t.amount || 0).toFixed(2)} | Balance After: ₹${parseFloat(t.balance_after || 0).toFixed(2)}`);
        });
      } else {
        console.log('   ⚠️  No vendor wallet transactions found');
      }
      console.log('');
    }

    // 6. Check vendor_referrals table
    console.log('6️⃣  Checking vendor_referrals records...');
    const referrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referrer_vendor_id = $1 
       AND status = 'approved'
       ORDER BY approved_at DESC
       LIMIT 5`,
      [referrerVendorId]
    );

    if (referrals.rows.length > 0) {
      console.log(`   ✅ Found ${referrals.rows.length} approved referral(s):`);
      referrals.rows.forEach((r, i) => {
        console.log(`      ${i + 1}. Code: ${r.referral_code}`);
        console.log(`         Status: ${r.status}`);
        console.log(`         Approved At: ${r.approved_at ? new Date(r.approved_at).toLocaleString() : 'N/A'}`);
      });
    } else {
      console.log('   ⚠️  No approved referrals found');
    }
    console.log('');

    // 7. Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const hasRule = ruleResult.rows.length > 0;
    const hasVendorPoints = vendorPoints.rows.length > 0;
    const hasVendorWallet = vendorWallet.rows.length > 0;
    const hasVendorTx = vendorTx.rows.length > 0;
    const hasApprovedReferrals = referrals.rows.length > 0;

    console.log(`✅ Action Rule: ${hasRule ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Vendor Points: ${hasVendorPoints ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Vendor Wallet: ${hasVendorWallet ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Vendor Transactions: ${hasVendorTx ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Approved Referrals: ${hasApprovedReferrals ? 'EXISTS' : 'MISSING'}`);

    if (hasRule && hasVendorPoints && hasVendorWallet && hasVendorTx && hasApprovedReferrals) {
      console.log('\n🎉 VENDOR REFERRAL ACTION IS WORKING!');
      console.log('   All components are in place and data is stored correctly.');
    } else {
      console.log('\n⚠️  VENDOR REFERRAL ACTION MAY NOT BE FULLY WORKING');
      console.log('   Some components are missing. Check the details above.');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyVendorReferralAction();
