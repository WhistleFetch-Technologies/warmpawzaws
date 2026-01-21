#!/usr/bin/env node
/**
 * Verify home service tables were created
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function verify() {
  console.log('🔍 Verifying Home Service Tables...');
  console.log('========================================');
  
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  
  const dbName = 'warmpawz';
  const username = 'warmpawz_admin';
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;
  
  const pool = new Pool({
    host: endpoint,
    port: 5432,
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  // Check home service tables
  console.log('\n📋 Checking home service tables...\n');
  
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('home_service_sessions', 'vendor_live_locations')
    ORDER BY table_name
  `);
  
  if (tables.rows.length > 0) {
    console.log('✅ Home service tables found:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
  } else {
    console.log('⚠️  Home service tables not found');
  }
  
  // Check new columns in vendors table
  console.log('\n📋 Checking new vendor columns...\n');
  const vendorCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name IN (
      'home_service_enabled', 
      'home_service_operating_hours',
      'current_latitude',
      'current_longitude',
      'location_updated_at',
      'home_booking_settings',
      'service_radius'
    )
    ORDER BY column_name
  `);
  
  if (vendorCols.rows.length > 0) {
    console.log('✅ Vendor home service columns found:');
    vendorCols.rows.forEach(row => console.log(`   - ${row.column_name}: ${row.data_type}`));
  } else {
    console.log('⚠️  No vendor home service columns found');
  }
  
  // Check package purchase columns
  console.log('\n📋 Checking package purchase columns...\n');
  const packageCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'package_purchases' 
    AND column_name IN ('utilization_details', 'next_session_info')
    ORDER BY column_name
  `);
  
  if (packageCols.rows.length > 0) {
    console.log('✅ Package utilization columns found:');
    packageCols.rows.forEach(row => console.log(`   - ${row.column_name}: ${row.data_type}`));
  } else {
    console.log('⚠️  No package utilization columns found');
  }
  
  // Check vendor availability v2 table
  console.log('\n📋 Checking vendor_availability_v2 table...\n');
  const availabilityCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vendor_availability_v2'
    ORDER BY column_name
  `);
  
  if (availabilityCols.rows.length > 0) {
    console.log('✅ vendor_availability_v2 columns:');
    availabilityCols.rows.forEach(row => console.log(`   - ${row.column_name}: ${row.data_type}`));
  } else {
    console.log('⚠️  vendor_availability_v2 table not found');
  }
  
  // Count of vendors
  console.log('\n📊 Database Statistics...\n');
  
  const vendorCount = await pool.query('SELECT COUNT(*) FROM vendors');
  const customerCount = await pool.query('SELECT COUNT(*) FROM customers');
  const bookingsCount = await pool.query('SELECT COUNT(*) FROM bookings');
  const rolesCount = await pool.query('SELECT COUNT(*) FROM roles WHERE is_active = true');
  
  console.log(`   Vendors: ${vendorCount.rows[0].count}`);
  console.log(`   Customers: ${customerCount.rows[0].count}`);
  console.log(`   Bookings: ${bookingsCount.rows[0].count}`);
  console.log(`   Active Roles: ${rolesCount.rows[0].count}`);
  
  await pool.end();
  console.log('\n✅ Verification complete!');
}

verify().catch(console.error);
