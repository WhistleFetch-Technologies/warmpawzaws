#!/usr/bin/env node
/**
 * Verify if specialization_master and specialization_symptoms tables exist
 * 
 * Usage:
 *   ENVIRONMENT=prod node scripts/verify-specialization-tables.js
 *   ENVIRONMENT=dev node scripts/verify-specialization-tables.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function verifyTables() {
  console.log('🔍 Verifying Specialization Tables');
  console.log('====================================');
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

  // Try to find the secret - check common patterns
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  // For prod, try the actual secret name
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

    // Check if tables exist
    console.log('🔍 Checking for specialization tables...');
    
    const checkQuery = `
      SELECT 
        table_name,
        EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = t.table_name
        ) as exists
      FROM (VALUES 
        ('specialization_master'),
        ('specialization_symptoms')
      ) AS t(table_name)
    `;
    
    const result = await pool.query(checkQuery);
    
    console.log('');
    console.log('📊 Table Status:');
    console.log('────────────────');
    
    let allExist = true;
    for (const row of result.rows) {
      const status = row.exists ? '✅ EXISTS' : '❌ MISSING';
      console.log(`   ${row.table_name}: ${status}`);
      if (!row.exists) {
        allExist = false;
      }
    }
    
    console.log('');
    
    if (allExist) {
      // Get row counts
      const countQuery = `
        SELECT 
          (SELECT COUNT(*) FROM specialization_master) as spec_master_count,
          (SELECT COUNT(*) FROM specialization_symptoms) as spec_symptoms_count
      `;
      const countResult = await pool.query(countQuery);
      console.log('📈 Row Counts:');
      console.log(`   specialization_master: ${countResult.rows[0].spec_master_count}`);
      console.log(`   specialization_symptoms: ${countResult.rows[0].spec_symptoms_count}`);
      console.log('');
      console.log('✅ All tables exist!');
    } else {
      console.log('❌ Missing tables detected!');
      console.log('');
      console.log('💡 Run migration to create tables:');
      console.log(`   ENVIRONMENT=${ENVIRONMENT} node scripts/run-migration-rds-node.js 505_specialization_master_schema.sql`);
    }

    await pool.end();

  } catch (error) {
    console.error('');
    console.error('❌ Verification failed:');
    console.error(error.message);
    process.exit(1);
  }
}

verifyTables();
