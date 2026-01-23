#!/usr/bin/env node
/**
 * Run Phase 1 Migration: Add Go Live Fields
 * Connects to RDS cluster and runs the migration script
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Phase 1 Migration: Add Go Live Fields - AWS RDS');
  console.log('===================================================');
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
    const migrationFile = path.join(__dirname, '../db/migrations/302_add_go_live_fields.sql');
    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ ERROR: Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    console.log('📄 Running migration: 302_add_go_live_fields.sql');
    console.log('');

    // Execute migration
    try {
      await pool.query(migrationSQL);
      console.log('✅ Migration executed successfully');
      console.log('');

      // Verify migration
      console.log('🔍 Verifying migration...');
      const verifyResult = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'vendors' 
          AND column_name IN ('go_live_at', 'go_live_checklist')
        ORDER BY column_name
      `);

      if (verifyResult.rows.length === 2) {
        console.log('✅ Verification successful:');
        verifyResult.rows.forEach((row) => {
          console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
      } else {
        console.log('⚠️  Warning: Some columns may not have been created');
        console.log(`   Found ${verifyResult.rows.length} columns (expected 2)`);
      }

      console.log('');
      console.log('✅ ✅ ✅ MIGRATION COMPLETE! ✅ ✅ ✅');
    } catch (error) {
      console.error('❌ ERROR executing migration:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

runMigration().catch((error) => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});
