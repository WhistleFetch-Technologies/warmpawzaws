#!/usr/bin/env node
/**
 * One-time script to publish services for vendor 8123456780
 * This fixes the existing services that are enabled but not published
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const VENDOR_PHONE = '8123456780';

async function publishServices() {
  console.log('🔧 Publishing Services for Vendor 8123456780');
  console.log('========================================\n');
  
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  // Get RDS endpoint details
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  
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
  
  console.log(`📡 Connecting to: ${endpoint}:${port}/${dbName}\n`);
  
  // Get database password from Secrets Manager
  const secretsClient = new SecretsManagerClient({ region: REGION });
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;
  
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  try {
    // Find vendor
    const vendorResult = await pool.query(
      `SELECT id FROM vendors WHERE phone = $1`,
      [VENDOR_PHONE]
    );
    
    if (vendorResult.rows.length === 0) {
      console.log('❌ Vendor not found with phone:', VENDOR_PHONE);
      await pool.end();
      return;
    }
    
    const vendorId = vendorResult.rows[0].id;
    console.log(`✅ Found vendor: ${vendorId}\n`);
    
    // Find enabled but draft services
    const servicesResult = await pool.query(
      `SELECT id, service_name, service_style, is_enabled, publish_status
       FROM vendor_services
       WHERE vendor_id = $1
         AND is_enabled = true
         AND publish_status = 'draft'
         AND service_style IN ('at_home', 'tele')`,
      [vendorId]
    );
    
    if (servicesResult.rows.length === 0) {
      console.log('✅ No services need updating. All enabled services are already published.\n');
      await pool.end();
      return;
    }
    
    console.log(`📋 Found ${servicesResult.rows.length} services to publish:\n`);
    servicesResult.rows.forEach((service, idx) => {
      console.log(`${idx + 1}. ${service.service_name} (${service.service_style})`);
    });
    console.log('');
    
    // Update services to published
    const serviceIds = servicesResult.rows.map(s => s.id);
    const placeholders = serviceIds.map((_, i) => `$${i + 2}`).join(', ');
    const params = ['published', ...serviceIds, vendorId];
    
    const updateResult = await pool.query(
      `UPDATE vendor_services 
       SET publish_status = $1, 
           updated_at = NOW()
       WHERE vendor_id = $${params.length}
         AND id IN (${placeholders})
       RETURNING id, service_name, publish_status`,
      params
    );
    
    console.log('✅ Successfully published services:\n');
    updateResult.rows.forEach((service, idx) => {
      console.log(`${idx + 1}. ${service.service_name} → ${service.publish_status}`);
    });
    console.log(`\n✅ Total: ${updateResult.rows.length} service(s) published`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✅ Script complete!');
  }
}

publishServices().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
