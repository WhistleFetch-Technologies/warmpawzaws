#!/usr/bin/env node
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = 'dev';
const REGION = 'ap-south-1';
const clusterId = 'warmpawz-dev-cluster';

async function checkRoles() {
  const endpoint = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`, { encoding: 'utf8' }).trim();
  const username = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`, { encoding: 'utf8' }).trim();
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: 'warmpawz-dev-rds-master-20260106164510791100000002' }));
  const secret = JSON.parse(secretValue.SecretString);
  
  const pool = new Pool({
    host: endpoint, port: 5432, database: 'warmpawz', user: username, password: secret.password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(`
      SELECT DISTINCT r.name, r.display_name, COUNT(v.id) as vendor_count
      FROM roles r
      LEFT JOIN vendors v ON v.role_id = r.id
      WHERE LOWER(r.name) LIKE '%vet%' OR LOWER(r.display_name) LIKE '%vet%'
      GROUP BY r.id, r.name, r.display_name
      ORDER BY r.name
    `);
    
    console.log('VET-RELATED ROLES IN DATABASE:');
    console.log('='.repeat(80));
    for (const row of result.rows) {
      console.log(`  name: "${row.name}"`);
      console.log(`  display_name: "${row.display_name}"`);
      console.log(`  vendor_count: ${row.vendor_count}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRoles().catch(console.error);
