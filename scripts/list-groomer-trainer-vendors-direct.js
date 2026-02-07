#!/usr/bin/env node
/**
 * List Groomer and Trainer Vendors with Their Services
 * Uses direct PostgreSQL connection to RDS
 * Based on list-solo-vendors-services-direct.js pattern
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
const DB_HOST = process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_NAME = process.env.DB_NAME || 'warmpawz';

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

async function listGroomerTrainerVendors() {
  console.log('📊 Fetching groomer and trainer vendors with their services from RDS...\n');

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
        v.is_active,
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        -- Service details
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
      LEFT JOIN vendor_services vs ON v.id = vs.vendor_id
      WHERE 
        (r.name ILIKE '%groomer%' OR r.name ILIKE '%trainer%' OR r.name ILIKE '%pet_groomer%' OR r.name ILIKE '%pet_trainer%')
        AND v.is_active = true
      ORDER BY 
        r.name,
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

    console.log(`✅ Found data for ${rows.length} service entries\n`);
    console.log('═'.repeat(120));
    
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
          services: []
        });
      }
      
      // Add service if vendor_service_id exists
      if (row.vendor_service_id) {
        vendorsMap.get(vendorId).services.push({
          vendor_service_id: row.vendor_service_id,
          service_name: row.service_name || 'Unnamed Service',
          service_style: row.service_style || 'N/A',
          category: row.category || 'N/A',
          sub_category: row.sub_category || null,
          price: row.custom_price || row.price || 0,
          duration: row.custom_duration || row.duration_minutes || 0,
          is_enabled: row.is_enabled,
          publish_status: row.publish_status || 'N/A',
          is_custom_service: row.is_custom_service || false,
          is_package: (row.metadata && typeof row.metadata === 'object' && row.metadata.isPackage) || false,
          metadata: row.metadata
        });
      }
    });

    // Display results
    let vendorIndex = 1;
    const totalVendors = vendorsMap.size;
    
    console.log(`\n📊 TOTAL VENDORS: ${totalVendors}\n`);
    console.log('═'.repeat(120));
    
    vendorsMap.forEach((vendor, vendorId) => {
      const enabledServices = vendor.services.filter(s => s.is_enabled === true);
      const customServices = vendor.services.filter(s => s.is_custom_service === true);
      const packages = vendor.services.filter(s => s.is_package === true);
      
      console.log(`\n${vendorIndex}. 🏢 VENDOR: ${vendor.business_name}`);
      console.log(`   ID: ${vendor.vendor_id}`);
      console.log(`   Owner: ${vendor.owner_name}`);
      console.log(`   Role: ${vendor.role_display_name} (${vendor.role_name})`);
      console.log(`   Phone: ${vendor.phone}`);
      console.log('');
      
      if (vendor.services.length === 0) {
        console.log('   ⚠️  No services configured');
      } else {
        console.log(`   📦 Total Services: ${vendor.services.length}`);
        console.log(`   ✅ Enabled Services: ${enabledServices.length}`);
        console.log(`   🎨 Custom Services: ${customServices.length}`);
        console.log(`   📋 Packages: ${packages.length}`);
        console.log('');
        
        // Group services by style
        const servicesByStyle = {
          at_home: [],
          at_center: [],
          tele: [],
          unknown: []
        };
        
        enabledServices.forEach(service => {
          const style = service.service_style || 'unknown';
          if (servicesByStyle[style]) {
            servicesByStyle[style].push(service);
          } else {
            servicesByStyle.unknown.push(service);
          }
        });
        
        // Display services by style
        ['at_home', 'at_center', 'tele'].forEach(style => {
          const styleServices = servicesByStyle[style];
          if (styleServices.length > 0) {
            const styleLabel = style === 'at_home' ? '🏠 At Home' : 
                              style === 'at_center' ? '🏥 At Center' : 
                              '📱 Tele';
            console.log(`   ${styleLabel} Services (${styleServices.length}):`);
            
            styleServices.forEach(service => {
              const custom = service.is_custom_service ? '🎨 CUSTOM' : '';
              const package = service.is_package ? '📋 PACKAGE' : '';
              const publishStatus = service.publish_status && service.publish_status !== 'N/A' ? `[${service.publish_status}]` : '';
              
              console.log(`      ✅ ${service.service_name} ${custom} ${package} ${publishStatus}`);
              console.log(`         Price: ₹${service.price} | Duration: ${service.duration} min`);
              if (service.category && service.category !== 'N/A') {
                console.log(`         Category: ${service.category}${service.sub_category ? ` > ${service.sub_category}` : ''}`);
              }
              
              // Show package details if it's a package
              if (service.is_package && service.metadata && typeof service.metadata === 'object') {
                const pkgDetails = service.metadata.packageDetails || {};
                if (pkgDetails.totalSessions) {
                  console.log(`         Package: ${pkgDetails.totalSessions} sessions`);
                }
              }
            });
            console.log('');
          }
        });
        
        // Show disabled services if any
        const disabledServices = vendor.services.filter(s => s.is_enabled === false);
        if (disabledServices.length > 0) {
          console.log(`   ❌ Disabled Services (${disabledServices.length}):`);
          disabledServices.forEach(service => {
            console.log(`      - ${service.service_name} (${service.service_style || 'N/A'})`);
          });
          console.log('');
        }
        
        // Show custom services summary
        if (customServices.length > 0) {
          console.log(`   🎨 Custom Services Summary:`);
          customServices.forEach(service => {
            const status = service.is_enabled ? '✅' : '❌';
            console.log(`      ${status} ${service.service_name} (${service.service_style || 'N/A'}) - ₹${service.price}`);
          });
          console.log('');
        }
        
        // Show packages summary
        if (packages.length > 0) {
          console.log(`   📋 Packages Summary:`);
          packages.forEach(service => {
            const status = service.is_enabled ? '✅' : '❌';
            const pkgDetails = service.metadata?.packageDetails || {};
            console.log(`      ${status} ${service.service_name} (${service.service_style || 'N/A'})`);
            if (pkgDetails.totalSessions) {
              console.log(`         Total Sessions: ${pkgDetails.totalSessions}`);
            }
            if (pkgDetails.sessionsPerDay) {
              console.log(`         Sessions Per Day: ${pkgDetails.sessionsPerDay}`);
            }
            console.log(`         Price: ₹${service.price}`);
          });
          console.log('');
        }
      }
      
      console.log('   ' + '-'.repeat(116));
      vendorIndex++;
    });
    
    // Summary statistics
    console.log('\n');
    console.log('═'.repeat(120));
    console.log('📊 SUMMARY STATISTICS');
    console.log('═'.repeat(120));
    
    const roleCounts = {};
    let totalServices = 0;
    let totalEnabled = 0;
    let totalCustom = 0;
    let totalPackages = 0;
    
    vendorsMap.forEach(vendor => {
      const role = vendor.role_display_name || vendor.role_name || 'Unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
      totalServices += vendor.services.length;
      totalEnabled += vendor.services.filter(s => s.is_enabled).length;
      totalCustom += vendor.services.filter(s => s.is_custom_service).length;
      totalPackages += vendor.services.filter(s => s.is_package).length;
    });
    
    console.log(`\nTotal Vendors: ${totalVendors}`);
    console.log('\nBy Role:');
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`  ${role}: ${count} vendor(s)`);
    });
    
    console.log(`\nTotal Services: ${totalServices}`);
    console.log(`Enabled Services: ${totalEnabled}`);
    console.log(`Custom Services: ${totalCustom}`);
    console.log(`Packages: ${totalPackages}`);
    
    console.log('\n✅ Query completed successfully!\n');

  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    if (error.message?.includes('getaddrinfo') || error.message?.includes('ENOTFOUND')) {
      console.error('\n💡 Make sure DB_HOST is set correctly (e.g., warmpawz-dev-db.cluster-xxxxx.ap-south-1.rds.amazonaws.com)');
    }
    if (error.message?.includes('password') || error.message?.includes('authentication')) {
      console.error('\n💡 Make sure DB_SECRET_ARN is set correctly and credentials are valid');
    }
    throw error;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  listGroomerTrainerVendors().catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
}

module.exports = { listGroomerTrainerVendors };
