/**
 * Query E-Commerce Vendor
 * Queries the database for the e-commerce vendor we created
 */

const { Pool } = require('pg');

// Get database connection from environment variables
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

async function queryEcommerceVendor() {
  const pool = new Pool(getDbConfig());
  
  try {
    console.log('🔍 Querying E-Commerce Vendor\n');
    console.log('='.repeat(80) + '\n');

    // Query for the e-commerce vendor we created
    const vendorQuery = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.email,
        v.seller_status,
        v.status,
        v.is_active,
        v.is_deleted,
        v.address,
        v.city,
        v.state,
        v.pincode,
        r.name as role_name,
        r.display_name as role_display_name,
        vi.id as vendor_identity_id,
        vi.onboarding_status,
        vi.vendor_type
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      LEFT JOIN vendor_identity vi ON v.vendor_identity_id = vi.id
      WHERE v.business_name = 'WarmPawz Test Store'
         OR v.phone = '9876543210'
         OR v.email = 'ecommerce-seller@warmpawz.com'
      ORDER BY v.created_at DESC
      LIMIT 5
    `);

    if (vendorQuery.rows.length === 0) {
      console.log('❌ No vendor found with business name "WarmPawz Test Store"');
      console.log('   Trying to find any e-commerce sellers...\n');
      
      // Try to find any e-commerce sellers
      const ecommerceQuery = await pool.query(`
        SELECT 
          v.id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.email,
          v.seller_status,
          v.status,
          r.name as role_name,
          r.display_name as role_display_name
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
        ORDER BY v.created_at DESC
        LIMIT 10
      `);

      if (ecommerceQuery.rows.length === 0) {
        console.log('❌ No e-commerce sellers found in database');
      } else {
        console.log(`✅ Found ${ecommerceQuery.rows.length} e-commerce seller(s):\n`);
        ecommerceQuery.rows.forEach((vendor, index) => {
          console.log(`${index + 1}. ${vendor.business_name}`);
          console.log(`   ID: ${vendor.id}`);
          console.log(`   Phone: ${vendor.phone}`);
          console.log(`   Email: ${vendor.email}`);
          console.log(`   Role: ${vendor.role_name || 'N/A'} (${vendor.role_display_name || 'N/A'})`);
          console.log(`   Seller Status: ${vendor.seller_status || 'not_applied'}`);
          console.log(`   Vendor Status: ${vendor.status || 'N/A'}`);
          console.log('');
        });
      }
    } else {
      console.log(`✅ Found ${vendorQuery.rows.length} vendor(s):\n`);
      vendorQuery.rows.forEach((vendor, index) => {
        console.log(`${index + 1}. ${vendor.business_name}`);
        console.log('   ' + '='.repeat(78));
        console.log(`   Vendor ID: ${vendor.id}`);
        console.log(`   Vendor Identity ID: ${vendor.vendor_identity_id || 'N/A'}`);
        console.log(`   Business Name: ${vendor.business_name}`);
        console.log(`   Owner Name: ${vendor.owner_name}`);
        console.log(`   Phone: ${vendor.phone}`);
        console.log(`   Email: ${vendor.email}`);
        console.log(`   Role: ${vendor.role_name || 'N/A'} (${vendor.role_display_name || 'N/A'})`);
        console.log(`   Seller Status: ${vendor.seller_status || 'not_applied'}`);
        console.log(`   Vendor Status: ${vendor.status || 'N/A'}`);
        console.log(`   Is Active: ${vendor.is_active}`);
        console.log(`   Is Deleted: ${vendor.is_deleted || false}`);
        console.log(`   Onboarding Status: ${vendor.onboarding_status || 'N/A'}`);
        console.log(`   Vendor Type: ${vendor.vendor_type || 'N/A'}`);
        console.log(`   Address: ${vendor.address || 'N/A'}`);
        console.log(`   City: ${vendor.city || 'N/A'}`);
        console.log(`   State: ${vendor.state || 'N/A'}`);
        console.log(`   Pincode: ${vendor.pincode || 'N/A'}`);
        console.log('');
      });
    }

    // Also check products for this vendor
    if (vendorQuery.rows.length > 0) {
      const vendorId = vendorQuery.rows[0].id;
      console.log('📦 Checking for products...\n');
      
      try {
        const productsQuery = await pool.query(`
          SELECT 
            id,
            name,
            price,
            status,
            is_active,
            stock_quantity
          FROM products
          WHERE vendor_id = $1
          ORDER BY created_at DESC
          LIMIT 5
        `, [vendorId]);

        if (productsQuery.rows.length > 0) {
          console.log(`✅ Found ${productsQuery.rows.length} product(s):\n`);
          productsQuery.rows.forEach((product, index) => {
            console.log(`  ${index + 1}. ${product.name}`);
            console.log(`     ID: ${product.id}`);
            console.log(`     Price: ₹${product.price || 0}`);
            console.log(`     Status: ${product.status || 'N/A'}`);
            console.log(`     Is Active: ${product.is_active}`);
            console.log(`     Stock: ${product.stock_quantity || 0}`);
            console.log('');
          });
        } else {
          console.log('⚠️  No products found for this vendor');
        }
      } catch (productError) {
        console.log(`⚠️  Could not query products: ${productError.message}`);
      }
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

// Run the script
if (require.main === module) {
  queryEcommerceVendor()
    .then(() => {
      console.log('\n✅ Query completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Query failed:', error);
      process.exit(1);
    });
}

module.exports = { queryEcommerceVendor };
