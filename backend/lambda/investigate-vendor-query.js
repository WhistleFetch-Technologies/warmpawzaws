/**
 * Investigate why vendor is not appearing in top-sellers endpoint
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

async function investigateVendor() {
  const pool = new Pool(getDbConfig());
  
  try {
    const vendorId = 'f2d48ae8-e863-46de-b2b6-cb723a551840';
    const phone = '9999999999';
    
    console.log('🔍 Investigating Vendor Query\n');
    console.log('='.repeat(80) + '\n');

    // Step 1: Get vendor details
    console.log('📊 Step 1: Vendor Details\n');
    const vendorQuery = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.phone,
        v.email,
        v.status,
        v.is_active,
        v.is_deleted,
        v.seller_status,
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.id = $1 OR v.phone = $2
    `, [vendorId, phone]);

    if (vendorQuery.rows.length === 0) {
      console.log('❌ Vendor not found!');
      await pool.end();
      return;
    }

    const vendor = vendorQuery.rows[0];
    console.log('Vendor Data:');
    console.log(`  ID: ${vendor.id}`);
    console.log(`  Business Name: ${vendor.business_name}`);
    console.log(`  Phone: ${vendor.phone}`);
    console.log(`  Status: ${vendor.status}`);
    console.log(`  Is Active: ${vendor.is_active}`);
    console.log(`  Is Deleted: ${vendor.is_deleted}`);
    console.log(`  Seller Status: ${vendor.seller_status}`);
    console.log(`  Role ID: ${vendor.role_id}`);
    console.log(`  Role Name: ${vendor.role_name}`);
    console.log(`  Role Display Name: ${vendor.role_display_name}`);
    console.log('');

    // Step 2: Check query conditions
    console.log('🔍 Step 2: Checking Query Conditions\n');
    
    const conditions = {
      statusCheck: vendor.status === 'active' || vendor.is_active === true,
      deletedCheck: vendor.is_deleted === null || vendor.is_deleted === false,
      roleCheck: vendor.role_name === 'pet_product' || 
                 vendor.role_name === 'pet_products_store' || 
                 vendor.role_name === 'product_seller' || 
                 vendor.role_name === 'pet_product_seller' ||
                 vendor.role_name === 'seller',
      sellerStatusCheck: vendor.seller_status !== null && vendor.seller_status !== 'not_applied'
    };

    console.log('Condition Results:');
    console.log(`  ✅ Status Check (active OR is_active): ${conditions.statusCheck}`);
    console.log(`     - status = '${vendor.status}'`);
    console.log(`     - is_active = ${vendor.is_active}`);
    console.log(`  ✅ Deleted Check (NOT deleted): ${conditions.deletedCheck}`);
    console.log(`     - is_deleted = ${vendor.is_deleted}`);
    console.log(`  ✅ Role Check (e-commerce role): ${conditions.roleCheck}`);
    console.log(`     - role_name = '${vendor.role_name}'`);
    console.log(`  ❌ Seller Status Check (pending/approved): ${conditions.sellerStatusCheck}`);
    console.log(`     - seller_status = '${vendor.seller_status}'`);
    console.log('');

    // Step 3: Check if vendor matches the full query
    const matchesQuery = conditions.statusCheck && 
                        conditions.deletedCheck && 
                        (conditions.roleCheck || conditions.sellerStatusCheck);

    console.log('📋 Step 3: Overall Query Match\n');
    console.log(`Query Match: ${matchesQuery ? '✅ YES' : '❌ NO'}`);
    console.log('');
    console.log('Breakdown:');
    console.log(`  Status & Deleted: ${conditions.statusCheck && conditions.deletedCheck ? '✅' : '❌'}`);
    console.log(`  E-commerce Role OR Seller Status: ${conditions.roleCheck || conditions.sellerStatusCheck ? '✅' : '❌'}`);
    console.log('');

    // Step 4: Run the actual query to see what happens
    console.log('🔍 Step 4: Running Actual Query\n');
    const actualQuery = await pool.query(`
      SELECT 
        v.id,
        v.business_name as name,
        v.business_name,
        v.owner_name,
        v.email,
        v.phone,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) as total_revenue,
        COUNT(o.id) FILTER (WHERE o.order_status = 'delivered') as total_bookings,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') as product_count,
        COALESCE(AVG(rev.rating), 0) as avg_rating
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      LEFT JOIN orders o ON v.id = o.vendor_id AND o.order_status = 'delivered'
      LEFT JOIN reviews rev ON v.id = rev.vendor_id
      LEFT JOIN products p ON v.id = p.vendor_id AND p.status = 'active'
      WHERE (v.status = 'active' OR v.is_active = true)
        AND (v.is_deleted IS NULL OR v.is_deleted = false)
        AND (
          r.name = 'pet_product' OR 
          r.name = 'pet_products_store' OR 
          r.name = 'product_seller' OR 
          r.name = 'pet_product_seller' OR
          r.name = 'seller' OR
          (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
        )
        AND (v.id = $1 OR v.phone = $2)
      GROUP BY v.id, v.business_name, v.owner_name, v.email, v.phone
      ORDER BY total_revenue DESC
    `, [vendorId, phone]);

    if (actualQuery.rows.length > 0) {
      console.log('✅ Vendor appears in query results!');
      console.log('Result:', actualQuery.rows[0]);
    } else {
      console.log('❌ Vendor does NOT appear in query results');
      console.log('');
      console.log('Reason: The vendor should match because:');
      console.log(`  - Role name is '${vendor.role_name}' which matches 'seller'`);
      console.log(`  - Status check: ${conditions.statusCheck}`);
      console.log(`  - Deleted check: ${conditions.deletedCheck}`);
      console.log('');
      console.log('However, if the query is not finding it, possible issues:');
      console.log('  1. LEFT JOIN with roles might be returning NULL');
      console.log('  2. The vendor might not be in the result set before GROUP BY');
    }
    console.log('');

    // Step 5: Check if role join is working
    console.log('🔍 Step 5: Checking Role Join\n');
    const roleJoinCheck = await pool.query(`
      SELECT 
        v.id,
        v.role_id,
        r.id as joined_role_id,
        r.name as joined_role_name,
        CASE 
          WHEN r.id IS NULL THEN 'NULL - JOIN FAILED'
          WHEN r.name IS NULL THEN 'NULL NAME - JOIN PARTIAL'
          ELSE 'JOIN SUCCESS'
        END as join_status
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.id = $1
    `, [vendorId]);

    if (roleJoinCheck.rows.length > 0) {
      const joinResult = roleJoinCheck.rows[0];
      console.log('Role Join Status:', joinResult.join_status);
      console.log(`  Vendor role_id: ${joinResult.role_id}`);
      console.log(`  Joined role_id: ${joinResult.joined_role_id}`);
      console.log(`  Joined role_name: ${joinResult.joined_role_name}`);
    }
    console.log('');

    // Step 6: Check orders and products
    console.log('🔍 Step 6: Checking Orders and Products\n');
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(o.id) FILTER (WHERE o.order_status = 'delivered') as delivered_orders,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) as total_revenue,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') as active_products
      FROM vendors v
      LEFT JOIN orders o ON v.id = o.vendor_id
      LEFT JOIN products p ON v.id = p.vendor_id
      WHERE v.id = $1
    `, [vendorId]);

    if (statsQuery.rows.length > 0) {
      const stats = statsQuery.rows[0];
      console.log(`  Delivered Orders: ${stats.delivered_orders || 0}`);
      console.log(`  Total Revenue: ₹${stats.total_revenue || 0}`);
      console.log(`  Active Products: ${stats.active_products || 0}`);
      console.log('');
      console.log('💡 Note: Even with 0 orders/products, vendor should still appear if query conditions match');
    }

    console.log('='.repeat(80));
    console.log('✅ Investigation Complete');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  investigateVendor()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateVendor };
