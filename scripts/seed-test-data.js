#!/usr/bin/env node
/**
 * ============================================================================
 * TEST DATA SEEDING SCRIPT
 * ============================================================================
 * 
 * Creates real vendor, customer, and product data for E2E testing.
 * 
 * Usage:
 *   node scripts/seed-test-data.js
 *   ENVIRONMENT=prod node scripts/seed-test-data.js
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Test data constants
const TEST_VENDOR = {
  phone: '+919999999001',
  email: 'test-vendor@warmpawz.com',
  business_name: 'WarmPawz Test Vendor',
  owner_name: 'Test Vendor Owner',
  address: '123 Test Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  business_type: 'business',
  gst_number: '27AAAAA0000A1Z5',
  pan_number: 'AAAAA0000A',
  fulfillment_type: 'warmpawz',
};

const TEST_CUSTOMER = {
  phone: '+919999999002',
  email: 'test-customer@warmpawz.com',
  full_name: 'Test Customer',
  address: '456 Customer Road',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560001',
};

const TEST_PRODUCTS = [
  {
    name: 'Premium Dog Food',
    description: 'High-quality grain-free dog food with real chicken',
    category: 'Pet Food',
    sku: 'TEST-SKU-001',
    price: 599,
    compare_at_price: 699,
    stock_quantity: 100,
    hsn_code: '2309',
    gst_rate: 18,
    is_active: true,
  },
  {
    name: 'Cat Scratching Post',
    description: 'Durable sisal rope scratching post for cats',
    category: 'Pet Accessories',
    sku: 'TEST-SKU-002',
    price: 1299,
    compare_at_price: 1499,
    stock_quantity: 50,
    hsn_code: '9403',
    gst_rate: 18,
    is_active: true,
  },
  {
    name: 'Pet Bed Deluxe',
    description: 'Comfortable orthopedic pet bed for dogs and cats',
    category: 'Pet Furniture',
    sku: 'TEST-SKU-003',
    price: 1999,
    compare_at_price: 2499,
    stock_quantity: 30,
    hsn_code: '9404',
    gst_rate: 18,
    is_active: true,
  },
];

async function getDbCredentials() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');

  let endpoint, port, dbName, username;

  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    if (!endpoint || endpoint === 'None' || endpoint === 'null') {
      throw new Error(`RDS cluster not found: ${clusterId}`);
    }

    port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';
  } catch (error) {
    console.error('❌ ERROR: Could not get RDS cluster info');
    console.error(error.message);
    throw error;
  }

  console.log('✅ RDS Cluster found:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);

  // Get password from Secrets Manager
  console.log('🔐 Getting database credentials from Secrets Manager...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

  let password;
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password || secret.secret || secret.Secret;

    if (!password) {
      throw new Error('Password not found in secret');
    }
    console.log('✅ Credentials retrieved');
  } catch (error) {
    console.error('❌ ERROR: Error fetching RDS credentials:', error.message);
    throw error;
  }

  return { endpoint, port, dbName, username, password };
}

async function seedTestData() {
  console.log('');
  console.log('━'.repeat(60));
  console.log('🌱 TEST DATA SEEDING SCRIPT');
  console.log('━'.repeat(60));
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  const { endpoint, port, dbName, username, password } = await getDbCredentials();

  const pool = new Pool({
    user: username,
    host: endpoint,
    database: dbName,
    password: password,
    port: parseInt(port, 10),
    ssl: {
      rejectUnauthorized: false,
    },
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Start transaction
    await client.query('BEGIN');

    // 1. Seed Vendor
    console.log('\n📦 Seeding test vendor...');
    let vendorId;
    const existingVendor = await client.query(
      'SELECT id FROM vendors WHERE phone = $1',
      [TEST_VENDOR.phone]
    );
    
    if (existingVendor.rows.length > 0) {
      vendorId = existingVendor.rows[0].id;
      console.log(`   Vendor already exists: ${vendorId}`);
    } else {
      const vendorResult = await client.query(`
        INSERT INTO vendors (
          phone, email, business_name, owner_name, address, city, state, pincode,
          business_type, gst_number, pan_number, fulfillment_type, onboarding_status, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVATED', true)
        RETURNING id
      `, [
        TEST_VENDOR.phone, TEST_VENDOR.email, TEST_VENDOR.business_name,
        TEST_VENDOR.owner_name, TEST_VENDOR.address, TEST_VENDOR.city,
        TEST_VENDOR.state, TEST_VENDOR.pincode, TEST_VENDOR.business_type,
        TEST_VENDOR.gst_number, TEST_VENDOR.pan_number, TEST_VENDOR.fulfillment_type
      ]);
      vendorId = vendorResult.rows[0].id;
      console.log(`   Created vendor: ${vendorId}`);
    }

    // 2. Seed Customer
    console.log('\n👤 Seeding test customer...');
    let customerId;
    const existingCustomer = await client.query(
      'SELECT id FROM customers WHERE phone = $1',
      [TEST_CUSTOMER.phone]
    );
    
    if (existingCustomer.rows.length > 0) {
      customerId = existingCustomer.rows[0].id;
      console.log(`   Customer already exists: ${customerId}`);
    } else {
      const customerResult = await client.query(`
        INSERT INTO customers (phone, email, full_name, address, city, state, pincode)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        TEST_CUSTOMER.phone, TEST_CUSTOMER.email, TEST_CUSTOMER.full_name,
        TEST_CUSTOMER.address, TEST_CUSTOMER.city, TEST_CUSTOMER.state, TEST_CUSTOMER.pincode
      ]);
      customerId = customerResult.rows[0].id;
      console.log(`   Created customer: ${customerId}`);
    }

    // 3. Seed Products
    console.log('\n🛍️ Seeding test products...');
    const productIds = [];
    for (const product of TEST_PRODUCTS) {
      const existingProduct = await client.query(
        'SELECT id FROM products WHERE sku = $1',
        [product.sku]
      );
      
      if (existingProduct.rows.length > 0) {
        productIds.push(existingProduct.rows[0].id);
        console.log(`   Product already exists: ${product.name} (${existingProduct.rows[0].id})`);
      } else {
        const productResult = await client.query(`
          INSERT INTO products (
            vendor_id, name, description, category, sku, price, compare_at_price,
            stock_quantity, hsn_code, gst_rate, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          vendorId, product.name, product.description, product.category,
          product.sku, product.price, product.compare_at_price,
          product.stock_quantity, product.hsn_code, product.gst_rate, product.is_active
        ]);
        productIds.push(productResult.rows[0].id);
        console.log(`   Created product: ${product.name} (${productResult.rows[0].id})`);
      }
    }

    // 4. Seed E-commerce seller role if not exists
    console.log('\n👔 Checking roles...');
    const roleResult = await client.query(
      `SELECT id FROM roles WHERE name = 'ecommerce_seller'`
    );
    if (roleResult.rows.length === 0) {
      await client.query(`
        INSERT INTO roles (name, display_name, description, is_active, config)
        VALUES ('ecommerce_seller', 'E-Commerce Seller', 'Vendor who sells products online', true, 
                '{"vendorTypes": ["solo", "business"], "capabilities": ["products:manage", "orders:manage", "analytics:view"]}'::jsonb)
      `);
      console.log('   Created e-commerce seller role');
    } else {
      console.log('   E-commerce seller role already exists');
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Test data seeded successfully!');

    // Output IDs for tests
    console.log('\n━'.repeat(60));
    console.log('📝 TEST DATA IDs (use these in E2E tests):');
    console.log('━'.repeat(60));
    console.log(`VENDOR_ID=${vendorId}`);
    console.log(`CUSTOMER_ID=${customerId}`);
    console.log(`PRODUCT_IDS=${productIds.join(',')}`);
    console.log('━'.repeat(60));

    // Write to .env file for tests
    const envContent = `
# Test Data IDs (generated by seed-test-data.js)
TEST_VENDOR_ID=${vendorId}
TEST_CUSTOMER_ID=${customerId}
TEST_PRODUCT_IDS=${productIds.join(',')}
TEST_VENDOR_PHONE=${TEST_VENDOR.phone}
TEST_CUSTOMER_PHONE=${TEST_CUSTOMER.phone}
`;

    require('fs').writeFileSync(
      require('path').join(__dirname, '..', 'tests', 'playwright', '.env.test'),
      envContent.trim()
    );
    console.log('\n📄 Written to tests/playwright/.env.test');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('\n❌ Error seeding test data:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

seedTestData().catch(err => {
  console.error(err);
  process.exit(1);
});
