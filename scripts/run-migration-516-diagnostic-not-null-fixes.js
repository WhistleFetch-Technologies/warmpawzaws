#!/usr/bin/env node
/**
 * Run Migration 516: Fix NOT NULL constraints in diagnostic_reports (AWS RDS)
 * Usage: node scripts/run-migration-516-diagnostic-not-null-fixes.js
 */
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV = process.env.ENVIRONMENT || process.env.STAGE || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function run() {
  console.log('🚀 Migration 516: Fix NOT NULL constraints in diagnostic_reports');
  console.log('================================================================');
  console.log(`Environment: ${ENV}`);
  console.log(`Region: ${REGION}`);
  console.log('');
  
  const clusterId = `warmpawz-${ENV}-cluster`;
  let endpoint, port, dbName, username;
  
  try {
    const awsCmd = (query) => {
      const cmd = `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query "${query}" --output text`;
      return execSync(cmd, { encoding: 'utf8', shell: true }).trim();
    };
    
    endpoint = awsCmd('DBClusters[0].Endpoint');
    port = awsCmd('DBClusters[0].Port') || '5432';
    dbName = awsCmd('DBClusters[0].DatabaseName') || 'warmpawz';
    username = awsCmd('DBClusters[0].MasterUsername') || 'warmpawz_admin';
    
    if (!endpoint || endpoint === 'None' || endpoint === 'null' || endpoint.includes('[')) {
      throw new Error(`Invalid endpoint: ${endpoint}`);
    }
    
    console.log(`✅ RDS Cluster: ${endpoint}:${port}/${dbName}`);
  } catch (e) {
    console.error('❌ Failed to get RDS info:', e.message);
    process.exit(1);
  }
  
  console.log('🔐 Getting database password from Secrets Manager...');
  const sm = new SecretsManagerClient({ region: REGION });
  
  const secretNames = [
    `warmpawz-${ENV}-rds-master-20260106164510791100000002`,
    `warmpawz-${ENV}-rds-secret`,
    `warmpawz/${ENV}/rds/credentials`,
  ];
  
  let password = null;
  for (const secretName of secretNames) {
    try {
      const secret = JSON.parse((await sm.send(new GetSecretValueCommand({ SecretId: secretName }))).SecretString);
      password = secret.password || secret.Password;
      if (password) {
        console.log(`✅ Retrieved password from secret: ${secretName}`);
        break;
      }
    } catch (err) {
      continue;
    }
  }
  
  if (!password) {
    console.error('❌ Could not get database password from Secrets Manager');
    process.exit(1);
  }
  
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'migrations', '516_diagnostic_reports_not_null_fixes.sql'),
    'utf8'
  );
  
  console.log(`📄 Read ${sql.length} bytes from migration file`);
  console.log('');
  console.log('⚙️  Running migration...');
  console.log('─'.repeat(50));
  
  try {
    await pool.query(sql);
    console.log('─'.repeat(50));
    console.log('✅ Migration 516 applied successfully!');
    
    // Verify the changes
    console.log('');
    console.log('🔍 Verifying column constraints...');
    const { rows } = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'diagnostic_reports'
        AND column_name IN ('test_id', 'uploaded_by')
      ORDER BY column_name
    `);
    
    if (rows.length > 0) {
      console.log('✅ Column constraints:');
      rows.forEach(row => console.log(`   - ${row.column_name}: is_nullable = ${row.is_nullable}`));
    } else {
      console.log('⚠️  test_id and uploaded_by columns not found');
    }
    
  } catch (error) {
    console.error('─'.repeat(50));
    console.error('❌ Migration failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
