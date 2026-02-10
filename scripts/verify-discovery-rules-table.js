#!/usr/bin/env node
/**
 * Verify if discovery_rules table exists
 * 
 * Usage:
 *   ENVIRONMENT=prod node scripts/verify-discovery-rules-table.js
 *   ENVIRONMENT=dev node scripts/verify-discovery-rules-table.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function verifyTable() {
  console.log('🔍 Verifying Discovery Rules Table');
  console.log('===================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
    process.exit(1);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  const endpoint = cluster.Endpoint;
  const port = cluster.Port || '5432';
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  console.log('✅ RDS Cluster found:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log('');

  // Get password from Secrets Manager
  console.log('🔐 Getting database credentials from Secrets Manager...');
  const secretsClient = new SecretsManagerClient({ region: REGION });

  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  // For prod, use the actual secret name
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }
  
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

    // Check if table exists
    console.log('🔍 Checking for discovery_rules table...');
    
    const checkQuery = `
      SELECT 
        EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'discovery_rules'
        ) as exists
    `;
    
    const result = await pool.query(checkQuery);
    const tableExists = result.rows[0].exists;
    
    console.log('');
    console.log('📊 Table Status:');
    console.log('────────────────');
    console.log(`   discovery_rules: ${tableExists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (tableExists) {
      // Get row count and column info
      const countQuery = `SELECT COUNT(*) as count FROM discovery_rules`;
      const countResult = await pool.query(countQuery);
      console.log(`   Row count: ${countResult.rows[0].count}`);
      
      // Check for service_style and service_type columns (migration 091)
      const colQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'discovery_rules' 
        AND column_name IN ('service_style', 'service_type')
      `;
      const colResult = await pool.query(colQuery);
      const hasServiceColumns = colResult.rows.length === 2;
      console.log(`   Has service_style/service_type: ${hasServiceColumns ? '✅ YES' : '❌ NO'}`);
      
      console.log('');
      console.log('✅ Table exists!');
    } else {
      console.log('');
      console.log('❌ Table missing!');
      console.log('');
      console.log('💡 Run migrations to create table:');
      console.log(`   ENVIRONMENT=${ENVIRONMENT} node scripts/run-migration-rds-node.js 090_discovery_rules.sql`);
      console.log(`   ENVIRONMENT=${ENVIRONMENT} node scripts/run-migration-rds-node.js 091_discovery_rules_service_style_type.sql`);
    }

    await pool.end();

  } catch (error) {
    console.error('');
    console.error('❌ Verification failed:');
    console.error(error.message);
    process.exit(1);
  }
}

verifyTable();
