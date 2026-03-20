/**
 * Diagnose E-Commerce Sellers Query
 * Understand which vendors are being counted by the analytics endpoint
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

async function diagnoseEcommerceSellers() {
  const pool = new Pool(getDbConfig());
  
  try {
    console.log('🔍 Diagnosing E-Commerce Sellers Query\n');
    console.log('='.repeat(80) + '\n');

    // Run the exact query from the endpoint
    console.log('📊 Step 1: Running Exact Endpoint Query\n');
    const sellerStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT v.id) FILTER (WHERE 
          v.is_active = true 
          AND (v.is_deleted IS NULL OR v.is_deleted = false)
          AND (
            r.name = 'pet_product' OR 
            r.name = 'pet_products_store' OR 
            r.name = 'product_seller' OR 
            r.name = 'pet_product_seller' OR
            r.name = 'seller' OR
            (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
          )
        ) as active_sellers,
        COUNT(DISTINCT v.id) FILTER (WHERE 
          (v.is_deleted IS NULL OR v.is_deleted = false)
          AND (
            r.name = 'pet_product' OR 
            r.name = 'pet_products_store' OR 
            r.name = 'product_seller' OR 
            r.name = 'pet_product_seller' OR
            r.name = 'seller' OR
            (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
          )
        ) as total_sellers
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
    `);

    console.log('Query Results:');
    console.log(`  Active Sellers: ${sellerStats.rows[0]?.active_sellers || 0}`);
    console.log(`  Total Sellers: ${sellerStats.rows[0]?.total_sellers || 0}`);
    console.log('');

    // Step 2: List all vendors that match the criteria
    console.log('📋 Step 2: Listing All Matching Vendors\n');
    const matchingVendors = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.phone,
        v.email,
        v.is_active,
        v.is_deleted,
        v.seller_status,
        v.status as vendor_status,
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        CASE 
          WHEN r.name = 'pet_product' OR 
               r.name = 'pet_products_store' OR 
               r.name = 'product_seller' OR 
               r.name = 'pet_product_seller' OR
               r.name = 'seller' THEN '✅ ROLE_MATCH'
          WHEN v.seller_status IS NOT NULL AND v.seller_status != 'not_applied' THEN '✅ SELLER_STATUS_MATCH'
          ELSE '❌ NO_MATCH'
        END as match_reason,
        CASE 
          WHEN v.is_active = true AND (v.is_deleted IS NULL OR v.is_deleted = false) THEN '✅ ACTIVE'
          ELSE '❌ INACTIVE'
        END as active_status
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE (
        r.name = 'pet_product' OR 
        r.name = 'pet_products_store' OR 
        r.name = 'product_seller' OR 
        r.name = 'pet_product_seller' OR
        r.name = 'seller' OR
        (v.seller_status IS NOT NULL AND v.seller_status != 'not_applied')
      )
      AND (v.is_deleted IS NULL OR v.is_deleted = false)
      ORDER BY 
        CASE WHEN v.is_active = true THEN 0 ELSE 1 END,
        v.business_name
    `);

    console.log(`Found ${matchingVendors.rows.length} vendors matching the criteria:\n`);
    
    let activeCount = 0;
    matchingVendors.rows.forEach((vendor, index) => {
      const isActive = vendor.is_active && (vendor.is_deleted === null || vendor.is_deleted === false);
      if (isActive) activeCount++;
      
      console.log(`${index + 1}. ${vendor.business_name || 'N/A'}`);
      console.log(`   ID: ${vendor.id}`);
      console.log(`   Phone: ${vendor.phone}`);
      console.log(`   Email: ${vendor.email || 'N/A'}`);
      console.log(`   Role: ${vendor.role_name || 'NULL'} (${vendor.role_display_name || 'N/A'})`);
      console.log(`   Seller Status: ${vendor.seller_status || 'NULL'}`);
      console.log(`   Vendor Status: ${vendor.vendor_status || 'N/A'}`);
      console.log(`   Is Active: ${vendor.is_active}`);
      console.log(`   Is Deleted: ${vendor.is_deleted || false}`);
      console.log(`   Match Reason: ${vendor.match_reason}`);
      console.log(`   Active Status: ${vendor.active_status}`);
      console.log(`   Counted as Active Seller: ${isActive ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });

    console.log(`\n📊 Summary:`);
    console.log(`  Total Matching Vendors: ${matchingVendors.rows.length}`);
    console.log(`  Active Vendors: ${activeCount}`);
    console.log(`  Query Result Active Sellers: ${sellerStats.rows[0]?.active_sellers || 0}`);
    console.log(`  Query Result Total Sellers: ${sellerStats.rows[0]?.total_sellers || 0}`);
    console.log('');

    // Step 3: Breakdown by match reason
    console.log('📊 Step 3: Breakdown by Match Reason\n');
    const roleMatches = matchingVendors.rows.filter(v => v.match_reason.includes('ROLE_MATCH'));
    const statusMatches = matchingVendors.rows.filter(v => v.match_reason.includes('SELLER_STATUS_MATCH'));
    
    console.log(`Role Matches: ${roleMatches.length}`);
    roleMatches.forEach(v => {
      console.log(`  - ${v.business_name} (${v.role_name})`);
    });
    console.log('');
    
    console.log(`Seller Status Matches: ${statusMatches.length}`);
    statusMatches.forEach(v => {
      console.log(`  - ${v.business_name} (seller_status: ${v.seller_status}, role: ${v.role_name || 'NULL'})`);
    });
    console.log('');

    // Step 4: Check for vendors with seller_status but non-e-commerce roles
    console.log('📊 Step 4: Vendors with seller_status but non-e-commerce roles\n');
    const nonEcommerceWithStatus = matchingVendors.rows.filter(v => 
      v.seller_status && 
      v.seller_status !== 'not_applied' &&
      v.role_name !== 'pet_product' &&
      v.role_name !== 'pet_products_store' &&
      v.role_name !== 'product_seller' &&
      v.role_name !== 'pet_product_seller' &&
      v.role_name !== 'seller'
    );
    
    if (nonEcommerceWithStatus.length > 0) {
      console.log(`⚠️  Found ${nonEcommerceWithStatus.length} vendors with seller_status but non-e-commerce roles:\n`);
      nonEcommerceWithStatus.forEach(v => {
        console.log(`  - ${v.business_name}`);
        console.log(`    Role: ${v.role_name || 'NULL'}`);
        console.log(`    Seller Status: ${v.seller_status}`);
        console.log(`    This vendor is being counted because seller_status != 'not_applied'`);
        console.log('');
      });
    } else {
      console.log('✅ No vendors with seller_status but non-e-commerce roles found');
    }

    console.log('='.repeat(80));
    console.log('✅ Diagnosis Complete');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  diagnoseEcommerceSellers()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Diagnosis failed:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseEcommerceSellers };
