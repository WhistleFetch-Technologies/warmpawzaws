/**
 * Test script to investigate revenue analytics query
 * Breaks down the query step by step to find why it returns empty results
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function testQuery() {
  const days = 30; // Default period
  
  console.log('='.repeat(80));
  console.log('REVENUE ANALYTICS QUERY INVESTIGATION');
  console.log('='.repeat(80));
  console.log(`Period: Last ${days} days\n`);

  try {
    // Step 1: Check if payments table exists
    console.log('Step 1: Checking if payments table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
      );
    `);
    console.log(`✅ Payments table exists: ${tableCheck.rows[0].exists}\n`);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Payments table does not exist!');
      return;
    }

    // Step 2: Check total count of payments
    console.log('Step 2: Checking total payments count...');
    const totalCount = await pool.query('SELECT COUNT(*) as total FROM payments');
    console.log(`✅ Total payments in table: ${totalCount.rows[0].total}\n`);

    // Step 3: Check payments with different statuses
    console.log('Step 3: Checking payment_status distribution...');
    const statusDist = await pool.query(`
      SELECT payment_status, COUNT(*) as count 
      FROM payments 
      GROUP BY payment_status 
      ORDER BY count DESC;
    `);
    console.log('Payment Status Distribution:');
    statusDist.rows.forEach(row => {
      console.log(`  - ${row.payment_status || '(NULL)'}: ${row.count}`);
    });
    console.log('');

    // Step 4: Check payments in the date range
    console.log(`Step 4: Checking payments in last ${days} days...`);
    const dateRangeCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `);
    console.log(`✅ Payments in last ${days} days: ${dateRangeCount.rows[0].count}\n`);

    // Step 5: Check payments with completed/success status
    console.log('Step 5: Checking payments with completed/success status...');
    const statusCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments 
      WHERE payment_status IN ('completed', 'success')
    `);
    console.log(`✅ Payments with status 'completed' or 'success': ${statusCount.rows[0].count}\n`);

    // Step 6: Check payments matching both conditions
    console.log(`Step 6: Checking payments matching both conditions (date range + status)...`);
    const bothConditions = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' 
        AND payment_status IN ('completed', 'success')
    `);
    console.log(`✅ Payments matching both conditions: ${bothConditions.rows[0].count}\n`);

    // Step 7: Check sample of recent payments
    console.log('Step 7: Sample of recent payments (last 10)...');
    const samplePayments = await pool.query(`
      SELECT 
        id, 
        amount, 
        payment_status, 
        created_at,
        platform_fee,
        commission_amount
      FROM payments 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log('Sample Payments:');
    if (samplePayments.rows.length === 0) {
      console.log('  ❌ No payments found in table');
    } else {
      samplePayments.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ID: ${row.id?.substring(0, 8)}... | Amount: ${row.amount} | Status: ${row.payment_status || '(NULL)'} | Created: ${row.created_at}`);
        console.log(`     Platform Fee: ${row.platform_fee || '(NULL)'} | Commission: ${row.commission_amount || '(NULL)'}`);
      });
    }
    console.log('');

    // Step 8: Check date range boundaries
    console.log('Step 8: Checking date range boundaries...');
    const dateBoundaries = await pool.query(`
      SELECT 
        MIN(created_at) as oldest_payment,
        MAX(created_at) as newest_payment,
        CURRENT_DATE - INTERVAL '${days} days' as cutoff_date
      FROM payments
    `);
    if (dateBoundaries.rows[0].oldest_payment) {
      console.log(`✅ Oldest payment: ${dateBoundaries.rows[0].oldest_payment}`);
      console.log(`✅ Newest payment: ${dateBoundaries.rows[0].newest_payment}`);
      console.log(`✅ Cutoff date (${days} days ago): ${dateBoundaries.rows[0].cutoff_date}`);
      const oldestDate = new Date(dateBoundaries.rows[0].oldest_payment);
      const cutoffDate = new Date(dateBoundaries.rows[0].cutoff_date);
      if (oldestDate > cutoffDate) {
        console.log(`⚠️  WARNING: Oldest payment is newer than cutoff date!`);
      }
    } else {
      console.log('❌ No payments found to check dates');
    }
    console.log('');

    // Step 9: Run the actual query
    console.log('Step 9: Running the actual revenue analytics query...');
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
    
    console.log(`✅ Query returned ${revenueData.rows.length} rows\n`);
    
    if (revenueData.rows.length === 0) {
      console.log('❌ NO RESULTS - Query returned empty array');
      console.log('\nPossible reasons:');
      console.log('  1. No payments with status "completed" or "success"');
      console.log('  2. No payments in the last 30 days');
      console.log('  3. Payment status values are different (check Step 3)');
      console.log('  4. Created_at dates are outside the range (check Step 8)');
    } else {
      console.log('Results:');
      revenueData.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Date: ${row.date} | Revenue: ₹${parseFloat(row.revenue || 0).toLocaleString()} | Commission: ₹${parseFloat(row.commission || 0).toLocaleString()} | Count: ${row.count}`);
      });
    }

    // Step 10: Check if we should query bookings instead
    console.log('\n' + '='.repeat(80));
    console.log('Step 10: Checking if bookings table has data...');
    const bookingsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings'
      );
    `);
    console.log(`✅ Bookings table exists: ${bookingsCheck.rows[0].exists}`);
    
    if (bookingsCheck.rows[0].exists) {
      const bookingsCount = await pool.query('SELECT COUNT(*) as total FROM bookings');
      console.log(`✅ Total bookings: ${bookingsCount.rows[0].total}`);
      
      const completedBookings = await pool.query(`
        SELECT COUNT(*) as count
        FROM bookings 
        WHERE status = 'completed'
          AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      `);
      console.log(`✅ Completed bookings in last ${days} days: ${completedBookings.rows[0].count}`);
      
      if (parseInt(completedBookings.rows[0].count) > 0) {
        console.log('\n💡 SUGGESTION: Revenue might be in bookings table, not payments table!');
        console.log('   Consider querying bookings.total_amount instead of payments.amount');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testQuery().catch(console.error);
