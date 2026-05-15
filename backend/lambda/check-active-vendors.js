const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env.local') });

// Database connection configuration (same pattern as update-vendor-status.js)
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
    password: process.env.DB_PASSWORD || '',
  };

  // Add SSL config for RDS
  if (config.host.includes('rds.amazonaws.com')) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
};

const pool = new Pool(getDbConfig());

async function checkActiveVendors() {
  console.log('🔍 Checking Active Vendors in Database');
  console.log('=====================================\n');

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    // Get all vendors (excluding soft-deleted)
    const allVendorsResult = await client.query(`
      SELECT 
        id, 
        business_name, 
        owner_name,
        status, 
        is_active, 
        is_deleted,
        created_at,
        updated_at
      FROM vendors 
      WHERE (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
      ORDER BY created_at DESC
    `);

    const allVendors = allVendorsResult.rows;
    console.log(`📊 Total vendors (not deleted): ${allVendors.length}\n`);

    console.log('📋 All Vendors:');
    console.log('─'.repeat(100));
    allVendors.forEach((v, idx) => {
      const isActive = v.is_active === true || v.is_active === 't' || v.is_active === 1;
      const status = v.status;
      const isActiveVendor = status === 'approved' && isActive;
      const marker = isActiveVendor ? '✅' : '❌';
      console.log(`${marker} ${idx + 1}. ${v.business_name || v.owner_name || 'N/A'}`);
      console.log(`   ID: ${v.id.substring(0, 8)}...`);
      console.log(`   Status: ${status}`);
      console.log(`   is_active: ${v.is_active} (type: ${typeof v.is_active})`);
      console.log(`   is_deleted: ${v.is_deleted}`);
      console.log(`   Created: ${v.created_at}`);
      console.log('');
    });

    // Filter active vendors (matching endpoint logic)
    const activeVendors = allVendors.filter(v => {
      const isActive = v.is_active === true || v.is_active === 't' || v.is_active === 1;
      return v.status === 'approved' && isActive;
    });

    console.log(`\n✅ Active Vendors (status='approved' AND is_active=true): ${activeVendors.length}`);
    console.log('─'.repeat(100));
    activeVendors.forEach((v, idx) => {
      console.log(`${idx + 1}. ${v.business_name || v.owner_name || 'N/A'}`);
      console.log(`   ID: ${v.id}`);
      console.log(`   Status: ${v.status}`);
      console.log(`   is_active: ${v.is_active}`);
      console.log('');
    });

    // Check for edge cases
    const approvedButInactive = allVendors.filter(v => {
      const isActive = v.is_active === true || v.is_active === 't' || v.is_active === 1;
      return v.status === 'approved' && !isActive;
    });

    if (approvedButInactive.length > 0) {
      console.log(`\n⚠️  Approved but NOT active (status='approved' BUT is_active=false/null): ${approvedButInactive.length}`);
      console.log('─'.repeat(100));
      approvedButInactive.forEach((v, idx) => {
        console.log(`${idx + 1}. ${v.business_name || v.owner_name || 'N/A'}`);
        console.log(`   ID: ${v.id}`);
        console.log(`   Status: ${v.status}`);
        console.log(`   is_active: ${v.is_active} (type: ${typeof v.is_active})`);
        console.log('');
      });
    }

    // Check for pending vendors that might be considered "active" by user
    const pendingVendors = allVendors.filter(v => v.status === 'pending');
    if (pendingVendors.length > 0) {
      console.log(`\n📝 Pending Vendors: ${pendingVendors.length}`);
      console.log('─'.repeat(100));
      pendingVendors.forEach((v, idx) => {
        console.log(`${idx + 1}. ${v.business_name || v.owner_name || 'N/A'}`);
        console.log(`   ID: ${v.id}`);
        console.log(`   Status: ${v.status}`);
        console.log(`   is_active: ${v.is_active}`);
        console.log('');
      });
    }

    client.release();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    console.log('\n✨ Done!');
  }
}

checkActiveVendors();
