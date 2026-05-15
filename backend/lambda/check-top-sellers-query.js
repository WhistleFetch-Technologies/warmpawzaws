/**
 * Check what the top-sellers endpoint actually returns
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

async function checkTopSellers() {
  const pool = new Pool(getDbConfig());
  
  try {
    const limit = 5;
    const targetVendorId = 'f2d48ae8-e863-46de-b2b6-cb723a551840';
    
    console.log('🔍 Checking Top Sellers Query Results\n');
    console.log('='.repeat(80) + '\n');

    // Run the exact query from the endpoint
    const topSellers = await pool.query(`
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

    console.log(`📊 Found ${topSellers.rows.length} vendor(s) in results:\n`);
    
    let targetFound = false;
    topSellers.rows.forEach((seller, index) => {
      const isTarget = seller.id === targetVendorId;
      if (isTarget) targetFound = true;
      
      console.log(`${index + 1}. ${seller.name || seller.business_name}`);
      console.log(`   ID: ${seller.id}${isTarget ? ' ⭐ TARGET VENDOR' : ''}`);
      console.log(`   Phone: ${seller.phone}`);
      console.log(`   Revenue: ₹${seller.total_revenue || 0}`);
      console.log(`   Orders: ${seller.total_bookings || 0}`);
      console.log(`   Products: ${seller.product_count || 0}`);
      console.log(`   Rating: ${seller.avg_rating || 0}`);
      console.log('');
    });

    if (!targetFound) {
      console.log('❌ Target vendor NOT found in top 5 results\n');
      console.log('🔍 Checking if target vendor exists in full query (without limit)...\n');
      
      const allSellers = await pool.query(`
        SELECT 
          v.id,
          v.business_name as name,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status = 'delivered'), 0) as total_revenue,
          COUNT(o.id) FILTER (WHERE o.order_status = 'delivered') as total_bookings
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        LEFT JOIN orders o ON v.id = o.vendor_id AND o.order_status = 'delivered'
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
        GROUP BY v.id, v.business_name
        ORDER BY total_revenue DESC
      `);

      const targetIndex = allSellers.rows.findIndex(s => s.id === targetVendorId);
      
      if (targetIndex >= 0) {
        console.log(`✅ Target vendor found at position ${targetIndex + 1} out of ${allSellers.rows.length} total vendors`);
        console.log(`   Revenue: ₹${allSellers.rows[targetIndex].total_revenue || 0}`);
        console.log(`   Orders: ${allSellers.rows[targetIndex].total_bookings || 0}`);
        console.log('');
        console.log(`💡 Reason: Vendor has 0 revenue, so it's sorted to the bottom.`);
        console.log(`   Only top ${limit} vendors by revenue are returned.`);
        console.log(`   There are ${targetIndex} vendors with higher revenue (even if 0).`);
      } else {
        console.log('❌ Target vendor NOT found in full query either!');
        console.log('   This means the vendor does not match the query conditions.');
      }
    } else {
      console.log('✅ Target vendor IS in the top 5 results!');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkTopSellers()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkTopSellers };
