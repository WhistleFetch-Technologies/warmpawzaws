#!/usr/bin/env node
/**
 * List Groomer and Trainer Vendors with Phone Numbers and Enabled Services
 * Output formatted for API calls
 * Uses direct PostgreSQL connection to RDS
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
const DB_HOST = process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_NAME = process.env.DB_NAME || 'warmpawz';
const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

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

async function listVendorsWithServices() {
  console.log('📊 Fetching groomer and trainer vendors with enabled services...\n');

  let client;
  try {
    const credentials = await getDbCredentials();
    
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
        v.is_active,
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        -- Service details (only enabled services)
        vs.id as vendor_service_id,
        COALESCE(vs.service_name, vs.service_id::text) as service_name,
        vs.service_style,
        vs.category,
        vs.sub_category,
        vs.price,
        vs.custom_price,
        vs.duration_minutes,
        vs.custom_duration,
        vs.is_enabled,
        vs.publish_status,
        vs.is_custom_service,
        vs.metadata
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      LEFT JOIN vendor_services vs ON v.id = vs.vendor_id AND vs.is_enabled = true
      WHERE 
        (r.name ILIKE '%groomer%' OR r.name ILIKE '%trainer%' OR r.name ILIKE '%pet_groomer%' OR r.name ILIKE '%pet_trainer%')
        AND v.is_active = true
      ORDER BY 
        v.business_name,
        vs.service_style,
        vs.service_name;
    `;

    const result = await client.query(query);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log('❌ No groomer or trainer vendors found.\n');
      await client.end();
      return;
    }

    // Group by vendor
    const vendorsMap = new Map();
    rows.forEach(row => {
      const vendorId = row.vendor_id;
      if (!vendorsMap.has(vendorId)) {
        vendorsMap.set(vendorId, {
          vendor_id: vendorId,
          business_name: row.business_name || row.owner_name || 'Unnamed Vendor',
          owner_name: row.owner_name || 'N/A',
          phone: row.phone || 'N/A',
          email: row.email || 'N/A',
          role_name: row.role_name || 'N/A',
          role_display_name: row.role_display_name || row.role_name || 'N/A',
          enabled_services: []
        });
      }
      
      // Add enabled service if vendor_service_id exists
      if (row.vendor_service_id && row.is_enabled) {
        vendorsMap.get(vendorId).enabled_services.push({
          service_id: row.vendor_service_id,
          service_name: row.service_name || 'Unnamed Service',
          service_style: row.service_style || 'N/A',
          category: row.category || 'N/A',
          price: row.custom_price || row.price || 0,
          duration: row.custom_duration || row.duration_minutes || 0,
          publish_status: row.publish_status || 'N/A',
          is_custom_service: row.is_custom_service || false
        });
      }
    });

    // Display results
    console.log('═'.repeat(120));
    console.log('📋 VENDOR LIST WITH ENABLED SERVICES');
    console.log('═'.repeat(120));
    console.log('');

    let vendorIndex = 1;
    vendorsMap.forEach((vendor, vendorId) => {
      console.log(`${vendorIndex}. ${vendor.business_name}`);
      console.log(`   📞 Phone: ${vendor.phone}`);
      console.log(`   🏷️  Role: ${vendor.role_display_name} (${vendor.role_name})`);
      console.log(`   🆔 Vendor ID: ${vendor.vendor_id}`);
      console.log(`   📧 Email: ${vendor.email}`);
      console.log('');
      
      if (vendor.enabled_services.length === 0) {
        console.log('   ⚠️  No enabled services');
      } else {
        console.log(`   ✅ Enabled Services (${vendor.enabled_services.length}):`);
        
        // Group by service style
        const byStyle = {
          at_home: [],
          at_center: [],
          tele: [],
          unknown: []
        };
        
        vendor.enabled_services.forEach(service => {
          const style = service.service_style || 'unknown';
          if (byStyle[style]) {
            byStyle[style].push(service);
          } else {
            byStyle.unknown.push(service);
          }
        });
        
        ['at_home', 'at_center', 'tele'].forEach(style => {
          const services = byStyle[style];
          if (services.length > 0) {
            const emoji = style === 'at_home' ? '🏠' : style === 'at_center' ? '🏥' : '📱';
            console.log(`      ${emoji} ${style.toUpperCase().replace('_', ' ')} (${services.length}):`);
            services.forEach(service => {
              const custom = service.is_custom_service ? ' [CUSTOM]' : '';
              console.log(`         • ${service.service_name}${custom}`);
              console.log(`           Price: ₹${service.price} | Duration: ${service.duration} min | Status: ${service.publish_status}`);
            });
          }
        });
      }
      
      console.log('');
      console.log(`   🔗 API Endpoint to Query Services:`);
      console.log(`      GET ${API_BASE_URL}/vendor/${vendorId}/services`);
      console.log('');
      console.log(`   📝 Example API Call:`);
      console.log(`      curl -X GET "${API_BASE_URL}/vendor/${vendorId}/services" \\`);
      console.log(`           -H "Authorization: Bearer YOUR_TOKEN"`);
      console.log('');
      console.log('   ' + '-'.repeat(116));
      console.log('');
      vendorIndex++;
    });
    
    // Summary
    console.log('═'.repeat(120));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(120));
    console.log('');
    
    const totalVendors = vendorsMap.size;
    let totalEnabledServices = 0;
    const vendorsWithServices = [];
    const vendorsWithoutServices = [];
    
    vendorsMap.forEach(vendor => {
      totalEnabledServices += vendor.enabled_services.length;
      if (vendor.enabled_services.length > 0) {
        vendorsWithServices.push({
          name: vendor.business_name,
          phone: vendor.phone,
          vendor_id: vendor.vendor_id,
          service_count: vendor.enabled_services.length
        });
      } else {
        vendorsWithoutServices.push({
          name: vendor.business_name,
          phone: vendor.phone,
          vendor_id: vendor.vendor_id
        });
      }
    });
    
    console.log(`Total Vendors: ${totalVendors}`);
    console.log(`Vendors with Enabled Services: ${vendorsWithServices.length}`);
    console.log(`Vendors without Services: ${vendorsWithoutServices.length}`);
    console.log(`Total Enabled Services: ${totalEnabledServices}`);
    console.log('');
    
    if (vendorsWithServices.length > 0) {
      console.log('✅ Vendors with Enabled Services:');
      vendorsWithServices.forEach(v => {
        console.log(`   • ${v.name} (${v.phone}) - ${v.service_count} service(s)`);
        console.log(`     API: GET ${API_BASE_URL}/vendor/${v.vendor_id}/services`);
      });
      console.log('');
    }
    
    if (vendorsWithoutServices.length > 0) {
      console.log('⚠️  Vendors without Enabled Services:');
      vendorsWithoutServices.forEach(v => {
        console.log(`   • ${v.name} (${v.phone})`);
        console.log(`     API: GET ${API_BASE_URL}/vendor/${v.vendor_id}/services`);
      });
      console.log('');
    }
    
    // API Documentation
    console.log('═'.repeat(120));
    console.log('🔌 API ENDPOINT DOCUMENTATION');
    console.log('═'.repeat(120));
    console.log('');
    console.log('Endpoint: GET /vendor/:vendorId/services');
    console.log('');
    console.log('Description:');
    console.log('  Retrieves all enabled services for a specific vendor, grouped by service style.');
    console.log('');
    console.log('Parameters:');
    console.log('  - vendorId (path): Vendor UUID');
    console.log('  - custom (query, optional): Set to "true" to get only custom services');
    console.log('');
    console.log('Response Format:');
    console.log('  {');
    console.log('    "success": true,');
    console.log('    "services": [...],');
    console.log('    "servicesByStyle": {');
    console.log('      "at_home": { "services": [...], "count": 0 },');
    console.log('      "at_center": { "services": [...], "count": 0 },');
    console.log('      "tele": { "services": [...], "count": 0 }');
    console.log('    },');
    console.log('    "total": 0,');
    console.log('    "allowedServiceStyles": [...]');
    console.log('  }');
    console.log('');
    console.log('Example Request:');
    console.log(`  curl -X GET "${API_BASE_URL}/vendor/{vendorId}/services" \\`);
    console.log('       -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('       -H "Content-Type: application/json"');
    console.log('');
    console.log('Example Response:');
    console.log('  {');
    console.log('    "success": true,');
    console.log('    "services": [');
    console.log('      {');
    console.log('        "id": "service-uuid",');
    console.log('        "serviceName": "Basic Grooming",');
    console.log('        "serviceStyle": "at_home",');
    console.log('        "price": 500,');
    console.log('        "duration": 60,');
    console.log('        "isEnabled": true,');
    console.log('        "publishStatus": "published"');
    console.log('      }');
    console.log('    ],');
    console.log('    "servicesByStyle": {');
    console.log('      "at_home": { "services": [...], "count": 1 }');
    console.log('    },');
    console.log('    "total": 1');
    console.log('  }');
    console.log('');
    console.log('✅ Query completed successfully!\n');

  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    throw error;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  listVendorsWithServices().catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
}

module.exports = { listVendorsWithServices };
