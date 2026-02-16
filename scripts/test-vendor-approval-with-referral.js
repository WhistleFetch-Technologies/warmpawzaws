const https = require('https');

async function approveVendor() {
  const applicationId = '7a00b0e3-41c1-49a3-9304-73fed099a3f2';
  const apiUrl = `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/vendor/application/${applicationId}/approve`;
  
  // You'll need to provide an admin auth token
  const adminToken = process.env.ADMIN_TOKEN || 'your-admin-token-here';
  
  const postData = JSON.stringify({
    reviewerName: 'Admin',
    notes: 'Approved with referral code VREFE283EKHY'
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
      'Authorization': `Bearer ${adminToken}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(apiUrl, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Status Code:', res.statusCode);
          console.log('Response:', JSON.stringify(response, null, 2));
          resolve({ statusCode: res.statusCode, response });
        } catch (e) {
          console.log('Raw Response:', data);
          resolve({ statusCode: res.statusCode, response: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Check points after approval
async function checkPoints(vendorId) {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log(`\n\nChecking points for vendor: ${vendorId}\n`);

    // Check loyalty points
    const loyaltyResult = await pool.query(
      `SELECT * FROM customer_loyalty_points WHERE customer_id = $1`,
      [vendorId]
    );
    console.log('Loyalty Points:');
    console.log(JSON.stringify(loyaltyResult.rows, null, 2));

    // Check wallet
    const walletResult = await pool.query(
      `SELECT * FROM customer_wallets WHERE customer_id = $1`,
      [vendorId]
    );
    console.log('\nWallet:');
    console.log(JSON.stringify(walletResult.rows, null, 2));

    // Check loyalty transactions
    const transactionsResult = await pool.query(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_id = $1 
       AND reference_type = 'vendor_referral'
       ORDER BY created_at DESC
       LIMIT 5`,
      [vendorId]
    );
    console.log('\nLoyalty Transactions (vendor_referral):');
    console.log(JSON.stringify(transactionsResult.rows, null, 2));

    // Check wallet transactions
    if (walletResult.rows.length > 0) {
      const walletTransactionsResult = await pool.query(
        `SELECT * FROM wallet_transactions 
         WHERE wallet_id = $1 
         AND source = 'loyalty_points'
         ORDER BY created_at DESC
         LIMIT 5`,
        [walletResult.rows[0].id]
      );
      console.log('\nWallet Transactions (from loyalty_points):');
      console.log(JSON.stringify(walletTransactionsResult.rows, null, 2));
    }

    // Check vendor_referrals
    const referralsResult = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referrer_vendor_id = $1 
       AND status = 'approved'
       ORDER BY approved_at DESC
       LIMIT 5`,
      [vendorId]
    );
    console.log('\nApproved Referrals:');
    console.log(JSON.stringify(referralsResult.rows, null, 2));

  } catch (error) {
    console.error('Error checking points:', error);
  } finally {
    await pool.end();
  }
}

// Main execution
async function main() {
  const referrerVendorId = 'bcff4da9-99b1-401f-ab62-5d70526331ec';
  
  console.log('=== BEFORE APPROVAL ===');
  await checkPoints(referrerVendorId);
  
  console.log('\n\n=== APPROVING VENDOR ===');
  // Uncomment to actually approve
  // await approveVendor();
  
  console.log('\n\n=== AFTER APPROVAL ===');
  // Wait a bit for processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  await checkPoints(referrerVendorId);
}

main().catch(console.error);
