#!/usr/bin/env node
/**
 * Query vet vendors from database and list their services
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function queryVetVendors() {
  console.log('🔍 Querying Vet Vendors from Database...');
  console.log('========================================\n');
  
  // Get RDS cluster info
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
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
  
  // Get password from Secrets Manager
  const secretsClient = new SecretsManagerClient({ region: REGION });
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;
  
  console.log(`Connecting to ${endpoint}:${port}/${dbName}...`);
  
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Query 1: Get all vet vendors with their role type
    console.log('\n' + '='.repeat(80));
    console.log('VET VENDORS - SEGREGATED BY TYPE');
    console.log('='.repeat(80));

    const vendorsQuery = `
      SELECT 
        v.id, 
        v.business_name, 
        v.owner_name, 
        v.phone, 
        v.status, 
        v.is_active,
        r.name as role_name, 
        r.display_name as role_display_name,
        CASE 
          WHEN r.name LIKE '%solo%' OR r.display_name LIKE '%Solo%' THEN 'SOLO'
          ELSE 'CLINIC/BUSINESS'
        END as vendor_type
      FROM vendors v 
      LEFT JOIN roles r ON v.role_id = r.id 
      WHERE LOWER(r.name) LIKE '%vet%' OR LOWER(r.display_name) LIKE '%vet%'
      ORDER BY 
        CASE WHEN r.name LIKE '%solo%' OR r.display_name LIKE '%Solo%' THEN 1 ELSE 0 END,
        v.business_name
    `;

    const vendors = await pool.query(vendorsQuery);
    
    console.log(`\nTotal Vet Vendors: ${vendors.rows.length}\n`);

    // Group by type
    const clinics = vendors.rows.filter(v => !v.role_name?.includes('solo') && !v.role_display_name?.includes('Solo'));
    const solos = vendors.rows.filter(v => v.role_name?.includes('solo') || v.role_display_name?.includes('Solo'));

    console.log('--- CLINICS/BUSINESSES ---');
    console.log(`Count: ${clinics.length}`);
    for (const v of clinics) {
      console.log(`  [${v.status}] ${v.business_name || v.owner_name} (${v.phone}) - Role: ${v.role_display_name || v.role_name}`);
    }

    console.log('\n--- SOLO VENDORS ---');
    console.log(`Count: ${solos.length}`);
    for (const v of solos) {
      console.log(`  [${v.status}] ${v.business_name || v.owner_name} (${v.phone}) - Role: ${v.role_display_name || v.role_name}`);
    }

    // Query 2: Get services for each vendor
    console.log('\n' + '='.repeat(80));
    console.log('ENABLED SERVICES BY VENDOR AND SERVICE STYLE');
    console.log('='.repeat(80));

    for (const vendor of vendors.rows) {
      const servicesQuery = `
        SELECT 
          vs.service_name,
          vs.service_style,
          vs.price,
          vs.duration_minutes,
          vs.is_enabled,
          vs.publish_status
        FROM vendor_services vs
        WHERE vs.vendor_id = $1
          AND vs.is_enabled = true
        ORDER BY vs.service_style, vs.service_name
      `;

      const services = await pool.query(servicesQuery, [vendor.id]);

      const vendorType = (vendor.role_name?.includes('solo') || vendor.role_display_name?.includes('Solo')) ? 'SOLO' : 'CLINIC';
      console.log(`\n[${vendorType}] ${vendor.business_name || vendor.owner_name} (${vendor.phone})`);
      console.log(`  Role: ${vendor.role_display_name || vendor.role_name}`);
      console.log(`  Status: ${vendor.status}, Active: ${vendor.is_active}`);
      
      if (services.rows.length === 0) {
        console.log('  Services: NONE ENABLED');
      } else {
        // Group by service style
        const byStyle = {};
        for (const svc of services.rows) {
          const style = svc.service_style || 'unknown';
          if (!byStyle[style]) byStyle[style] = [];
          byStyle[style].push(svc);
        }

        for (const [style, svcs] of Object.entries(byStyle)) {
          console.log(`  [${style.toUpperCase()}] Services:`);
          for (const svc of svcs) {
            console.log(`    - ${svc.service_name}: ₹${svc.price || 0}, ${svc.duration_minutes || 30}min (${svc.publish_status || 'draft'})`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('QUERY COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

queryVetVendors().catch(console.error);
