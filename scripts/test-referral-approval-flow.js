const { Pool } = require('pg');
const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const ADMIN_TOKEN = 'uat-token-admin-1771240312983';
const ADMIN_EMAIL = 'admin@warmpawz.com';

const REFERRAL_CODE = 'VREFCA45O7N4';
const SHREESHA_VENDOR_ID = '8dc26f50-0ebe-4b33-91d4-f6d58402ca45'; // Actual vendor_id
const SHREESHA_VENDOR_IDENTITY_ID = '250a0ba2-823e-4bd7-a943-d509e5eb4655'; // vendor_identity_id

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

async function testReferralApprovalFlow() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING REFERRAL APPROVAL FLOW');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check Shreesha's current wallet
    console.log('1️⃣  Checking Shreesha\'s current wallet...\n');
    const initialWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    
    if (initialWallet.statusCode === 200 && initialWallet.response.success) {
      const initialBalance = initialWallet.response.wallet?.balance || 0;
      const initialPoints = initialWallet.response.loyalty_points?.total_points || 0;
      console.log(`   Initial Balance: ₹${initialBalance}`);
      console.log(`   Initial Points: ${initialPoints}\n`);
    } else {
      console.log(`   ❌ Error: ${JSON.stringify(initialWallet.response, null, 2)}\n`);
      return;
    }

    // Step 2: Find a pending vendor application that used the referral code
    console.log('2️⃣  Finding pending vendor applications with referral code...\n');
    
    // First, check vendor_referrals for pending/applied referrals
    const pendingReferrals = await pool.query(
      `SELECT * FROM vendor_referrals 
       WHERE referral_code = $1 
       AND status IN ('pending', 'applied')
       ORDER BY created_at DESC
       LIMIT 5`,
      [REFERRAL_CODE]
    );

    console.log(`   Found ${pendingReferrals.rows.length} pending/applied referral(s):\n`);
    pendingReferrals.rows.forEach((ref, i) => {
      console.log(`   ${i + 1}. Referred Phone: ${ref.referred_phone || 'NULL'}`);
      console.log(`      Referred Vendor ID: ${ref.referred_vendor_id || 'NULL'}`);
      console.log(`      Status: ${ref.status}\n`);
    });

    // Find applications for these referrals
    let applicationToApprove = null;
    for (const ref of pendingReferrals.rows) {
      if (ref.referred_vendor_id) {
        const app = await pool.query(
          `SELECT * FROM vendor_onboarding_applications 
           WHERE vendor_identity_id = $1 
           AND status = 'SUBMITTED'
           ORDER BY submitted_at DESC
           LIMIT 1`,
          [ref.referred_vendor_id]
        );
        
        if (app.rows.length > 0) {
          applicationToApprove = app.rows[0];
          console.log(`   ✅ Found application to approve: ${applicationToApprove.id}\n`);
          break;
        }
      }
    }

    // If no application found, check for any SUBMITTED applications
    if (!applicationToApprove) {
      console.log('   Checking for any SUBMITTED applications...\n');
      const allApps = await pool.query(
        `SELECT voa.*, vi.phone, vi.metadata
         FROM vendor_onboarding_applications voa
         JOIN vendor_identity vi ON voa.vendor_identity_id = vi.id
         WHERE voa.status = 'SUBMITTED'
         ORDER BY voa.submitted_at DESC
         LIMIT 5`
      );

      console.log(`   Found ${allApps.rows.length} SUBMITTED application(s):\n`);
      allApps.rows.forEach((app, i) => {
        console.log(`   ${i + 1}. Application ID: ${app.id}`);
        console.log(`      Vendor Identity ID: ${app.vendor_identity_id}`);
        console.log(`      Phone: ${app.phone || 'NULL'}`);
        console.log(`      Submitted At: ${new Date(app.submitted_at).toLocaleString()}\n`);
        
        // Check if this application has referral code in metadata
        let metadata = app.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = {};
          }
        }
        
        if (metadata.referral_code_id || metadata.referral_code === REFERRAL_CODE) {
          console.log(`      ✅ This application has referral code!\n`);
          if (!applicationToApprove) {
            applicationToApprove = app;
          }
        }
      });
    }

    if (!applicationToApprove) {
      console.log('   ⚠️  No pending application found with referral code.\n');
      console.log('   You need to create a new vendor with referral code first.\n');
      return;
    }

    // Step 3: Approve the application
    console.log('3️⃣  Approving application...\n');
    console.log(`   Application ID: ${applicationToApprove.id}\n`);
    
    const approveResult = await makeRequest(
      `${API_BASE_URL}/admin/vendor/application/${applicationToApprove.id}/approve`,
      'POST'
    );

    console.log(`   Status: ${approveResult.statusCode}`);
    if (approveResult.statusCode === 200) {
      console.log(`   ✅ Application approved successfully!\n`);
      console.log(`   Response: ${JSON.stringify(approveResult.response, null, 2)}\n`);
    } else {
      console.log(`   ❌ Error: ${JSON.stringify(approveResult.response, null, 2)}\n`);
      return;
    }

    // Step 4: Wait a moment for processing
    console.log('4️⃣  Waiting for referral processing...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 5: Check Shreesha's wallet again
    console.log('5️⃣  Checking Shreesha\'s wallet after approval...\n');
    const finalWallet = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet`);
    
    if (finalWallet.statusCode === 200 && finalWallet.response.success) {
      const finalBalance = finalWallet.response.wallet?.balance || 0;
      const finalPoints = finalWallet.response.loyalty_points?.total_points || 0;
      const initialBalance = initialWallet.response.wallet?.balance || 0;
      const initialPoints = initialWallet.response.loyalty_points?.total_points || 0;
      
      console.log(`   Final Balance: ₹${finalBalance}`);
      console.log(`   Final Points: ${finalPoints}\n`);
      
      const balanceIncrease = finalBalance - initialBalance;
      const pointsIncrease = finalPoints - initialPoints;
      
      if (balanceIncrease > 0) {
        console.log(`   ✅ SUCCESS: Wallet increased by ₹${balanceIncrease.toFixed(2)}!`);
        console.log(`   ✅ Points increased by ${pointsIncrease}!\n`);
      } else {
        console.log(`   ⚠️  No increase in wallet balance. Points may not have been awarded.\n`);
      }

      // Check recent transactions
      const txResult = await makeRequest(`${API_BASE_URL}/vendor/${SHREESHA_VENDOR_IDENTITY_ID}/wallet/transactions?limit=3`);
      
      if (txResult.statusCode === 200 && txResult.response.success) {
        console.log(`   Recent Transactions (${txResult.response.transactions?.length || 0}):\n`);
        txResult.response.transactions?.forEach((tx, i) => {
          console.log(`   ${i + 1}. ${tx.description || tx.reference_type || 'Transaction'}`);
          console.log(`      Amount: ${tx.transaction_type === 'credit' ? '+' : '-'}₹${tx.amount}`);
          console.log(`      Balance After: ₹${tx.balance_after}`);
          console.log(`      Created: ${new Date(tx.created_at).toLocaleString()}\n`);
        });
      }
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testReferralApprovalFlow();
