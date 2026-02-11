#!/usr/bin/env node
/**
 * Check what's actually saved in vendor_availability_v2 for a specific vendor
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const VENDOR_ID = process.argv[2] || '5c673742-7cda-4c1b-ac62-7e8e6221c6a2';

async function checkAvailability() {
  try {
    // Get RDS cluster info
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    
    if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
      console.error(`❌ RDS cluster not found: ${clusterId}`);
      process.exit(1);
    }
    
    const cluster = clusterInfo.DBClusters[0];
    const endpoint = cluster.Endpoint;
    const port = cluster.Port || '5432';
    const dbName = cluster.DatabaseName || 'warmpawz';
    
    // Get credentials
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretResponse = await secretsClient.send(new GetSecretValueCommand({
      SecretId: `warmpawz-${ENVIRONMENT}-db-credentials`
    }));
    const credentials = JSON.parse(secretResponse.SecretString);
    
    // Connect to database
    const pool = new Pool({
      host: endpoint,
      port: parseInt(port),
      database: dbName,
      user: credentials.username || 'warmpawz_admin',
      password: credentials.password,
      ssl: { rejectUnauthorized: false }
    });
    
    console.log(`\n🔍 Checking availability for vendor: ${VENDOR_ID}\n`);
    
    // Check what columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vendor_availability_v2'
      ORDER BY column_name
    `);
    console.log('📋 Available columns in vendor_availability_v2:');
    columnsCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Get all availability records for this vendor
    const result = await pool.query(`
      SELECT 
        id, 
        vendor_id::text, 
        day_of_week, 
        service_styles, 
        service_type,
        is_available, 
        is_enabled,
        time_window_start, 
        time_window_end,
        start_time,
        end_time
      FROM vendor_availability_v2 
      WHERE vendor_id::text = $1
      ORDER BY day_of_week, COALESCE(time_window_start, start_time)
    `, [VENDOR_ID]);
    
    console.log(`\n📊 Found ${result.rows.length} availability records:\n`);
    result.rows.forEach((r, i) => {
      console.log(`${i+1}. id=${r.id}`);
      console.log(`   day_of_week=${r.day_of_week}`);
      console.log(`   service_styles=${JSON.stringify(r.service_styles)}`);
      console.log(`   service_type=${r.service_type || 'NULL'}`);
      console.log(`   is_available=${r.is_available}`);
      console.log(`   is_enabled=${r.is_enabled || 'NULL'}`);
      console.log(`   time_window_start=${r.time_window_start || 'NULL'}`);
      console.log(`   time_window_end=${r.time_window_end || 'NULL'}`);
      console.log(`   start_time=${r.start_time || 'NULL'}`);
      console.log(`   end_time=${r.end_time || 'NULL'}`);
      console.log('');
    });
    
    // Check vendor status
    const vendorCheck = await pool.query(`
      SELECT id::text, business_name, phone, status, is_active, is_online
      FROM vendors
      WHERE id::text = $1
    `, [VENDOR_ID]);
    
    if (vendorCheck.rows.length > 0) {
      const vendor = vendorCheck.rows[0];
      console.log('👤 Vendor status:');
      console.log(`   id=${vendor.id}`);
      console.log(`   business_name=${vendor.business_name}`);
      console.log(`   phone=${vendor.phone}`);
      console.log(`   status=${vendor.status}`);
      console.log(`   is_active=${vendor.is_active}`);
      console.log(`   is_online=${vendor.is_online}`);
    } else {
      console.log(`⚠️  Vendor ${VENDOR_ID} not found in vendors table`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAvailability();
