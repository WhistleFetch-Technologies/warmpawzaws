#!/usr/bin/env node

/**
 * ============================================================================
 * Run Migration 504: Add category column to diagnostic_tests (AWS RDS)
 * ============================================================================
 *
 * Fixes: column "category" of relation "diagnostic_tests" does not exist
 * Migration 057 created table with test_category; 021 uses category.
 * This adds category and syncs from test_category for compatibility.
 *
 * Usage:
 *   node scripts/run-migration-504-diagnostic-tests.js
 *   ENVIRONMENT=dev node scripts/run-migration-504-diagnostic-tests.js
 *
 * Environment:
 *   ENVIRONMENT - dev | staging | prod (default: dev)
 *   AWS_REGION  - ap-south-1 (default)
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('');
  console.log('=========================================');
  console.log('Migration 504: Add category to diagnostic_tests');
  console.log('=========================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  let endpoint, port, dbName, username;

  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    if (!endpoint || endpoint === 'None' || endpoint === 'null') {
      console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
      process.exit(1);
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
  } catch (error) {
    console.error(`❌ ERROR: Failed to get RDS cluster info: ${error.message}`);
    console.log('');
    console.log('💡 Tip: Ensure AWS CLI is configured and you have RDS describe permissions');
    process.exit(1);
  }

  console.log('✅ RDS cluster found:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log('');

  console.log('🔐 Getting credentials from Secrets Manager...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

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

    const pool = new Pool({
      host: endpoint,
      port: parseInt(port, 10),
      database: dbName,
      user: username,
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    await pool.query('SELECT 1');
    console.log('🔗 Connected to database');
    console.log('');

    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '504_add_diagnostic_tests_category_column.sql');

    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    console.log('📊 Checking diagnostic_tests BEFORE migration...');
    const beforeResult = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'diagnostic_tests'
      ORDER BY ordinal_position
    `);
    const beforeCols = beforeResult.rows.map(r => r.column_name);
    console.log('   Columns:', beforeCols.join(', '));
    console.log('   category exists:', beforeCols.includes('category') ? 'YES' : 'NO');
    console.log('   test_category exists:', beforeCols.includes('test_category') ? 'YES' : 'NO');
    console.log('');

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('🔄 Running migration 504...');
    await pool.query(sql);
    console.log('✅ Migration executed');
    console.log('');

    console.log('📊 Verifying diagnostic_tests AFTER migration...');
    const afterResult = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'diagnostic_tests'
      ORDER BY ordinal_position
    `);
    const afterCols = afterResult.rows.map(r => r.column_name);
    console.log('   Columns:', afterCols.join(', '));
    const hasCategory = afterCols.includes('category');
    const hasSampleType = afterCols.includes('sample_type');
    const hasPrep = afterCols.includes('preparation_instructions');
    console.log('');
    if (hasCategory) console.log('✅ category column added');
    else console.log('❌ category column NOT found');
    if (hasSampleType) console.log('✅ sample_type column present');
    if (hasPrep) console.log('✅ preparation_instructions column present');
    console.log('');

    await pool.end();

    console.log('=========================================');
    console.log('🎉 Migration 504 Complete!');
    console.log('=========================================');
    console.log('');
    console.log('Next: Deploy backend - cd backend/lambda && ./scripts/deploy.sh dev');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

runMigration().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
