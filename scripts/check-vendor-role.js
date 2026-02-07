#!/usr/bin/env node
/**
 * Check vendor role for a specific phone
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function checkVendorRole(phone) {
  console.log(`📋 Checking vendor role for phone: ${phone}\n`);
  
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
  
  // Check vendor_identity
  const viResult = await pool.query(`
    SELECT 
      vi.id as vendor_id,
      vi.phone,
      vi.onboarding_status,
      vi.selected_role_id,
      r.name as role_name,
      r.display_name,
      r.config->>'vendorConfiguration' as vendor_config,
      r.customer_service
    FROM vendor_identity vi
    LEFT JOIN roles r ON vi.selected_role_id = r.id
    WHERE vi.phone = $1
  `, [phone]);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('VENDOR IDENTITY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (viResult.rows.length > 0) {
    const v = viResult.rows[0];
    console.log(`  Vendor ID:      ${v.vendor_id}`);
    console.log(`  Phone:          ${v.phone}`);
    console.log(`  Status:         ${v.onboarding_status}`);
    console.log(`  Role ID:        ${v.selected_role_id}`);
    console.log(`  Role Name:      ${v.role_name}`);
    console.log(`  Display Name:   ${v.display_name}`);
    console.log(`  Vendor Config:  ${v.vendor_config}`);
    console.log(`  Customer Svc:   ${v.customer_service}`);
    
    // Now check role permissions
    const permResult = await pool.query(`
      SELECT permission_name, resource, action
      FROM role_permissions
      WHERE role_id = $1
      ORDER BY permission_name
    `, [v.selected_role_id]);
    
    console.log(`\n  Permissions (${permResult.rows.length}):`);
    permResult.rows.forEach(p => {
      console.log(`    - ${p.permission_name}`);
    });
  } else {
    console.log('  No vendor found with this phone number');
  }
  
  await pool.end();
  console.log('\n✅ Done!');
}

const phone = process.argv[2] || '8765409876';
checkVendorRole(phone).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
