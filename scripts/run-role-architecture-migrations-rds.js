#!/usr/bin/env node
/**
 * Run Role Architecture Migrations on AWS RDS using Node.js
 * Connects to RDS cluster and runs migrations 139 and 140
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || process.argv[2] || 'dev';
const REGION = process.env.AWS_REGION || process.argv[3] || 'ap-south-1';

async function runMigrations() {
  console.log('🚀 Role Architecture Migrations - AWS RDS');
  console.log('==========================================');
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
  
  // Try to find the secret
  try {
    await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  } catch (err) {
    // Try to find any secret with rds-master
    const listSecrets = await secretsClient.send(new (require('@aws-sdk/client-secrets-manager').ListSecretsCommand)({}));
    const rdsSecret = listSecrets.SecretList?.find(s => s.Name?.includes('rds-master'));
    if (rdsSecret) {
      secretName = rdsSecret.Name;
    } else {
      console.error('❌ ERROR: Could not find RDS secret in Secrets Manager');
      process.exit(1);
    }
  }

  const secretResponse = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secretValue = JSON.parse(secretResponse.SecretString || '{}');
  const password = secretValue.password || secretValue.Password || secretResponse.SecretString;

  if (!password) {
    console.error('❌ ERROR: Could not retrieve database password');
    process.exit(1);
  }

  console.log('✅ Credentials retrieved');
  console.log('');

  // Create connection pool
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    max: 1, // Single connection for migrations
  });

  try {
    // Test connection
    console.log('🔗 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Migration 139
    console.log('📦 Running Migration 139: Add customer_service column...');
    console.log('─────────────────────────────────────────────────────────');
    const sql139 = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrations', '139_add_customer_service_to_roles.sql'),
      'utf8'
    );
    await pool.query(sql139);
    console.log('✅ Migration 139 completed');
    console.log('');

    // Migration 140
    console.log('📦 Running Migration 140: Role consolidation...');
    console.log('─────────────────────────────────────────────────');
    const sql140 = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrations', '140_role_consolidation_20_to_21.sql'),
      'utf8'
    );
    await pool.query(sql140);
    console.log('✅ Migration 140 completed');
    console.log('');

    // Migration 141
    console.log('📦 Running Migration 141: Complete role consolidation cleanup...');
    console.log('─────────────────────────────────────────────────────────────');
    const sql141 = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrations', '141_complete_role_consolidation.sql'),
      'utf8'
    );
    await pool.query(sql141);
    console.log('✅ Migration 141 completed');
    console.log('');

    // Migration 142
    console.log('📦 Running Migration 142: Final role cleanup...');
    console.log('─────────────────────────────────────────────────');
    const sql142 = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrations', '142_final_role_cleanup.sql'),
      'utf8'
    );
    await pool.query(sql142);
    console.log('✅ Migration 142 completed');
    console.log('');

    // Migration 143
    console.log('📦 Running Migration 143: Delete inactive roles...');
    console.log('─────────────────────────────────────────────────────');
    const sql143 = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrations', '143_delete_inactive_roles.sql'),
      'utf8'
    );
    await pool.query(sql143);
    console.log('✅ Migration 143 completed');
    console.log('');

    // Migration 144
    console.log('📦 Running Migration 144: Map role capabilities...');
    console.log('─────────────────────────────────────────────────────');
    const sql144 = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrations', '144_map_role_capabilities.sql'),
      'utf8'
    );
    await pool.query(sql144);
    console.log('✅ Migration 144 completed');
    console.log('');

    // Verify migrations
    console.log('🔍 Verifying migrations...');
    const verifyResult = await pool.query(`
      SELECT 
        COUNT(*) as total_roles,
        COUNT(customer_service) as roles_with_customer_service,
        COUNT(CASE WHEN config->>'vendorConfiguration' IS NOT NULL THEN 1 END) as roles_with_vendor_config
      FROM roles 
      WHERE is_active = true;
    `);

    const stats = verifyResult.rows[0];
    console.log(`   Total roles: ${stats.total_roles}`);
    console.log(`   Roles with customer_service: ${stats.roles_with_customer_service}`);
    console.log(`   Roles with vendorConfiguration: ${stats.roles_with_vendor_config}`);
    console.log('');

    console.log('🎉 Migration and verification complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
