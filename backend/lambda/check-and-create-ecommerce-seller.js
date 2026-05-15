/**
 * Check and Create E-Commerce Seller
 * 
 * This script:
 * 1. Checks if any e-commerce sellers exist in the database
 * 2. If none exist, creates a complete e-commerce seller with:
 *    - vendor_identity record
 *    - vendors record with seller_status = 'approved'
 *    - Sample product
 *    - All required fields
 */

const { Pool } = require('pg');
const { randomUUID } = require('crypto');

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

async function checkAndCreateEcommerceSeller() {
  const pool = new Pool(getDbConfig());
  
  try {
    console.log('🔍 Checking for E-Commerce Sellers\n');
    console.log('Database Config:', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '5432',
      database: process.env.DB_NAME || 'warmpawz',
      user: process.env.DB_USER || 'postgres',
    });
    console.log('\n' + '='.repeat(80) + '\n');

    // Step 1: Check for existing e-commerce sellers
    console.log('📊 Step 1: Checking for existing e-commerce sellers...');
    const existingSellers = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.phone,
        v.email,
        v.seller_status,
        r.name as role_name
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
    `);

    if (existingSellers.rows.length > 0) {
      console.log(`✅ Found ${existingSellers.rows.length} existing e-commerce seller(s):\n`);
      existingSellers.rows.forEach((seller, index) => {
        console.log(`  ${index + 1}. ${seller.business_name} (${seller.phone})`);
        console.log(`     Role: ${seller.role_name || 'N/A'}`);
        console.log(`     Seller Status: ${seller.seller_status || 'not_applied'}`);
        console.log(`     ID: ${seller.id}\n`);
      });
      console.log('='.repeat(80));
      console.log('✅ E-commerce sellers already exist. No action needed.');
      console.log('='.repeat(80));
      return;
    }

    console.log('❌ No e-commerce sellers found. Creating one...\n');

    // Step 2: Find or create an e-commerce role
    console.log('📋 Step 2: Finding e-commerce role...');
    const roleQuery = await pool.query(`
      SELECT id, name, display_name 
      FROM roles 
      WHERE name IN ('seller', 'pet_products_store', 'product_seller', 'pet_product', 'pet_product_seller')
        AND is_active = true
      ORDER BY 
        CASE name
          WHEN 'seller' THEN 1
          WHEN 'pet_products_store' THEN 2
          WHEN 'product_seller' THEN 3
          WHEN 'pet_product' THEN 4
          WHEN 'pet_product_seller' THEN 5
        END
      LIMIT 1
    `);

    let roleId;
    let roleName;
    if (roleQuery.rows.length > 0) {
      roleId = roleQuery.rows[0].id;
      roleName = roleQuery.rows[0].name;
      console.log(`✅ Found role: ${roleName} (${roleQuery.rows[0].display_name || roleName})`);
    } else {
      console.log('⚠️  No e-commerce role found. Creating "seller" role...');
      // Create a basic seller role
      roleId = randomUUID();
      roleName = 'seller';
      await pool.query(`
        INSERT INTO roles (id, name, display_name, description, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (name) DO UPDATE SET is_active = true
      `, [
        roleId,
        'seller',
        'Pet Store / E-commerce Seller',
        'Vendor who sells products online',
        true
      ]);
      console.log(`✅ Created role: seller (${roleId})`);
    }
    console.log('');

    // Step 3: Create vendor_identity record
    console.log('👤 Step 3: Creating vendor_identity record...');
    const vendorIdentityId = randomUUID();
    const phone = '+919876543210'; // Test phone number
    const phoneNumber = phone.replace('+', ''); // Store without + prefix
    const email = 'ecommerce-seller@warmpawz.com';

    // Check if vendor_identity already exists
    const existingIdentity = await pool.query(
      'SELECT id FROM vendor_identity WHERE phone = $1',
      [phoneNumber]
    );

    let finalIdentityId = vendorIdentityId;
    if (existingIdentity.rows.length > 0) {
      finalIdentityId = existingIdentity.rows[0].id;
      console.log(`⚠️  vendor_identity already exists with phone ${phoneNumber}, updating...`);
      await pool.query(`
        UPDATE vendor_identity
        SET email = $1,
            selected_role_id = $2,
            vendor_type = $3,
            onboarding_status = $4,
            full_name = $5,
            business_name = $6,
            updated_at = NOW()
        WHERE id = $7
      `, [
        email,
        roleId,
        'business',
        'APPROVED',
        'E-Commerce Test Seller',
        'WarmPawz Test Store',
        finalIdentityId
      ]);
      console.log(`✅ Updated vendor_identity: ${finalIdentityId}`);
    } else {
      await pool.query(`
        INSERT INTO vendor_identity (
          id, phone, email, selected_role_id, vendor_type,
          onboarding_status, full_name, business_name,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [
        finalIdentityId,
        phoneNumber,
        email,
        roleId,
        'business', // E-commerce sellers are usually businesses
        'APPROVED', // Already approved
        'E-Commerce Test Seller',
        'WarmPawz Test Store'
      ]);
      console.log(`✅ Created vendor_identity: ${finalIdentityId}`);
    }
    console.log('');

    // Step 4: Create vendors record
    console.log('🏪 Step 4: Creating vendors record...');
    const vendorId = randomUUID();

    await pool.query(`
      INSERT INTO vendors (
        id, vendor_identity_id, phone, email, business_name, owner_name,
        role_id, category, status, tier, seller_status,
        address, city, state, pincode,
        is_active, is_deleted,
        created_at, updated_at, approved_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), NOW())
    `, [
      vendorId,
      vendorIdentityId,
      phone.replace('+', ''), // Store without + prefix
      email,
      'WarmPawz Test Store',
      'Test Seller Owner',
      roleId,
      'retail',
      'active', // Active status
      'Bronze',
      'approved', // Seller status approved
      '123 Test Street, Test Area',
      'Mumbai',
      'Maharashtra',
      '400001',
      true,
      false,
    ]);
    console.log(`✅ Created vendor: ${vendorId}`);
    console.log('');

    // Step 5: Update vendor_identity with vendor_id
    console.log('🔗 Step 5: Linking vendor_identity to vendor...');
    await pool.query(`
      UPDATE vendor_identity
      SET vendor_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [vendorId, vendorIdentityId]);
    console.log('✅ Linked vendor_identity to vendor');
    console.log('');

    // Step 6: Check if products table exists and create a sample product
    console.log('📦 Step 6: Creating sample product...');
    try {
      const productTableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'products'
        )
      `);

      if (productTableCheck.rows[0].exists) {
        // Check if stock_quantity column exists
        const columnCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'products'
            AND column_name = 'stock_quantity'
          )
        `);
        
        const hasStockColumn = columnCheck.rows[0].exists;
        const productId = randomUUID();
        
        if (hasStockColumn) {
          await pool.query(`
            INSERT INTO products (
              id, vendor_id, name, description, price, category_id,
              status, is_active, stock_quantity,
              created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          `, [
            productId,
            vendorId,
            'Premium Dog Food - Test Product',
            'High-quality premium dog food for all breeds. Rich in protein and essential nutrients.',
            999.00,
            null, // category_id - can be set if ecommerce_categories exists
            'active',
            true,
            100
          ]);
        } else {
          // Insert without stock_quantity column
          await pool.query(`
            INSERT INTO products (
              id, vendor_id, name, description, price, category_id,
              status, is_active,
              created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          `, [
            productId,
            vendorId,
            'Premium Dog Food - Test Product',
            'High-quality premium dog food for all breeds. Rich in protein and essential nutrients.',
            999.00,
            null, // category_id - can be set if ecommerce_categories exists
            'active',
            true
          ]);
        }
        console.log(`✅ Created sample product: ${productId}`);
      } else {
        console.log('⚠️  Products table does not exist. Skipping product creation.');
      }
    } catch (productError) {
      console.log(`⚠️  Could not create product: ${productError.message}`);
    }
    console.log('');

    // Step 7: Summary
    console.log('='.repeat(80));
    console.log('✅ E-Commerce Seller Created Successfully!\n');
    console.log('Summary:');
    console.log(`  Vendor ID: ${vendorId}`);
    console.log(`  Business Name: WarmPawz Test Store`);
    console.log(`  Phone: ${phone}`);
    console.log(`  Email: ${email}`);
    console.log(`  Role: ${roleName}`);
    console.log(`  Seller Status: approved`);
    console.log(`  Vendor Status: active`);
    console.log(`  Location: Mumbai, Maharashtra`);
    console.log('');
    console.log('You can now test the e-commerce endpoints:');
    console.log(`  GET /admin/ecommerce/top-sellers`);
    console.log(`  GET /admin/ecommerce/analytics/platform`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    if (pool && !pool.ended) {
      await pool.end();
    }
  }
}

// Run the script
if (require.main === module) {
  checkAndCreateEcommerceSeller()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { checkAndCreateEcommerceSeller };
