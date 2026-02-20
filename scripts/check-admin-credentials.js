#!/usr/bin/env node
/**
 * ============================================================================
 * CHECK ADMIN CREDENTIALS IN PRODUCTION DATABASE
 * ============================================================================
 * Queries the production database to verify if admin credentials exist
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';
const ENVIRONMENT = 'prod';

async function getPool() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${clusterId}`);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';
  const secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;
  
  if (!password) throw new Error('Password not found in secret');
  
  return new Pool({
    host: cluster.Endpoint,
    port: parseInt(cluster.Port || '5432', 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

async function checkAdminCredentials() {
  const pool = await getPool();
  const email = 'admin@warmpawz.com';
  
  try {
    console.log(`\n[CHECK] Querying production database for admin: ${email}`);
    
    const result = await pool.query(
      'SELECT id, email, name, password_hash, role, is_active, created_at FROM admins WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log(`\n❌ [RESULT] Admin with email "${email}" NOT FOUND in production database`);
      console.log('\n[INFO] The admin needs to be created in the database.');
      return;
    }
    
    const admin = result.rows[0];
    console.log(`\n✅ [RESULT] Admin found in production database:`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name || 'N/A'}`);
    console.log(`   Role: ${admin.role || 'N/A'}`);
    console.log(`   Is Active: ${admin.is_active}`);
    console.log(`   Password Hash: ${admin.password_hash ? 'SET' : 'NOT SET'}`);
    console.log(`   Created At: ${admin.created_at}`);
    
    if (!admin.password_hash) {
      console.log(`\n⚠️  [WARNING] Admin exists but password_hash is NOT SET`);
      console.log('   The admin needs a password_hash to login with email/password.');
    } else {
      console.log(`\n✅ [INFO] Admin has password_hash set - password verification should work`);
    }
    
  } catch (error) {
    console.error('\n❌ [ERROR] Failed to query database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkAdminCredentials()
  .then(() => {
    console.log('\n[COMPLETE] Check finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[FAILED]', error);
    process.exit(1);
  });
