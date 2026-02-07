#!/usr/bin/env node
/**
 * List Solo Vendors and Their Enabled Services
 * Uses direct PostgreSQL connection (requires HTTP endpoint to be enabled for RDS Data API)
 * Alternative: Use this script with direct DB connection if RDS Data API is not available
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
const DB_HOST = process.env.DB_HOST || 'warmpawz-dev-db.cluster-xxxxx.ap-south-1.rds.amazonaws.com';
const DB_NAME = process.env.DB_NAME || 'warmpawz_dev';

const secretsClient = new SecretsManagerClient({ region: REGION });

async function getDbCredentials() {
  try {
    const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error('Error fetching DB credentials:', error);
    throw error;
  }
}

async function listSoloVendorsServices() {
  console.log('📊 Fetching solo vendors and their enabled services from RDS...\n');

  let client;
  try {
    // Get credentials from Secrets Manager
    const credentials = await getDbCredentials();
    
    // Create PostgreSQL client
    client = new Client({
      host: DB_HOST,
      port: 5432,
      database: DB_NAME,
      user: credentials.username || credentials.user,
      password: credentials.password,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    console.log('✅ Connected to database\n');

      const query = `
      SELECT 
        v.id as vendor_id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.email,
        v.status as vendor_status,
        v.is_active,
        r.name as role_name,
        r.display_name as role_display_name,
        vs.service_id,
        COALESCE(vs.service_name, vs.service_id::text) as service_name,
        COALESCE(vs.category, 'N/A') as service_category,
        vs.service_style,
        vs.is_enabled,
        vs.custom_price,
        vs.custom_duration,
        vs.publish_status,
        vs.created_at as service_enabled_at
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      INNER JOIN vendor_services vs ON v.id = vs.vendor_id
      WHERE 
        vs.service_style IN ('at_home', 'tele')
        AND vs.is_enabled = true
        AND NOT EXISTS (
          SELECT 1 FROM vendor_services vs2 
          WHERE vs2.vendor_id = v.id 
          AND vs2.service_style = 'at_center' 
          AND vs2.is_enabled = true
        )
      ORDER BY 
        v.business_name, 
        vs.service_style,
        vs.service_name;
    `;

    const result = await client.query(query);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log('❌ No solo vendors with enabled services found.\n');
      return;
    }

    console.log(`✅ Found ${rows.length} enabled services for solo vendors:\n`);
    console.log('═'.repeat(120));
    
    // Group by vendor
    const vendorsMap = new Map();
    rows.forEach(row => {
      const vendorId = row.vendor_id;
      if (!vendorsMap.has(vendorId)) {
        vendorsMap.set(vendorId, {
          vendor_id: vendorId,
          business_name: row.business_name || 'N/A',
          owner_name: row.owner_name || 'N/A',
          phone: row.phone || 'N/A',
          email: row.email || 'N/A',
          vendor_status: row.vendor_status || 'N/A',
          vendor_type: row.vendor_type || 'N/A',
          role_name: row.role_name || 'N/A',
          role_display_name: row.role_display_name || 'N/A',
          services: []
        });
      }
      vendorsMap.get(vendorId).services.push({
        service_id: row.service_id,
        service_name: row.service_name || 'N/A',
        service_category: row.service_category || 'N/A',
        service_style: row.service_style || 'N/A',
        is_enabled: row.is_enabled,
        custom_price: row.custom_price,
        custom_duration: row.custom_duration,
        publish_status: row.publish_status || 'N/A',
        service_enabled_at: row.service_enabled_at
      });
    });

    // Display results
    let vendorIndex = 1;
    vendorsMap.forEach((vendor, vendorId) => {
      console.log(`\n${vendorIndex}. VENDOR: ${vendor.business_name} (${vendor.owner_name})`);
      console.log(`   ID: ${vendor.vendor_id}`);
      console.log(`   Phone: ${vendor.phone} | Email: ${vendor.email}`);
      console.log(`   Status: ${vendor.vendor_status} | Type: ${vendor.vendor_type}`);
      console.log(`   Role: ${vendor.role_display_name} (${vendor.role_name})`);
      console.log(`   Enabled Services: ${vendor.services.length}`);
      console.log('   ' + '─'.repeat(110));
      
      // Group services by style
      const servicesByStyle = new Map();
      vendor.services.forEach(service => {
        const style = service.service_style || 'unknown';
        if (!servicesByStyle.has(style)) {
          servicesByStyle.set(style, []);
        }
        servicesByStyle.get(style).push(service);
      });

      servicesByStyle.forEach((services, style) => {
        console.log(`\n   📋 Service Style: ${style.toUpperCase()} (${services.length} service(s))`);
        services.forEach((service, idx) => {
          console.log(`      ${idx + 1}. ${service.service_name}`);
          console.log(`         Category: ${service.service_category}`);
          console.log(`         Price: ${service.custom_price ? `₹${service.custom_price}` : 'Default'}`);
          console.log(`         Duration: ${service.custom_duration ? `${service.custom_duration} min` : 'Default'}`);
          console.log(`         Status: ${service.publish_status} | Enabled: ${service.is_enabled}`);
          console.log(`         Service ID: ${service.service_id}`);
        });
      });
      
      console.log('   ' + '─'.repeat(110));
      vendorIndex++;
    });

    console.log(`\n\n📊 SUMMARY:`);
    console.log(`   Total Solo Vendors: ${vendorsMap.size}`);
    console.log(`   Total Enabled Services: ${rows.length}`);
    
    // Count by service style
    const styleCounts = new Map();
    rows.forEach(row => {
      const style = row.service_style || 'unknown';
      styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
    });
    
    console.log(`\n   Services by Style:`);
    styleCounts.forEach((count, style) => {
      console.log(`      ${style}: ${count} service(s)`);
    });

  } catch (error) {
    console.error('❌ Error executing query:', error.message);
    console.error('\n💡 Options:');
    console.error('   1. Enable HTTP endpoint for RDS Data API in AWS Console');
    console.error('   2. Use direct PostgreSQL connection (set DB_HOST environment variable)');
    console.error('   3. Use the SQL file (scripts/list-solo-vendors-services.sql) with a database client');
  } finally {
    if (client) {
      await client.end();
      console.log('\n✅ Database connection closed.');
    }
  }
}

listSoloVendorsServices();
