/**
 * Test Revenue Analytics Query
 * Runs the query from analytics.admin.ts and breaks it down if empty
 */

const { Pool } = require('pg');

// Get database connection from environment variables
function getDbConfig() {
  // Try DATABASE_URL first
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  
  // Fall back to individual components
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'warmpawz',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

async function runQuery() {
  const pool = new Pool(getDbConfig());
  
  try {
    console.log('🔍 Testing Revenue Analytics Query\n');
    console.log('Database Config:', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '5432',
      database: process.env.DB_NAME || 'warmpawz',
      user: process.env.DB_USER || 'postgres',
    });
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 1: Check if payments table exists
    console.log('📊 Step 1: Checking if payments table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ ERROR: payments table does not exist!');
      await pool.end();
      return;
    }
    console.log('✅ payments table exists\n');

    // Test 2: Check table structure
    console.log('📊 Step 2: Checking payments table structure...');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payments'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in payments table:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    console.log('');

    // Test 3: Count total rows
    console.log('📊 Step 3: Counting total rows in payments table...');
    const totalCount = await pool.query('SELECT COUNT(*) as total FROM payments');
    console.log(`Total rows: ${totalCount.rows[0].total}\n`);

    // Test 4: Check date range of data
    console.log('📊 Step 4: Checking date range of payments...');
    const dateRange = await pool.query(`
      SELECT 
        MIN(created_at) as earliest,
        MAX(created_at) as latest,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as last_30_days,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as last_7_days
      FROM payments;
    `);
    const range = dateRange.rows[0];
    console.log(`Earliest payment: ${range.earliest || 'N/A'}`);
    console.log(`Latest payment: ${range.latest || 'N/A'}`);
    console.log(`Payments in last 30 days: ${range.last_30_days}`);
    console.log(`Payments in last 7 days: ${range.last_7_days}\n`);

    // Test 5: Check payment_status values
    console.log('📊 Step 5: Checking payment_status values...');
    const statusCheck = await pool.query(`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM payments
      GROUP BY payment_status
      ORDER BY count DESC;
    `);
    console.log('Payment status distribution:');
    statusCheck.rows.forEach(row => {
      console.log(`  - ${row.payment_status || 'NULL'}: ${row.count}`);
    });
    console.log('');

    // Test 6: Check for completed/success payments
    console.log('📊 Step 6: Checking for completed/success payments...');
    const completedCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments
      WHERE payment_status IN ('completed', 'success');
    `);
    console.log(`Completed/Success payments: ${completedCheck.rows[0].count}\n`);

    // Test 7: Check for completed/success payments in last 30 days
    console.log('📊 Step 7: Checking for completed/success payments in last 30 days...');
    const recentCompleted = await pool.query(`
      SELECT COUNT(*) as count
      FROM payments
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND payment_status IN ('completed', 'success');
    `);
    console.log(`Completed/Success payments (last 30 days): ${recentCompleted.rows[0].count}\n`);

    // Test 8: Run the actual query with 30 days
    console.log('📊 Step 8: Running the actual revenue query (30 days)...');
    const days = 30;
    const revenueData = await pool.query(`
      SELECT DATE_TRUNC('day', created_at) as date, 
             COALESCE(SUM(amount), 0) as revenue,
             COALESCE(SUM(COALESCE(platform_fee, commission_amount)), 0) as commission,
             COUNT(*) as count
      FROM payments 
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' 
        AND payment_status IN ('completed', 'success')
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date;
    `);
    
    console.log(`Results: ${revenueData.rows.length} rows`);
    if (revenueData.rows.length > 0) {
      console.log('\nFirst 5 rows:');
      revenueData.rows.slice(0, 5).forEach((row, idx) => {
        console.log(`  ${idx + 1}. Date: ${row.date}, Revenue: ₹${row.revenue}, Commission: ₹${row.commission}, Count: ${row.count}`);
      });
    } else {
      console.log('⚠️  No results returned!\n');
      
      // Test 9: Try without date filter
      console.log('📊 Step 9: Trying query without date filter...');
      const allTimeData = await pool.query(`
        SELECT DATE_TRUNC('day', created_at) as date, 
               COALESCE(SUM(amount), 0) as revenue,
               COALESCE(SUM(COALESCE(platform_fee, commission_amount)), 0) as commission,
               COUNT(*) as count
        FROM payments 
        WHERE payment_status IN ('completed', 'success')
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
        LIMIT 10;
      `);
      console.log(`Results (all time): ${allTimeData.rows.length} rows`);
      if (allTimeData.rows.length > 0) {
        console.log('\nFirst 5 rows:');
        allTimeData.rows.slice(0, 5).forEach((row, idx) => {
          console.log(`  ${idx + 1}. Date: ${row.date}, Revenue: ₹${row.revenue}, Commission: ₹${row.commission}, Count: ${row.count}`);
        });
      }
    }

    // Test 10: Sample raw payment data
    console.log('\n📊 Step 10: Sample raw payment data (last 5 payments)...');
    const sampleData = await pool.query(`
      SELECT 
        id,
        created_at,
        payment_status,
        amount,
        platform_fee,
        commission_amount
      FROM payments
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    console.log('Sample payments:');
    sampleData.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ID: ${row.id?.substring(0, 8)}..., Date: ${row.created_at}, Status: ${row.payment_status}, Amount: ₹${row.amount || 0}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Query investigation complete!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the investigation
runQuery().catch(console.error);
