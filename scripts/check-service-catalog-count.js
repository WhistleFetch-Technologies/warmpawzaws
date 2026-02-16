#!/usr/bin/env node
/**
 * Quick script to check service_catalog record count in PROD
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function checkCount() {
  console.log('🔍 Checking service_catalog count in PROD...');
  console.log('');

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));

  const cluster = clusterInfo.DBClusters[0];
  const endpoint = cluster.Endpoint;
  const port = cluster.Port || '5432';
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  const secretName = ENVIRONMENT === 'prod' 
    ? 'warmpawz-prod-rds-master-20260207201049162400000001'
    : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const secret = JSON.parse(secretResponse.SecretString);
  const password = secret.password || secret.Password;

  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM service_catalog');
    const count = parseInt(result.rows[0].count, 10);
    
    console.log(`✅ Total service_catalog records in PROD: ${count}`);
    console.log('');
    
    // Check for specific IDs that were missing
    const missingIds = [
      '5043f1fb-ff9b-4a31-be53-9f053624c34e',
      '6dc10043-1b4e-4b29-90f9-c00e3c0e1d26',
      'd7b40436-45cb-4374-b11f-bb4e5b70f2ac',
      '56fe4745-23fe-4cde-b89a-719dd209ed05',
      '94d11796-f557-4940-8260-33a0228021cc'
    ];
    
    console.log('🔍 Checking if previously missing records are now present...');
    for (const id of missingIds) {
      const check = await pool.query('SELECT id, service_name, display_name FROM service_catalog WHERE id = $1', [id]);
      if (check.rows.length > 0) {
        console.log(`   ✅ ${id}: ${check.rows[0].display_name || check.rows[0].service_name}`);
      } else {
        console.log(`   ❌ ${id}: Still missing`);
      }
    }
    
    console.log('');
    console.log('✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkCount().catch(console.error);
