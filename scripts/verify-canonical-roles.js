#!/usr/bin/env node

const AWS = require('aws-sdk');
const pg = require('pg');

const ENV = process.env.ENVIRONMENT || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  console.log('🔍 Canonical Roles Forensic Validation');
  console.log('========================================\n');

  // Get RDS cluster info
  const rds = new AWS.RDS({ region: AWS_REGION });
  const clusterName = `warmpawz-${ENV}-cluster`;
  
  const clustersResult = await rds.describeDBClusters({ DBClusterIdentifier: clusterName }).promise();
  const cluster = clustersResult.DBClusters[0];
  const dbEndpoint = cluster.Endpoint;
  const dbPort = cluster.Port;
  const dbName = cluster.DatabaseName || 'warmpawz';
  const dbUser = cluster.MasterUsername;

  // Get credentials
  const secretsManager = new AWS.SecretsManager({ region: AWS_REGION });
  const secretName = `warmpawz/${ENV}/db`;
  
  const secretResult = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
  const secret = JSON.parse(secretResult.SecretString);

  // Connect to database
  const pool = new pg.Pool({
    host: dbEndpoint,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: secret.password,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    // 1. Get all active roles
    console.log('📋 Step 1: Active Roles in Database');
    console.log('─'.repeat(80));
    const activeRoles = await pool.query(`
      SELECT name, display_name, is_active 
      FROM roles 
      WHERE is_active = true 
      ORDER BY name
    `);
    console.log(`Found ${activeRoles.rows.length} active roles:\n`);
    activeRoles.rows.forEach(r => {
      console.log(`  - ${r.name.padEnd(30)} | ${r.display_name || 'N/A'}`);
    });

    // 2. Check vendors on active roles
    console.log('\n\n📊 Step 2: Vendor Distribution Across Active Roles');
    console.log('─'.repeat(80));
    const vendorsByRole = await pool.query(`
      SELECT r.name, r.display_name, COUNT(v.id) as vendor_count
      FROM roles r
      LEFT JOIN vendors v ON v.role_id = r.id AND v.is_active = true AND (v.status = 'approved' OR v.status = 'active')
      WHERE r.is_active = true
      GROUP BY r.name, r.display_name
      ORDER BY vendor_count DESC, r.name
    `);
    console.log(`\n${'Role Name'.padEnd(30)} | ${'Display Name'.padEnd(30)} | Vendors`);
    console.log('─'.repeat(80));
    vendorsByRole.rows.forEach(r => {
      console.log(`${r.name.padEnd(30)} | ${(r.display_name || '').padEnd(30)} | ${r.vendor_count}`);
    });

    // 3. Check getCategoryFromRole mapping coverage
    console.log('\n\n🗺️  Step 3: Role-to-Category Mapping Coverage');
    console.log('─'.repeat(80));
    
    const roleCategoryMap = {
      // Vet
      'vet_clinic': 'vet', 'veterinarian': 'vet', 'vet_solo': 'vet', 'vet': 'vet',
      // Grooming
      'grooming_salon': 'grooming', 'pet_groomer': 'grooming', 'groomer': 'grooming', 'groomer_solo': 'grooming', 'groomer_center': 'grooming', 'grooming_solo': 'grooming',
      // Training
      'trainer': 'training', 'pet_trainer': 'training', 'trainer_solo': 'training', 'trainer_center': 'training', 'training_solo': 'training', 'solo': 'training',
      // Walker
      'dog_walker': 'walker', 'pet_walker': 'walker', 'walker': 'walker', 'walker_solo': 'walker', 'walking': 'walker',
      // Boarding
      'boarding': 'boarding', 'boarding_resort': 'boarding', 'pet_boarding': 'boarding', 'pet_boarder': 'boarding', 'pet_daycare': 'boarding',
      // Nutrition
      'nutritionist': 'nutrition', 'pet_nutritionist': 'nutrition', 'nutritionist_center': 'nutrition', 'nutritionist_solo': 'nutrition',
      // Adoption
      'adoption_center': 'adoption', 'ngo': 'adoption', 'shelter': 'adoption', 'pet_shelter': 'adoption', 'pet_adoption_center': 'adoption',
      // Shop
      'seller': 'shop', 'pet_store': 'shop', 'pet_products_store': 'shop',
      // Diagnostics
      'diagnostics_center': 'diagnostics', 'diagnostics_provider': 'diagnostics', 'diagnostics_solo': 'diagnostics',
      // Others
      'pharmacy': 'pharmacy', 'pet_pharmacy': 'pharmacy',
      'cafe': 'cafes', 'pet_cafe': 'cafes',
      'photographer': 'photography', 'pet_photographer': 'photography',
      'insurance': 'insurance', 'pet_insurance': 'insurance',
      'ambulance': 'ambulance', 'pet_ambulance': 'ambulance',
      'breeder': 'breeder', 'pet_breeder': 'breeder',
      'relocation': 'relocation', 'pet_taxi': 'relocation', 'pet_transport': 'relocation', 'pet_relocation': 'relocation',
      'resort': 'resort', 'pet_resort': 'resort',
      'holiday': 'holiday',
      'sunset': 'sunset', 'pet_sunset_services': 'sunset',
      'event_organizer': 'events', 'pet_event_organizer': 'events',
      'behaviourist': 'behaviourist', 'pet_behaviourist': 'behaviourist', 'behaviourist_solo': 'behaviourist',
      'pet_sitter': 'sitting', 'sitter': 'sitting', 'sitter_solo': 'sitting',
    };

    const unmappedRoles = activeRoles.rows.filter(r => !roleCategoryMap[r.name] && !roleCategoryMap[r.name?.toLowerCase()]);
    
    if (unmappedRoles.length === 0) {
      console.log('✅ All active roles are mapped in getCategoryFromRole()');
    } else {
      console.log(`❌ ${unmappedRoles.length} active roles are NOT mapped:`);
      unmappedRoles.forEach(r => {
        console.log(`   - ${r.name} (${r.display_name})`);
      });
    }

    // 4. Check CATEGORY_ROLE_NAMES coverage
    console.log('\n\n📚 Step 4: CATEGORY_ROLE_NAMES Coverage');
    console.log('─'.repeat(80));
    
    const categoryRoleNames = {
      vet: ['veterinarian', 'vet_clinic', 'vet_solo', 'vet'],
      grooming: ['groomer', 'groomer_solo', 'groomer_center', 'grooming_solo', 'pet_groomer'],
      training: ['trainer', 'trainer_solo', 'trainer_center', 'training_solo', 'pet_trainer', 'solo'],
      walker: ['walker', 'walker_solo', 'pet_walker', 'dog_walker'],
      walking: ['walker', 'walker_solo', 'pet_walker', 'dog_walker'],
      boarding: ['boarding', 'pet_boarder', 'pet_daycare', 'pet_boarding'],
      nutrition: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
      nutritionist: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
      adoption: ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
      shop: ['seller', 'pet_products_store'],
      diagnostics: ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
      'lab-diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
      pharmacy: ['pharmacy', 'pet_pharmacy'],
      cafes: ['cafe', 'pet_cafe'],
      cafe: ['cafe', 'pet_cafe'],
      photography: ['photographer', 'pet_photographer'],
      insurance: ['insurance', 'pet_insurance'],
      ambulance: ['ambulance', 'pet_ambulance'],
      breeder: ['breeder', 'pet_breeder'],
      relocation: ['relocation', 'pet_taxi', 'pet_transport', 'pet_relocation'],
      resort: ['resort', 'pet_resort'],
      holiday: ['holiday'],
      sunset: ['sunset', 'pet_sunset_services'],
      events: ['event_organizer', 'pet_event_organizer'],
      behaviourist: ['behaviourist', 'behaviourist_solo', 'pet_behaviourist'],
      sitting: ['pet_sitter', 'sitter_solo', 'sitter'],
    };

    // Check which active roles are in CATEGORY_ROLE_NAMES
    const allCategoryRoles = new Set();
    Object.values(categoryRoleNames).forEach(roles => roles.forEach(r => allCategoryRoles.add(r.toLowerCase())));
    
    const notInCategoryRoles = activeRoles.rows.filter(r => !allCategoryRoles.has(r.name.toLowerCase()));
    
    if (notInCategoryRoles.length === 0) {
      console.log('✅ All active roles are in CATEGORY_ROLE_NAMES');
    } else {
      console.log(`❌ ${notInCategoryRoles.length} active roles are NOT in CATEGORY_ROLE_NAMES:`);
      notInCategoryRoles.forEach(r => {
        console.log(`   - ${r.name} (${r.display_name})`);
      });
    }

    // 5. Check discovery meta endpoint data
    console.log('\n\n🔎 Step 5: Discovery Meta - Discoverable Roles');
    console.log('─'.repeat(80));
    
    const discoverableRoles = await pool.query(`
      SELECT DISTINCT r.name AS role_name, r.display_name AS role_display_name
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      WHERE (v.status = 'approved' OR v.status = 'active')
        AND v.is_active = true
        AND EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = v.id AND vs.is_enabled = true
            AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
        )
      ORDER BY r.name
    `);
    
    console.log(`\nDiscoverable roles (vendors with active services): ${discoverableRoles.rows.length}`);
    discoverableRoles.rows.forEach(r => {
      const category = roleCategoryMap[r.role_name] || roleCategoryMap[r.role_name?.toLowerCase()] || 'unmapped';
      console.log(`  - ${r.role_name.padEnd(30)} | ${(r.role_display_name || '').padEnd(30)} | Category: ${category}`);
    });

    // 6. Check for vendors still on inactive roles
    console.log('\n\n⚠️  Step 6: Vendors on Inactive Roles (Should be ZERO)');
    console.log('─'.repeat(80));
    
    const vendorsOnInactive = await pool.query(`
      SELECT v.id, v.business_name, v.phone, r.name as role_name, r.is_active
      FROM vendors v
      JOIN roles r ON v.role_id = r.id
      WHERE r.is_active = false
        AND v.is_active = true
        AND (v.status = 'approved' OR v.status = 'active')
      ORDER BY r.name, v.business_name
      LIMIT 20
    `);
    
    if (vendorsOnInactive.rows.length === 0) {
      console.log('✅ No active vendors on inactive roles');
    } else {
      console.log(`❌ Found ${vendorsOnInactive.rows.length} active vendors on inactive roles:`);
      vendorsOnInactive.rows.forEach(v => {
        console.log(`   - ${v.business_name} (${v.phone}) | Role: ${v.role_name}`);
      });
    }

    // 7. Check by-style categoryRoles mapping
    console.log('\n\n🎨 Step 7: By-Style Endpoint CategoryRoles Mapping');
    console.log('─'.repeat(80));
    
    const byStyleCategories = {
      'vet': ['veterinarian', 'vet_clinic', 'vet_solo', 'vet', 'Veterinarian'],
      'grooming': ['groomer', 'grooming_salon', 'pet_groomer', 'groomer_center', 'groomer_solo', 'grooming_solo'],
      'training': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo', 'training_solo'],
      'nutritionist': ['nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo'],
      'nutrition': ['nutritionist', 'pet_nutritionist', 'nutritionist_center', 'nutritionist_solo'],
      'walker': ['walker', 'pet_walker', 'dog_walker', 'walker_solo'],
      'boarding': ['boarding', 'pet_boarder', 'pet_boarding'],
      'adoption': ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
      'shop': ['seller', 'pet_products_store'],
      'cafes': ['cafe', 'pet_cafe'],
      'cafe': ['cafe', 'pet_cafe'],
      'photography': ['photographer', 'pet_photographer'],
      'insurance': ['insurance', 'pet_insurance'],
      'ambulance': ['ambulance', 'pet_ambulance'],
      'breeder': ['breeder', 'pet_breeder'],
      'relocation': ['relocation', 'pet_taxi', 'pet_transport', 'pet_relocation'],
      'resort': ['resort', 'pet_resort'],
      'holiday': ['holiday'],
      'sunset': ['sunset', 'pet_sunset_services'],
      'behaviourist': ['behaviourist', 'pet_behaviourist', 'behaviourist_solo'],
      'sitting': ['pet_sitter', 'sitter', 'sitter_solo'],
      'diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
      'lab-diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
    };

    const allByStyleRoles = new Set();
    Object.values(byStyleCategories).forEach(roles => roles.forEach(r => allByStyleRoles.add(r.toLowerCase())));
    
    const notInByStyle = activeRoles.rows.filter(r => !allByStyleRoles.has(r.name.toLowerCase()));
    
    if (notInByStyle.length === 0) {
      console.log('✅ All active roles are in by-style categoryRoles mapping');
    } else {
      console.log(`❌ ${notInByStyle.length} active roles are NOT in by-style mapping:`);
      notInByStyle.forEach(r => {
        console.log(`   - ${r.name} (${r.display_name})`);
      });
    }

    console.log('\n\n✅ Forensic Validation Complete!\n');

  } catch (error) {
    console.error('❌ Error during validation:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
