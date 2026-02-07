#!/usr/bin/env node
/**
 * List approved vendors for testing
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function listVendors() {
  console.log('📋 Fetching approved vendors for testing...\n');
  
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
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
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  const result = await pool.query(`
    SELECT 
      vi.id,
      vi.phone,
      vi.email,
      r.name as role_name,
      r.config->>'vendorConfiguration' as vendor_config
    FROM vendor_identity vi
    JOIN roles r ON vi.selected_role_id = r.id
    WHERE vi.onboarding_status IN ('APPROVED', 'ACTIVATED')
    ORDER BY r.name, vi.created_at DESC
  `);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('APPROVED VENDORS FOR TESTING');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const byRole = {};
  for (const row of result.rows) {
    if (!byRole[row.role_name]) {
      byRole[row.role_name] = [];
    }
    byRole[row.role_name].push(row);
  }
  
  for (const [role, vendors] of Object.entries(byRole)) {
    console.log(`\n📌 ${role.toUpperCase()} (${vendors[0].vendor_config}):`);
    vendors.forEach(v => {
      console.log(`   Phone: ${v.phone || 'N/A'} | Email: ${v.email || 'N/A'}`);
    });
  }
  
  await pool.end();
  console.log('✅ Done!');
}

listVendors().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
