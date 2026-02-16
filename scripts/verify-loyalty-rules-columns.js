#!/usr/bin/env node
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = 'ap-south-1';

(async () => {
  try {
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    const endpoint = clusterInfo.DBClusters[0].Endpoint;
    
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName = ENVIRONMENT === 'prod' 
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : 'warmpawz-dev-rds-master-20260106164510791100000002';
    
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password;
    
    const pool = new Pool({
      host: endpoint,
      port: 5432,
      database: 'warmpawz',
      user: 'warmpawz_admin',
      password: password,
      ssl: { rejectUnauthorized: false }
    });
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'loyalty_rules' 
      ORDER BY column_name
    `);
    
    console.log('Columns in loyalty_rules table:');
    result.rows.forEach(r => {
      console.log(`  - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
    });
    
    // Check for required columns
    const requiredColumns = ['name', 'description', 'min_points_to_redeem', 'max_redemption_per_transaction', 'expiry_days'];
    const existingColumns = result.rows.map(r => r.column_name);
    const missing = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missing.length > 0) {
      console.log(`\n❌ Missing columns: ${missing.join(', ')}`);
      process.exit(1);
    } else {
      console.log('\n✅ All required columns exist!');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
