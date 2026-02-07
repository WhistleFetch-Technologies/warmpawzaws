#!/usr/bin/env node
/**
 * Run KYC Verification Schema Migration (504) on AWS RDS
 * Creates vendor_kyc_verifications, vendor_declarations, and kyc_verification_audit_log tables
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 KYC Verification Schema Migration (504) - AWS RDS');
  console.log('=====================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const { execSync } = require('child_process');
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
  } catch (err) {
    console.error('❌ ERROR: Failed to get RDS cluster info:', err.message);
    process.exit(1);
  }

  console.log('✅ RDS Cluster found:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log('');

  // Get password from Secrets Manager
  console.log('🔐 Getting database credentials from Secrets Manager...');
  const secretsClient = new SecretsManagerClient({ region: REGION });

  // Try multiple secret name patterns
  const secretNamePatterns = [
    `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`,
    `warmpawz-${ENVIRONMENT}-rds-master`,
    `warmpawz-rds-${ENVIRONMENT}`,
  ];

  let password = null;
  
  for (const secretName of secretNamePatterns) {
    try {
      const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );
      const secret = JSON.parse(secretValue.SecretString);
      password = secret.password || secret.Password || secret.secret || secret.Secret;
      if (password) {
        console.log(`✅ Credentials retrieved from: ${secretName}`);
        break;
      }
    } catch (err) {
      console.log(`   Trying secret: ${secretName} - not found`);
    }
  }

  if (!password) {
    console.error('❌ ERROR: Could not retrieve database password from Secrets Manager');
    process.exit(1);
  }

  console.log('');

  // Connect to database
  console.log('🔗 Connecting to database...');
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 30000,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Read migration SQL
    const migrationPath = path.join(__dirname, '../db/migrations/504_kyc_verification_schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ ERROR: Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📄 Read migration file: ${migrationPath}`);
    console.log(`   Size: ${migrationSQL.length} bytes`);
    console.log('');

    // Execute migration
    console.log('🔧 Running KYC verification schema migration...');
    console.log('');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty or comment-only statements
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      try {
        await pool.query(statement);
        
        // Extract the operation type for logging
        const opMatch = statement.match(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(TABLE|INDEX|FUNCTION|TRIGGER|TYPE)/i);
        if (opMatch) {
          console.log(`   ✅ ${opMatch[1]} ${opMatch[2]}`);
        }
        successCount++;
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log(`   ⏭️  Skipped (already exists)`);
          skipCount++;
        } else {
          console.error(`   ❌ Error: ${err.message}`);
          errorCount++;
        }
      }
    }

    console.log('');
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    
    const tables = ['vendor_kyc_verifications', 'vendor_declarations', 'kyc_verification_audit_log'];
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`   ✅ Table ${table} exists`);
      } else {
        console.log(`   ❌ Table ${table} NOT found`);
      }
    }

    console.log('');
    console.log('✅ KYC Verification Schema Migration Complete!');
    
    await pool.end();
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
