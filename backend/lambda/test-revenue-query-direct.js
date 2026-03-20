/**
 * Test script to investigate revenue analytics query
 * Uses the backend's query function to connect to the database
 */

// Import the query function from the backend
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// Since we can't easily import TypeScript modules, let's use psql or direct connection
// This script will provide SQL queries you can run manually

const days = 30;

console.log('='.repeat(80));
console.log('REVENUE ANALYTICS QUERY INVESTIGATION');
console.log('='.repeat(80));
console.log(`Period: Last ${days} days\n`);

console.log('Since local PostgreSQL is not running, here are the SQL queries to run manually:\n');

console.log('STEP 1: Check if payments table exists');
console.log('─'.repeat(80));
console.log(`
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'payments'
);
`);

console.log('\nSTEP 2: Check total payments count');
console.log('─'.repeat(80));
console.log(`
SELECT COUNT(*) as total FROM payments;
`);

console.log('\nSTEP 3: Check payment_status distribution');
console.log('─'.repeat(80));
console.log(`
SELECT payment_status, COUNT(*) as count 
FROM payments 
GROUP BY payment_status 
ORDER BY count DESC;
`);

console.log('\nSTEP 4: Check payments in date range');
console.log('─'.repeat(80));
console.log(`
SELECT COUNT(*) as count
FROM payments 
WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days';
`);

console.log('\nSTEP 5: Check payments with completed/success status');
console.log('─'.repeat(80));
console.log(`
SELECT COUNT(*) as count
FROM payments 
WHERE payment_status IN ('completed', 'success');
`);

console.log('\nSTEP 6: Check payments matching both conditions');
console.log('─'.repeat(80));
console.log(`
SELECT COUNT(*) as count
FROM payments 
WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days' 
  AND payment_status IN ('completed', 'success');
`);

console.log('\nSTEP 7: Sample of recent payments');
console.log('─'.repeat(80));
console.log(`
SELECT 
  id, 
  amount, 
  payment_status, 
  created_at,
  platform_fee,
  commission_amount
FROM payments 
ORDER BY created_at DESC 
LIMIT 10;
`);

console.log('\nSTEP 8: Check date range boundaries');
console.log('─'.repeat(80));
console.log(`
SELECT 
  MIN(created_at) as oldest_payment,
  MAX(created_at) as newest_payment,
  CURRENT_DATE - INTERVAL '${days} days' as cutoff_date
FROM payments;
`);

console.log('\nSTEP 9: THE ACTUAL REVENUE QUERY');
console.log('─'.repeat(80));
console.log(`
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

console.log('\nSTEP 10: Check bookings table (alternative source)');
console.log('─'.repeat(80));
console.log(`
SELECT COUNT(*) as total FROM bookings;
SELECT COUNT(*) as completed_bookings
FROM bookings 
WHERE status = 'completed'
  AND created_at >= CURRENT_DATE - INTERVAL '${days} days';
`);

console.log('\n' + '='.repeat(80));
console.log('TO RUN THESE QUERIES:');
console.log('='.repeat(80));
console.log('\nOption 1: Using psql (if PostgreSQL is installed):');
console.log(`  psql -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} -U ${process.env.DB_USER || 'postgres'} -d ${process.env.DB_NAME || 'warmpawz'}`);
console.log('\nOption 2: Using pgAdmin or another PostgreSQL client');
console.log('\nOption 3: Test via the API endpoint (if backend is running):');
console.log('  curl http://localhost:3000/admin/analytics/revenue?period=30d');
console.log('\nOption 4: Start PostgreSQL locally or connect to remote database');
console.log('='.repeat(80));
