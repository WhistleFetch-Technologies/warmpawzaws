#!/usr/bin/env node
/**
 * Execute Migration 088: Add status column to prescriptions table
 * Adds status (draft/published), doctor_name, diagnosis, follow_up_date, follow_up_notes
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.argv[2] || 'dev';
const REGION = process.argv[3] || 'ap-south-1';

async function getRdsEndpoint() {
  try {
    // Try cluster first
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    const clusterOutput = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    if (clusterOutput && clusterOutput !== 'None' && clusterOutput !== 'null') {
      return clusterOutput;
    }
    
    // Try instance
    const instanceId = `warmpawz-${ENVIRONMENT}-db`;
    const instanceOutput = execSync(
      `aws rds describe-db-instances --db-instance-identifier "${instanceId}" --region "${REGION}" --query 'DBInstances[0].Endpoint.Address' --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    if (instanceOutput && instanceOutput !== 'None') {
      return instanceOutput;
    }
    
    throw new Error('RDS endpoint not found');
  } catch (error) {
    throw new Error(`Failed to get RDS endpoint: ${error.message}`);
  }
}

async function getDbCredentials() {
  try {
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master`;
    const secretsOutput = execSync(
      `aws secretsmanager list-secrets --region "${REGION}" --query "SecretList[?starts_with(Name, '${secretName}')].ARN" --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secretArn = secretsOutput.split('\n')[0];
    if (!secretArn || secretArn === 'None') {
      throw new Error('RDS secret not found');
    }
    
    const secretValue = execSync(
      `aws secretsmanager get-secret-value --secret-id "${secretArn}" --region "${REGION}" --query SecretString --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secret = JSON.parse(secretValue);
    return {
      username: secret.username || secret.Username,
      password: secret.password || secret.Password,
      database: secret.dbname || secret.database || `warmpawz_${ENVIRONMENT}`
    };
  } catch (error) {
    throw new Error(`Failed to get DB credentials: ${error.message}`);
  }
}

async function executeMigration() {
  console.log('🔄 Executing Migration 088: Prescription Status Column');
  console.log('============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');
  
  try {
    // Get RDS endpoint
    console.log('📊 Getting database connection from AWS...');
    const endpoint = await getRdsEndpoint();
    console.log(`✅ RDS Endpoint: ${endpoint}`);
    
    // Get credentials
    const credentials = await getDbCredentials();
    console.log(`✅ Database: ${credentials.database}`);
    console.log(`✅ User: ${credentials.username}`);
    console.log('');
    
    // Read migration file
    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '088_add_prescription_status.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`📄 Migration file: ${migrationFile}`);
    console.log('');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    const client = new Client({
      host: endpoint,
      port: 5432,
      user: credentials.username,
      password: credentials.password,
      database: credentials.database,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');
    
    // Check if prescriptions table exists
    console.log('🔍 Checking if prescriptions table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'prescriptions'
      ) as exists
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Prescriptions table does not exist, skipping migration');
      await client.end();
      return;
    }
    
    console.log('✅ Prescriptions table exists');
    console.log('');
    
    // Execute migration
    console.log('🚀 Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully');
    console.log('');
    
    // Verify columns were added
    console.log('🔍 Verifying columns were added...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'prescriptions'
      AND column_name IN ('status', 'doctor_name', 'diagnosis', 'follow_up_date', 'follow_up_notes')
      ORDER BY column_name;
    `);
    
    console.log(`✅ Found ${result.rows.length} columns:`);
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });
    
    // Check for any draft prescriptions
    const statusCheck = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM prescriptions 
      GROUP BY status
    `);
    
    console.log('');
    console.log('📊 Prescription status summary:');
    statusCheck.rows.forEach(row => {
      console.log(`   - ${row.status || 'null'}: ${row.count} prescriptions`);
    });
    
    await client.end();
    console.log('');
    console.log('🎉 Migration 088 completed successfully!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run migration
executeMigration();
