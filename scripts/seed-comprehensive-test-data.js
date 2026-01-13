#!/usr/bin/env node
/**
 * ============================================================================
 * COMPREHENSIVE TEST DATA SEEDING SCRIPT
 * ============================================================================
 * Seeds all necessary test data for 100% test coverage
 * ============================================================================
 */

const crypto = require('crypto');
const path = require('path');

// Try to load pg from db/node_modules first, then global
let Pool;
try {
  // Try local db/node_modules
  Pool = require(path.join(__dirname, '..', 'db', 'node_modules', 'pg')).Pool;
} catch (e) {
  try {
    // Try root node_modules
    Pool = require('pg').Pool;
  } catch (e2) {
    console.error('❌ pg module not found. Installing...');
    console.error('Please run: cd db && npm install pg');
    process.exit(1);
  }
}

// Database connection - use DATABASE_URL if available, otherwise construct from env vars
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else if (process.env.DB_HOST || process.env.RDS_HOSTNAME) {
  // Use RDS connection details
  pool = new Pool({
    host: process.env.DB_HOST || process.env.RDS_HOSTNAME,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || process.env.RDS_DB_NAME || 'warmpawz',
    user: process.env.DB_USER || process.env.RDS_USERNAME,
    password: process.env.DB_PASSWORD || process.env.RDS_PASSWORD,
  });
} else {
  console.error('❌ Database connection details not found.');
  console.error('Please set one of:');
  console.error('  - DATABASE_URL (full connection string)');
  console.error('  - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
  console.error('  - RDS_HOSTNAME, RDS_PORT, RDS_DB_NAME, RDS_USERNAME, RDS_PASSWORD');
  process.exit(1);
}

// Test data IDs (will be generated and stored)
const testData = {
  customerId: null,
  vendorId: null,
  serviceId: null,
  bookingId: null,
  orderId: null,
  paymentId: null,
  roleId: null,
};

function generateUUID() {
  return crypto.randomUUID();
}

async function seedRoles() {
  console.log('📋 Seeding roles...');
  
  const roles = [
    { name: 'veterinarian', display_name: 'Veterinarian', is_active: true },
    { name: 'groomer', display_name: 'Groomer', is_active: true },
    { name: 'trainer', display_name: 'Trainer', is_active: true },
  ];

  for (const role of roles) {
    const result = await pool.query(
      `INSERT INTO roles (id, name, display_name, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET display_name = $2, is_active = $3
       RETURNING id`,
      [role.name, role.display_name, role.is_active]
    );
    
    if (role.name === 'veterinarian' && result.rows[0]) {
      testData.roleId = result.rows[0].id;
    }
  }
  
  console.log('✅ Roles seeded');
}

async function seedCustomers() {
  console.log('👤 Seeding customers...');
  
  // First, try to get existing customer by phone
  const existingCustomer = await pool.query(
    `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
    ['9999999999']
  );
  
  let customerId;
  if (existingCustomer.rows.length > 0) {
    customerId = existingCustomer.rows[0].id;
    console.log('   Using existing customer:', customerId);
  } else {
    customerId = generateUUID();
    await pool.query(
      `INSERT INTO customers (id, phone, full_name, email, city, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        customerId,
        '9999999999',
        'Test Customer',
        'test@warmpawz.com',
        'Mumbai',
        true,
      ]
    );
    console.log('   Created new customer:', customerId);
  }
  
  testData.customerId = customerId;
  
  // Create wallet (check if currency column exists)
  const walletCheck = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'customer_wallets' AND column_name = 'currency'`
  );
  const hasCurrency = walletCheck.rows.length > 0;
  
  if (hasCurrency) {
    await pool.query(
      `INSERT INTO customer_wallets (customer_id, balance, currency, created_at, updated_at)
       VALUES ($1, 1000.00, 'INR', NOW(), NOW())
       ON CONFLICT (customer_id) DO UPDATE SET balance = 1000.00`,
      [customerId]
    );
  } else {
    await pool.query(
      `INSERT INTO customer_wallets (customer_id, balance, created_at, updated_at)
       VALUES ($1, 1000.00, NOW(), NOW())
       ON CONFLICT (customer_id) DO UPDATE SET balance = 1000.00`,
      [customerId]
    );
  }
  
  // Create wallet transaction (check schema - might use wallet_id or customer_id)
  const walletTxnCheck = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'wallet_transactions' AND column_name IN ('customer_id', 'wallet_id')`
  );
  
  const hasCustomerId = walletTxnCheck.rows.some(r => r.column_name === 'customer_id');
  const hasWalletId = walletTxnCheck.rows.some(r => r.column_name === 'wallet_id');
  
  if (hasCustomerId) {
    const existingTxn = await pool.query(
      `SELECT id FROM wallet_transactions 
       WHERE customer_id = $1 AND transaction_type = 'credit' AND amount = 1000.00 
       LIMIT 1`,
      [customerId]
    );
    
    if (existingTxn.rows.length === 0) {
      await pool.query(
        `INSERT INTO wallet_transactions (id, customer_id, transaction_type, amount, balance_after, description, created_at)
         VALUES (gen_random_uuid(), $1, 'credit', 1000.00, 1000.00, 'Initial credit', NOW())`,
        [customerId]
      );
    }
  } else if (hasWalletId) {
    // Get wallet ID
    const wallet = await pool.query(
      `SELECT id FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
      [customerId]
    );
    
    if (wallet.rows.length > 0) {
      const walletId = wallet.rows[0].id;
      const existingTxn = await pool.query(
        `SELECT id FROM wallet_transactions 
         WHERE wallet_id = $1 AND transaction_type = 'credit' AND amount = 1000.00 
         LIMIT 1`,
        [walletId]
      );
      
      if (existingTxn.rows.length === 0) {
        await pool.query(
          `INSERT INTO wallet_transactions (id, wallet_id, transaction_type, amount, balance_after, description, created_at)
           VALUES (gen_random_uuid(), $1, 'credit', 1000.00, 1000.00, 'Initial credit', NOW())`,
          [walletId]
        );
      }
    }
  }
  
  console.log('✅ Customers seeded');
}

async function seedVendors() {
  console.log('🏪 Seeding vendors...');
  
  // Get veterinarian role
  const roleResult = await pool.query(
    `SELECT id FROM roles WHERE name = 'veterinarian' LIMIT 1`
  );
  const roleId = roleResult.rows[0]?.id || testData.roleId;
  
  // Get existing vendor by phone or create new
  const existingVendor = await pool.query(
    `SELECT id FROM vendors WHERE phone = $1 LIMIT 1`,
    ['8888888888']
  );
  
  let vendorId;
  if (existingVendor.rows.length > 0) {
    vendorId = existingVendor.rows[0].id;
    console.log('   Using existing vendor:', vendorId);
  } else {
    vendorId = generateUUID();
    await pool.query(
      `INSERT INTO vendors (id, business_name, phone, email, role_id, status, is_active, city, owner_name, address, state, pincode, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        vendorId,
        'Test Veterinary Clinic',
        '8888888888',
        'vendor@warmpawz.com',
        roleId,
        'approved',
        true,
        'Mumbai',
        'Test Owner',
        '123 Test Street, Mumbai',
        'Maharashtra',
        '400001',
      ]
    );
    console.log('   Created new vendor:', vendorId);
  }
  
  testData.vendorId = vendorId;
  
  console.log('✅ Vendors seeded');
}

async function seedServices() {
  console.log('🔧 Seeding services...');
  
  // Check services table schema
  const serviceColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'services' AND column_name IN ('category_id', 'category', 'service_category')`
  );
  
  const hasCategoryId = serviceColumns.rows.some(r => r.column_name === 'category_id');
  const hasCategory = serviceColumns.rows.some(r => r.column_name === 'category');
  
  // Get existing service or create new
  const existingService = await pool.query(
    `SELECT id FROM services WHERE name = 'General Consultation' LIMIT 1`
  );
  
  let serviceId;
  if (existingService.rows.length > 0) {
    serviceId = existingService.rows[0].id;
    console.log('   Using existing service:', serviceId);
  } else {
    serviceId = generateUUID();
    
    if (hasCategoryId) {
      const categoryResult = await pool.query(
        `SELECT category_id FROM service_categories LIMIT 1`
      );
      const categoryId = categoryResult.rows[0]?.category_id || 'veterinary';
      
      await pool.query(
        `INSERT INTO services (id, name, description, category_id, price, duration_minutes, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [serviceId, 'General Consultation', 'General veterinary consultation', categoryId, 500.00, 30, true]
      );
    } else if (hasCategory) {
      await pool.query(
        `INSERT INTO services (id, name, description, category, price, duration_minutes, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [serviceId, 'General Consultation', 'General veterinary consultation', 'veterinary', 500.00, 30, true]
      );
    } else {
      await pool.query(
        `INSERT INTO services (id, name, description, price, duration_minutes, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [serviceId, 'General Consultation', 'General veterinary consultation', 500.00, 30, true]
      );
    }
    console.log('   Created new service:', serviceId);
  }
  
  testData.serviceId = serviceId;
  
  // Link service to vendor (check schema)
  const vendorServiceColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'vendor_services'`
  );
  const columnNames = vendorServiceColumns.rows.map(r => r.column_name);
  const hasServiceName = columnNames.includes('service_name');
  const hasServiceStyle = columnNames.includes('service_style');
  const hasIsEnabled = columnNames.includes('is_enabled');
  
  const existingVendorService = await pool.query(
    `SELECT id FROM vendor_services WHERE vendor_id = $1 AND service_id = $2 LIMIT 1`,
    [testData.vendorId, serviceId]
  );
  
  if (existingVendorService.rows.length === 0) {
    if (hasServiceName && hasServiceStyle) {
      // New schema with service_name and service_style
      await pool.query(
        `INSERT INTO vendor_services (id, vendor_id, service_id, service_name, price, duration_minutes, service_style, is_enabled, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [testData.vendorId, serviceId, 'General Consultation', 500.00, 30, 'at_center', true]
      );
    } else {
      // Old schema
      const insertCols = ['id', 'vendor_id', 'service_id', 'price'];
      const insertVals = [testData.vendorId, serviceId, 500.00];
      
      if (hasIsEnabled) {
        insertCols.push('is_enabled');
        insertVals.push(true);
      }
      
      insertCols.push('created_at', 'updated_at');
      insertVals.push('NOW()', 'NOW()');
      
      const placeholders = insertVals.map((_, i) => i < insertVals.length - 2 ? `$${i + 1}` : 'NOW()').join(', ');
      await pool.query(
        `INSERT INTO vendor_services (${insertCols.join(', ')})
         VALUES (gen_random_uuid(), ${placeholders})`,
        insertVals.slice(0, -2)
      );
    }
  }
  
  console.log('✅ Services seeded');
}

async function seedBookings() {
  console.log('📅 Seeding bookings...');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookingDate = tomorrow.toISOString().split('T')[0];
  const bookingTime = '10:00';
  
  // Check bookings table schema
  const bookingColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'bookings' AND column_name IN ('service_style', 'service_type')`
  );
  const hasServiceStyle = bookingColumns.rows.some(r => r.column_name === 'service_style');
  const hasServiceType = bookingColumns.rows.some(r => r.column_name === 'service_type');
  
  // Get existing booking or create new
  const existingBooking = await pool.query(
    `SELECT id FROM bookings 
     WHERE customer_id = $1 AND vendor_id = $2 AND booking_date = $3 AND booking_time = $4 
     LIMIT 1`,
    [testData.customerId, testData.vendorId, bookingDate, bookingTime]
  );
  
  let bookingId;
  if (existingBooking.rows.length > 0) {
    bookingId = existingBooking.rows[0].id;
    console.log('   Using existing booking:', bookingId);
  } else {
    bookingId = generateUUID();
    
    // Check if base_price is required
    const bookingRequiredCols = await pool.query(
      `SELECT column_name, is_nullable FROM information_schema.columns 
       WHERE table_name = 'bookings' AND column_name IN ('base_price', 'service_style', 'service_type')`
    );
    const needsBasePrice = bookingRequiredCols.rows.some(r => r.column_name === 'base_price' && r.is_nullable === 'NO');
    
    if (hasServiceStyle) {
      const cols = ['id', 'customer_id', 'vendor_id', 'service_id', 'booking_date', 'booking_time', 'status', 'total_amount', 'service_style'];
      const vals = [bookingId, testData.customerId, testData.vendorId, testData.serviceId, bookingDate, bookingTime, 'confirmed', 500.00, 'at_center'];
      
      if (needsBasePrice) {
        cols.splice(cols.length - 1, 0, 'base_price'); // Insert before service_style
        vals.splice(vals.length - 1, 0, 500.00);
      }
      
      await pool.query(
        `INSERT INTO bookings (${cols.join(', ')}, created_at, updated_at)
         VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())`,
        vals
      );
    } else if (hasServiceType) {
      // Query the actual constraint to get allowed values
      const constraintResult = await pool.query(
        `SELECT pg_get_constraintdef(oid) as def
         FROM pg_constraint 
         WHERE conrelid = 'bookings'::regclass 
         AND conname = 'bookings_service_type_check'
         LIMIT 1`
      );
      
      let serviceTypeValue = 'at_vendor'; // Default
      if (constraintResult.rows.length > 0) {
        const constraintDef = constraintResult.rows[0].def || '';
        console.log('   Service type constraint:', constraintDef);
        // Extract allowed values - constraint format: CHECK (service_type IN ('at_vendor', 'at_home', 'online'))
        if (constraintDef.includes("'at_vendor'")) {
          serviceTypeValue = 'at_vendor';
        } else if (constraintDef.includes("'at_home'")) {
          serviceTypeValue = 'at_home';
        } else if (constraintDef.includes("'online'")) {
          serviceTypeValue = 'online';
        } else if (constraintDef.includes("'at_center'")) {
          serviceTypeValue = 'at_center';
        }
      }
      
      const cols = ['id', 'customer_id', 'vendor_id', 'service_id', 'booking_date', 'booking_time', 'status', 'total_amount'];
      const vals = [bookingId, testData.customerId, testData.vendorId, testData.serviceId, bookingDate, bookingTime, 'confirmed', 500.00];
      
      if (needsBasePrice) {
        cols.push('base_price');
        vals.push(500.00);
      }
      
      cols.push('service_type');
      vals.push(serviceTypeValue);
      
      console.log(`   Using service_type: ${serviceTypeValue}`);
      
      await pool.query(
        `INSERT INTO bookings (${cols.join(', ')}, created_at, updated_at)
         VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())`,
        vals
      );
    } else {
      const cols = ['id', 'customer_id', 'vendor_id', 'service_id', 'booking_date', 'booking_time', 'status', 'total_amount'];
      const vals = [bookingId, testData.customerId, testData.vendorId, testData.serviceId, bookingDate, bookingTime, 'confirmed', 500.00];
      
      if (needsBasePrice) {
        cols.push('base_price');
        vals.push(500.00);
      }
      
      await pool.query(
        `INSERT INTO bookings (${cols.join(', ')}, created_at, updated_at)
         VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())`,
        vals
      );
    }
    console.log('   Created new booking:', bookingId);
  }
  
  testData.bookingId = bookingId;
  
  console.log('✅ Bookings seeded');
}

async function seedOrders() {
  console.log('🛒 Seeding orders...');
  
  // Check required fields
  const orderColumns = await pool.query(
    `SELECT column_name, is_nullable FROM information_schema.columns 
     WHERE table_name = 'orders' AND column_name IN ('order_number', 'subtotal', 'shipping_address', 'shipping_city', 'shipping_state', 'shipping_pincode', 'shipping_phone')`
  );
  
  const needsOrderNumber = orderColumns.rows.some(r => r.column_name === 'order_number' && r.is_nullable === 'NO');
  const needsSubtotal = orderColumns.rows.some(r => r.column_name === 'subtotal' && r.is_nullable === 'NO');
  const needsShipping = orderColumns.rows.some(r => r.column_name === 'shipping_address' && r.is_nullable === 'NO');
  
  // Get existing order or create new
  const existingOrder = await pool.query(
    `SELECT id FROM orders WHERE customer_id = $1 LIMIT 1`,
    [testData.customerId]
  );
  
  let orderId;
  if (existingOrder.rows.length > 0) {
    orderId = existingOrder.rows[0].id;
    console.log('   Using existing order:', orderId);
  } else {
    orderId = generateUUID();
    const orderNumber = `ORD-${Date.now()}`;
    
    const cols = ['id', 'customer_id', 'vendor_id', 'order_status', 'total_amount'];
    const vals = [orderId, testData.customerId, testData.vendorId, 'pending', 1000.00];
    
    if (needsOrderNumber) {
      cols.push('order_number');
      vals.push(orderNumber);
    }
    
    if (needsSubtotal) {
      cols.push('subtotal');
      vals.push(1000.00);
    }
    
    if (needsShipping) {
      cols.push('shipping_address', 'shipping_city', 'shipping_state', 'shipping_pincode', 'shipping_phone');
      vals.push('123 Test Street', 'Mumbai', 'Maharashtra', '400001', '9999999999');
    }
    
    await pool.query(
      `INSERT INTO orders (${cols.join(', ')}, created_at, updated_at)
       VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())`,
      vals
    );
    console.log('   Created new order:', orderId);
  }
  
  testData.orderId = orderId;
  
  console.log('✅ Orders seeded');
}

async function seedPayments() {
  console.log('💳 Seeding payments...');
  
  // Check payments table schema
  const paymentColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'payments' AND column_name IN ('status', 'payment_status')`
  );
  const hasStatus = paymentColumns.rows.some(r => r.column_name === 'status');
  const hasPaymentStatus = paymentColumns.rows.some(r => r.column_name === 'payment_status');
  
  // Get existing payment or create new
  const existingPayment = await pool.query(
    `SELECT id FROM payments WHERE booking_id = $1 LIMIT 1`,
    [testData.bookingId]
  );
  
  let paymentId;
  if (existingPayment.rows.length > 0) {
    paymentId = existingPayment.rows[0].id;
    console.log('   Using existing payment:', paymentId);
  } else {
    paymentId = generateUUID();
    
    const cols = ['id', 'customer_id', 'booking_id', 'order_id', 'amount', 'payment_method'];
    const vals = [paymentId, testData.customerId, testData.bookingId, testData.orderId, 500.00, 'razorpay'];
    
    if (hasStatus) {
      cols.push('status');
      vals.push('completed');
    } else if (hasPaymentStatus) {
      cols.push('payment_status');
      vals.push('completed');
    }
    
    await pool.query(
      `INSERT INTO payments (${cols.join(', ')}, created_at, updated_at)
       VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())`,
      vals
    );
    console.log('   Created new payment:', paymentId);
  }
  
  testData.paymentId = paymentId;
  
  console.log('✅ Payments seeded');
}

async function seedServiceCategories() {
  console.log('📂 Seeding service categories...');
  
  const categories = [
    { category_id: 'veterinary', name: 'Veterinary', description: 'Veterinary services' },
    { category_id: 'grooming', name: 'Grooming', description: 'Pet grooming services' },
    { category_id: 'training', name: 'Training', description: 'Pet training services' },
  ];
  
  for (const cat of categories) {
    await pool.query(
      `INSERT INTO service_categories (category_id, name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (category_id) DO UPDATE SET name = $2, description = $3`,
      [cat.category_id, cat.name, cat.description, true]
    );
  }
  
  console.log('✅ Service categories seeded');
}

async function seedRefundRules() {
  console.log('💰 Seeding refund rules...');
  
  // Check if table exists
  const tableExists = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'booking_cancellation_rules'
    )`
  );
  
  if (!tableExists.rows[0]?.exists) {
    console.log('   ⚠️  booking_cancellation_rules table does not exist. Run migration 060_create_refund_rules_tables.sql');
    return;
  }
  
  // Check table columns
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'booking_cancellation_rules'`
  );
  const columnNames = columns.rows.map(r => r.column_name);
  
  if (columnNames.includes('vendor_id') && columnNames.includes('service_id')) {
    await pool.query(
      `INSERT INTO booking_cancellation_rules (vendor_id, service_id, cancellation_cutoff_hours, full_refund_before_hours, partial_refund_before_hours, partial_refund_percentage, created_at, updated_at)
       VALUES (NULL, NULL, 24, 48, 24, 50.00, NOW(), NOW())
       ON CONFLICT (vendor_id, service_id) DO NOTHING`
    );
  }
  
  console.log('✅ Refund rules seeded');
}

async function main() {
  console.log('🌱 Starting comprehensive test data seeding...\n');
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection established\n');
    
    // Seed in order (respecting foreign keys)
    await seedServiceCategories();
    await seedRoles();
    await seedCustomers();
    await seedVendors();
    await seedServices();
    await seedBookings();
    await seedOrders();
    await seedPayments();
    await seedRefundRules();
    
    // Save test data IDs to file
    const fs = require('fs');
    const path = require('path');
    const testDataFile = path.join(__dirname, '..', 'test-data-ids.json');
    fs.writeFileSync(testDataFile, JSON.stringify(testData, null, 2));
    
    console.log('\n✅ All test data seeded successfully!');
    console.log('\n📊 Test Data IDs:');
    console.log(JSON.stringify(testData, null, 2));
    console.log(`\n💾 Saved to: ${testDataFile}`);
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { testData, seedRoles, seedCustomers, seedVendors, seedServices, seedBookings };
