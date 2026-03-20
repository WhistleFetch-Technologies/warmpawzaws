/**
 * Investigate why revenue analytics query returns empty results
 * Uses the backend's database connection setup
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Use the same connection config as the backend
const pool = new Pool({
  host: process.env.DB_HOST || process.env.RDS_HOSTNAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || process.env.RDS_DB_NAME,
  user: process.env.DB_USER || process.env.RDS_USERNAME,
  password: process.env.DB_PASSWORD || process.env.RDS_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function investigate() {
  const days = 30;
  
  console.log('='.repeat(80));
  console.log('INVESTIGATING EMPTY REVENUE RESULTS');
  console.log('='.repeat(80));
  console.log(`Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`Period: Last ${days} days\n`);

  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to database\n');

    // Step 1: Check if payments table exists
    console.log('Step 1: Checking if payments table exists...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
      ) as exists;
    `);
    console.log(`   Result: ${tableExists.rows[0].exists ? '✅ EXISTS' : '❌ DOES NOT EXIST'}\n`);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Payments table does not exist!');
      await pool.end();
      return;
    }

    // Step 2: Total payments count
    console.log('Step 2: Total payments in table...');
    const totalCount = await pool.query('SELECT COUNT(*) as total FROM payments');
    const total = parseInt(totalCount.rows[0].total);
    console.log(`   Result: ${total} payments\n`);

    if (total === 0) {
      console.log('❌ NO PAYMENTS IN TABLE - This is why the query returns empty!');
      console.log('\n💡 Possible reasons:');
      console.log('   1. No payments have been created yet');
      console.log('   2. Payments are in a different table (e.g., bookings)');
      console.log('   3. Database was not seeded with test data');
      await pool.end();
      return;
    }

    // Step 3: Payment status distribution
    console.log('Step 3: Payment status distribution...');
    const statusDist = await pool.query(`
      SELECT payment_status, COUNT(*) as count 
      FROM payments 
      GROUP BY payment_status 
      ORDER BY count DESC;
    `);
    console.log('   Status Distribution:');
    statusDist.rows.forEach(row => {
      const status = row.payment_status || '(NULL)';
      const count = row.count;
      console.log(`     - ${status}: ${count}`);
    });
    console.log('');

    // Step 4: Check date range
    console.log(`Step 4: Payments in last ${days} days...`);
    const dateRangeCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `);
    const inRange = parseInt(dateRangeCount.rows[0].count);
    console.log(`   Result: ${inRange} payments\n`);

    if (inRange === 0) {
      console.log('⚠️  WARNING: No payments in the last 30 days!');
      
      // Check date boundaries
      const dateBoundaries = await pool.query(`
        SELECT 
          MIN(created_at) as oldest,
          MAX(created_at) as newest,
          CURRENT_DATE - INTERVAL '${days} days' as cutoff
        FROM payments
      `);
      
      if (dateBoundaries.rows[0].oldest) {
        console.log(`   Oldest payment: ${dateBoundaries.rows[0].oldest}`);
        console.log(`   Newest payment: ${dateBoundaries.rows[0].newest}`);
        console.log(`   Cutoff date: ${dateBoundaries.rows[0].cutoff}`);
        
        const oldest = new Date(dateBoundaries.rows[0].oldest);
        const cutoff = new Date(dateBoundaries.rows[0].cutoff);
        if (oldest > cutoff) {
          console.log(`\n   ⚠️  All payments are older than ${days} days!`);
        }
      }
      console.log('');
    }

    // Step 5: Check status filter
    console.log('Step 5: Payments with status "completed" or "success"...');
    const statusCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments 
      WHERE payment_status IN ('completed', 'success')
    `);
    const withStatus = parseInt(statusCount.rows[0].count);
    console.log(`   Result: ${withStatus} payments\n`);

    if (withStatus === 0) {
      console.log('⚠️  WARNING: No payments with status "completed" or "success"!');
      console.log('   This is likely the issue - check Step 3 for actual status values.\n');
    }

    // Step 6: Combined filter
    console.log(`Step 6: Payments matching BOTH conditions (date + status)...`);
    const bothConditions = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' 
        AND payment_status IN ('completed', 'success')
    `);
    const matching = parseInt(bothConditions.rows[0].count);
    console.log(`   Result: ${matching} payments\n`);

    if (matching === 0) {
      console.log('❌ THIS IS THE PROBLEM: No payments match both conditions!');
      console.log('\n💡 Solutions:');
      console.log('   1. Check if payment_status values are different (see Step 3)');
      console.log('   2. Check if payments are outside the date range (see Step 4)');
      console.log('   3. Consider querying bookings table instead (see Step 10)');
      console.log('');
    }

    // Step 7: Sample payments
    console.log('Step 7: Sample of recent payments (last 5)...');
    const samples = await pool.query(`
      SELECT 
        id, 
        amount, 
        payment_status, 
        created_at,
        platform_fee,
        commission_amount
      FROM payments 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (samples.rows.length === 0) {
      console.log('   ❌ No payments found');
    } else {
      samples.rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. ID: ${row.id?.substring(0, 12)}...`);
        console.log(`      Amount: ₹${row.amount || 0} | Status: ${row.payment_status || '(NULL)'}`);
        console.log(`      Created: ${row.created_at}`);
        console.log(`      Platform Fee: ${row.platform_fee || '(NULL)'} | Commission: ${row.commission_amount || '(NULL)'}`);
        console.log('');
      });
    }

    // Step 8: Check bookings table
    console.log('Step 8: Checking bookings table (alternative revenue source)...');
    const bookingsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings'
      ) as exists;
    `);
    
    if (bookingsExists.rows[0].exists) {
      const bookingsCount = await pool.query('SELECT COUNT(*) as total FROM bookings');
      console.log(`   ✅ Bookings table exists: ${bookingsCount.rows[0].total} bookings`);
      
      const completedBookings = await pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
        FROM bookings 
        WHERE status = 'completed'
          AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      `);
      const completed = parseInt(completedBookings.rows[0].count);
      const revenue = parseFloat(completedBookings.rows[0].revenue || 0);
      
      console.log(`   ✅ Completed bookings in last ${days} days: ${completed}`);
      console.log(`   ✅ Revenue from completed bookings: ₹${revenue.toLocaleString()}`);
      
      if (completed > 0) {
        console.log('\n💡 SUGGESTION: Revenue might be in bookings table!');
        console.log('   Consider modifying the query to use bookings.total_amount');
        console.log('   instead of payments.amount');
      }
    } else {
      console.log('   ❌ Bookings table does not exist');
    }

    // Step 9: Run the actual query
    console.log('\n' + '='.repeat(80));
    console.log('Step 9: Running the actual revenue query...');
    console.log('='.repeat(80));
    const revenueData = await pool.query(`
      SELECT DATE_TRUNC('day', created_at) as date, 
              COALESCE(SUM(amount), 0) as revenue,
              COALESCE(SUM(COALESCE(platform_fee, commission_amount)), 0) as commission,
              COUNT(*) as count
       FROM payments 
       WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' 
         AND payment_status IN ('completed', 'success')
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY date
    `);
    
    console.log(`\nQuery returned ${revenueData.rows.length} rows\n`);
    
    if (revenueData.rows.length === 0) {
      console.log('❌ RESULT: Empty array []');
      console.log('\n📋 SUMMARY OF FINDINGS:');
      console.log(`   - Total payments: ${total}`);
      console.log(`   - Payments in last ${days} days: ${inRange}`);
      console.log(`   - Payments with completed/success status: ${withStatus}`);
      console.log(`   - Payments matching both conditions: ${matching}`);
      console.log('\n🔧 RECOMMENDED FIXES:');
      
      if (total === 0) {
        console.log('   1. No payments exist - check if payments are being created');
      } else if (inRange === 0) {
        console.log('   2. All payments are older than 30 days - increase the period or check dates');
      } else if (withStatus === 0) {
        console.log('   3. Payment status values are different - update query to use correct statuses');
        if (statusDist.rows.length > 0) {
          const actualStatuses = statusDist.rows.map(r => `'${r.payment_status}'`).join(', ');
          console.log(`      Actual statuses found: ${actualStatuses}`);
        }
      } else {
        console.log('   4. Check if revenue should come from bookings table instead');
      }
    } else {
      console.log('✅ RESULTS:');
      revenueData.rows.forEach((row, idx) => {
        const revenue = parseFloat(row.revenue || 0);
        const commission = parseFloat(row.commission || 0);
        console.log(`   ${idx + 1}. Date: ${row.date.toISOString().split('T')[0]}`);
        console.log(`      Revenue: ₹${revenue.toLocaleString()} | Commission: ₹${commission.toLocaleString()} | Count: ${row.count}`);
      });
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Database connection refused. Options:');
      console.error('   1. Start local PostgreSQL');
      console.error('   2. Update .env.local with remote database credentials');
      console.error('   3. Use the API endpoint instead (if backend is running)');
    }
    console.error('\nStack:', error.stack);
  } finally {
    await pool.end();
  }
}

investigate().catch(console.error);
