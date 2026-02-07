#!/usr/bin/env node
/**
 * Check current database schema
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function checkSchema() {
  console.log('🔍 Checking Database Schema...');
  console.log('========================================');
  
  // Get RDS cluster info
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  
  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';
  
  const dbName = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';
  
  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';
  
  // Get password from Secrets Manager
  const secretsClient = new SecretsManagerClient({ region: REGION });
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;
  
  // Connect to database
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  // Check existing tables
  console.log('\n📋 Checking existing tables...\n');
  
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('Existing tables:');
  tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
  
  // Check vendors columns
  console.log('\n📋 Checking vendors table columns...\n');
  const vendorCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    ORDER BY column_name
  `);
  console.log('Vendors columns:');
  vendorCols.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
  
  // Check bookings columns
  console.log('\n📋 Checking bookings table columns...\n');
  const bookingCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    ORDER BY column_name
  `);
  console.log('Bookings columns:');
  bookingCols.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
  
  // Check staff table
  console.log('\n📋 Checking if staff table exists...\n');
  const staffCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'staff'
    )
  `);
  console.log(`Staff table exists: ${staffCheck.rows[0].exists}`);
  
  if (staffCheck.rows[0].exists) {
    const staffCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'staff' 
      ORDER BY column_name
    `);
    console.log('Staff columns:');
    staffCols.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
  }
  
  await pool.end();
  console.log('\n✅ Schema check complete!');
}

checkSchema().catch(console.error);
