#!/usr/bin/env node
/**
 * Create All Services via API
 * 
 * This script creates all services in the service catalog using the API endpoint
 * Run: node create-all-services-api.js
 */

const servicesData = require('./COMPLETE_SERVICE_CATALOG.json');

const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-gateway-url.amazonaws.com';
const API_KEY = process.env.API_KEY || ''; // Add if required

async function createService(service) {
  const payload = {
    service_id: service.service_id,
    service_name: service.service_name,
    display_name: service.display_name || service.service_name,
    description: service.description || '',
    category_id: service.category_id,
    category_name: service.category_name,
    applicable_roles: service.applicable_roles,
    service_style: service.service_style,
    base_price: service.base_price,
    duration_minutes: service.duration_minutes,
    status: 'active',
    publish_status: 'published',
    display_order: service.display_order || 0,
    metadata: service.is_package ? { is_package: true, package_services: service.package_services || [] } : {}
  };

  try {
    const response = await fetch(`${API_BASE_URL}/admin/service-catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` })
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Created: ${service.service_name} (${service.service_id})`);
      return { success: true, service: result.service };
    } else {
      console.error(`❌ Failed: ${service.service_name} - ${result.error || 'Unknown error'}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error(`❌ Error creating ${service.service_name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function createAllServices() {
  console.log('🚀 Starting service creation...\n');
  console.log(`Total services: ${servicesData.services.length}`);
  console.log(`Total packages: ${servicesData.packages.length}\n`);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  // Create individual services
  console.log('📦 Creating individual services...\n');
  for (const service of servicesData.services) {
    const result = await createService(service);
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({ service: service.service_id, error: result.error });
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Create packages
  console.log('\n📦 Creating service packages...\n');
  for (const pkg of servicesData.packages) {
    const result = await createService(pkg);
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({ service: pkg.service_id, error: result.error });
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successfully created: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.service}: ${err.error}`);
    });
  }
  
  console.log('\n✨ Done!');
}

// Run if executed directly
if (require.main === module) {
  createAllServices().catch(console.error);
}

module.exports = { createService, createAllServices };
