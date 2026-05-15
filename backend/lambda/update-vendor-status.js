#!/usr/bin/env node
/**
 * Update Vendor Status Script
 * Updates a vendor's status to 'approved' in the local PostgreSQL database
 * 
 * Usage: node update-vendor-status.js <vendorId>
 * Example: node update-vendor-status.js 96cb1237-0690-406b-8817-825107aba628
 */

const { Pool } = require('pg');

// Database connection configuration
const getDbConfig = () => {
  // Try DATABASE_URL first
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  
  // Otherwise use individual components
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'warmpawz',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
  
  // For local connections, no SSL needed
  if (config.host === 'localhost' || config.host === '127.0.0.1') {
    config.ssl = false;
  }
  
  return config;
};

async function updateVendorStatus(vendorId, newStatus = 'approved') {
  const pool = new Pool(getDbConfig());
  
  try {
    console.log('🔗 Connecting to database...');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
    
    // Check if vendor exists
    const checkResult = await pool.query(
      'SELECT id, business_name, owner_name, status FROM vendors WHERE id = $1',
      [vendorId]
    );
    
    if (checkResult.rows.length === 0) {
      console.error(`❌ Vendor not found with ID: ${vendorId}`);
      process.exit(1);
    }
    
    const vendor = checkResult.rows[0];
    console.log(`\n📋 Current vendor info:`);
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Business Name: ${vendor.business_name}`);
    console.log(`   Owner Name: ${vendor.owner_name}`);
    console.log(`   Current Status: ${vendor.status}`);
    
    // Update status
    const updateResult = await pool.query(
      `UPDATE vendors 
       SET status = $1, 
           updated_at = NOW(),
           approved_at = CASE WHEN $1 = 'approved' AND approved_at IS NULL THEN NOW() ELSE approved_at END
       WHERE id = $2
       RETURNING id, status, updated_at, approved_at`,
      [newStatus, vendorId]
    );
    
    if (updateResult.rows.length === 0) {
      console.error('❌ Failed to update vendor status');
      process.exit(1);
    }
    
    const updated = updateResult.rows[0];
    console.log(`\n✅ Successfully updated vendor status!`);
    console.log(`   New Status: ${updated.status}`);
    console.log(`   Updated At: ${updated.updated_at}`);
    if (updated.approved_at) {
      console.log(`   Approved At: ${updated.approved_at}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure PostgreSQL is running and connection details are correct.');
      console.error('   Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD environment variables');
      console.error('   Or set DATABASE_URL=postgresql://user:pass@host:port/db');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Main execution
const vendorId = process.argv[2];
const newStatus = process.argv[3] || 'approved';

if (!vendorId) {
  console.error('❌ Usage: node update-vendor-status.js <vendorId> [newStatus]');
  console.error('   Example: node update-vendor-status.js 96cb1237-0690-406b-8817-825107aba628 approved');
  process.exit(1);
}

console.log('🚀 Update Vendor Status Script');
console.log('================================');
console.log(`📝 Vendor ID: ${vendorId}`);
console.log(`📝 New Status: ${newStatus}`);
console.log('');

updateVendorStatus(vendorId, newStatus)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
