/**
 * Test the exact endpoint query with error simulation
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

async function testEndpointQuery() {
  const pool = new Pool(getDbConfig());
  
  try {
    const limit = 5;
    const targetVendorId = 'f2d48ae8-e863-46de-b2b6-cb723a551840';
    
    console.log('🔍 Testing Endpoint Query Logic\n');
    console.log('='.repeat(80) + '\n');

    // Test 1: Main query (with all joins)
    console.log('📊 Test 1: Main Query (with orders, reviews, products joins)\n');
    let topSellers;
    try {
      topSellers = await pool.query(`
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
        GROUP BY v.id, v.business_name, v.owner_name, v.email, v.phone
        ORDER BY total_revenue DESC
        LIMIT $1
      `, [limit]);
      
      console.log(`✅ Main query succeeded`);
      console.log(`   Found ${topSellers.rows.length} vendors\n`);
      
      const targetInMain = topSellers.rows.find(s => s.id === targetVendorId);
      if (targetInMain) {
        console.log(`✅ Target vendor FOUND in main query results`);
      } else {
        console.log(`❌ Target vendor NOT in main query results`);
      }
      
    } catch (error) {
      console.log(`❌ Main query FAILED: ${error.message}`);
      console.log(`   This would trigger the fallback query\n`);
      
      // Test fallback query
      console.log('📊 Test 2: Fallback Query (simpler, no joins)\n');
      try {
        topSellers = await pool.query(`
          SELECT 
            v.id, 
            v.business_name as name,
            v.business_name,
            v.owner_name, 
            v.email,
            v.phone,
            0 as total_revenue, 
            0 as total_bookings,
            0 as product_count,
            0 as avg_rating
          FROM vendors v
          LEFT JOIN roles r ON v.role_id = r.id
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
          ORDER BY v.created_at DESC
          LIMIT $1
        `, [limit]);
        
        console.log(`✅ Fallback query succeeded`);
        console.log(`   Found ${topSellers.rows.length} vendors\n`);
        
        const targetInFallback = topSellers.rows.find(s => s.id === targetVendorId);
        if (targetInFallback) {
          console.log(`✅ Target vendor FOUND in fallback query results`);
        } else {
          console.log(`❌ Target vendor NOT in fallback query results`);
        }
      } catch (fallbackError) {
        console.log(`❌ Fallback query also FAILED: ${fallbackError.message}`);
      }
    }

    // Show all results
    if (topSellers && topSellers.rows.length > 0) {
      console.log('\n📋 All Results:\n');
      topSellers.rows.forEach((seller, index) => {
        const isTarget = seller.id === targetVendorId;
        console.log(`${index + 1}. ${seller.name || seller.business_name}${isTarget ? ' ⭐ TARGET' : ''}`);
        console.log(`   ID: ${seller.id}`);
        console.log(`   Phone: ${seller.phone}`);
        console.log(`   Revenue: ₹${seller.total_revenue || 0}`);
        console.log('');
      });
    }

    // Check if there are any issues with the tables
    console.log('🔍 Checking Table Existence:\n');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('orders', 'reviews', 'products')
      ORDER BY table_name
    `);
    
    console.log('Tables found:');
    tableCheck.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
    if (tableCheck.rows.length < 3) {
      console.log('\n⚠️  Some tables are missing - this could cause the main query to fail');
      console.log('   Missing tables would trigger the fallback query');
    }

    console.log('\n' + '='.repeat(80));
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
  testEndpointQuery()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testEndpointQuery };
