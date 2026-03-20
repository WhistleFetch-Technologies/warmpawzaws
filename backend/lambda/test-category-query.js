/**
 * Test Category Analytics Query
 * Runs the category query from analytics.admin.ts
 */

const { Pool } = require('pg');

function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  
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
    console.log('🔍 Testing Category Analytics Query\n');
    console.log('='.repeat(80) + '\n');

    const period = "30d";
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : 30;

    // Step 1: Check if tables exist
    console.log('📊 Step 1: Checking if required tables exist...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('vendors', 'roles', 'bookings')
      ORDER BY table_name;
    `);
    console.log('Tables found:', tables.rows.map(r => r.table_name).join(', '));
    console.log('');

    // Step 2: Check vendors with approved status
    console.log('📊 Step 2: Checking approved/active vendors...');
    const vendorsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved' AND is_active = true) as approved_active
      FROM vendors
      WHERE is_deleted IS NULL OR is_deleted = false;
    `);
    console.log(`Total vendors: ${vendorsCheck.rows[0].total}`);
    console.log(`Approved & Active vendors: ${vendorsCheck.rows[0].approved_active}\n`);

    // Step 3: Check bookings
    console.log('📊 Step 3: Checking bookings...');
    const bookingsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '${days} days') as completed_recent
      FROM bookings;
    `);
    console.log(`Total bookings: ${bookingsCheck.rows[0].total}`);
    console.log(`Completed bookings: ${bookingsCheck.rows[0].completed}`);
    console.log(`Completed bookings (last ${days} days): ${bookingsCheck.rows[0].completed_recent}\n`);

    // Step 4: Check vendor-role relationships
    console.log('📊 Step 4: Checking vendor-role relationships...');
    const vendorRoles = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(v.role_id) as with_role,
        COUNT(rl.id) as with_role_name
      FROM vendors v
      LEFT JOIN roles rl ON v.role_id = rl.id
      WHERE v.status = 'approved' AND v.is_active = true
        AND (v.is_deleted IS NULL OR v.is_deleted = false);
    `);
    console.log(`Vendors with role_id: ${vendorRoles.rows[0].with_role}`);
    console.log(`Vendors with role name: ${vendorRoles.rows[0].with_role_name}\n`);

    // Step 5: Run the actual category query
    console.log('📊 Step 5: Running the actual category query...');
    const categoryData = await pool.query(`
      SELECT 
        COALESCE(rl.name, rl.display_name, v.category, 'Other') as category_name,
        COUNT(b.id) as bookings,
        COALESCE(SUM(b.total_amount), 0) as revenue
      FROM vendors v
      LEFT JOIN roles rl ON v.role_id = rl.id
      LEFT JOIN bookings b ON v.id = b.vendor_id 
        AND b.created_at >= CURRENT_DATE - INTERVAL '${days} days'
        AND b.status = 'completed'
      WHERE v.status = 'approved' AND v.is_active = true
        AND (v.is_deleted IS NULL OR v.is_deleted = false)
      GROUP BY COALESCE(rl.name, rl.display_name, v.category, 'Other')
      HAVING COALESCE(rl.name, rl.display_name, v.category, 'Other') IS NOT NULL
      ORDER BY revenue DESC;
    `);

    console.log(`Results: ${categoryData.rows.length} categories`);
    if (categoryData.rows.length > 0) {
      console.log('\nCategory breakdown:');
      categoryData.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.category_name}: ₹${row.revenue} (${row.bookings} bookings)`);
      });
    } else {
      console.log('⚠️  No categories found!\n');
      
      // Debug: Check what's happening
      console.log('📊 Debug: Checking individual parts...');
      
      // Check vendors without bookings
      const vendorsNoBookings = await pool.query(`
        SELECT 
          COALESCE(rl.name, rl.display_name, v.category, 'Other') as category_name,
          COUNT(*) as vendor_count
        FROM vendors v
        LEFT JOIN roles rl ON v.role_id = rl.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND (v.is_deleted IS NULL OR v.is_deleted = false)
        GROUP BY COALESCE(rl.name, rl.display_name, v.category, 'Other')
        ORDER BY vendor_count DESC
        LIMIT 10;
      `);
      console.log('\nVendors by category (without booking filter):');
      vendorsNoBookings.rows.forEach(row => {
        console.log(`  - ${row.category_name}: ${row.vendor_count} vendors`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Category query investigation complete!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

runQuery().catch(console.error);
