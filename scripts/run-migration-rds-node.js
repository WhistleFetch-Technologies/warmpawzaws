#!/usr/bin/env node
/**
 * Run Admin Endpoints Migration on AWS RDS using Node.js
 * Connects to RDS cluster and runs the migration script
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Admin Endpoints Migration - AWS RDS');
  console.log('========================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();

  if (!endpoint || endpoint === 'None' || endpoint === 'null') {
    console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
    process.exit(1);
  }

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

  console.log('✅ RDS Cluster found:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log('');

  // Get password from Secrets Manager
  console.log('🔐 Getting database credentials from Secrets Manager...');
  const secretsClient = new SecretsManagerClient({ region: REGION });

  // Try to find the secret
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password || secret.secret || secret.Secret;

    if (!password) {
      console.error('❌ ERROR: Password not found in secret');
      process.exit(1);
    }

    console.log('✅ Credentials retrieved');
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
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Read migration file
    console.log('⚙️  Running migration...');
    console.log('─────────────────────────');
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '053_admin_endpoints_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(sql);
    console.log('✅ Migration completed!');
    console.log('');

    // Verify tables
    console.log('🔍 Verifying created tables...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'support_tickets', 
        'chat_sessions', 
        'transactions', 
        'vendor_payment_rules', 
        'vendor_refund_tiers',
        'vendor_support_requests',
        'compliance_issues'
      )
      ORDER BY table_name
    `);

    if (result.rows.length > 0) {
      console.log('✅ Created tables:');
      result.rows.forEach(row => console.log(`   - ${row.table_name}`));
    } else {
      console.log('⚠️  No tables found (may already exist or migration had issues)');
    }

    await pool.end();
    console.log('');
    console.log('🎉 Migration and verification complete!');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('');
      console.log('ℹ️  Note: Some objects may already exist from a previous run.');
      console.log('   This is typically safe to ignore if using IF NOT EXISTS.');
    }
    
    process.exit(1);
  }
}

runMigration();
