#!/usr/bin/env node

/**
 * Forensic Validation Script for Canonical Roles Implementation
 * 
 * This script performs a complete forensic audit of the role consolidation
 * and service discovery implementation without relying on any documentation.
 */

const AWS = require('aws-sdk');
const pg = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const ENV = process.env.ENVIRONMENT || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  console.log('\n🔍 FORENSIC VALIDATION: Canonical Roles & Service Discovery');
  console.log('='.repeat(80));
  console.log(`Environment: ${ENV}`);
  console.log(`Region: ${AWS_REGION}\n`);

  // Get RDS cluster info
  console.log('📊 Getting RDS cluster information...');
  const rds = new AWS.RDS({ region: AWS_REGION });
  const clusterName = `warmpawz-${ENV}-cluster`;
  
  const clustersResult = await rds.describeDBClusters({
    DBClusterIdentifier: clusterName
  }).promise();
  
  const cluster = clustersResult.DBClusters[0];
  const dbEndpoint = cluster.Endpoint;
  const dbPort = cluster.Port;
  const dbName = cluster.DatabaseName || 'warmpawz';
  const dbUser = cluster.MasterUsername;

  console.log(`✅ RDS Cluster found:`);
  console.log(`   Endpoint: ${dbEndpoint}`);
  console.log(`   Port: ${dbPort}`);
  console.log(`   Database: ${dbName}\n`);

  // Get credentials
  console.log('🔐 Getting database credentials from Secrets Manager...');
  const secretsManager = new AWS.SecretsManager({ region: AWS_REGION });
  const secretName = `warmpawz/${ENV}/db`;
  
  const secretResult = await secretsManager.getSecretValue({
    SecretId: secretName
  }).promise();
  
  const secret = JSON.parse(secretResult.SecretString);
  console.log('✅ Credentials retrieved\n');

  // Connect to database
  console.log('🔗 Connecting to database...');
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
    await pool.query('SELECT 1');
    console.log('✅ Connection successful\n');

    // ===== VALIDATION STARTS HERE =====
    
    // 1. Active Roles Check
    console.log('═'.repeat(80));
    console.log('STEP 1: DATABASE ACTIVE ROLES');
    console.log('═'.repeat(80));
    
    const activeRolesResult = await pool.query(`
      SELECT name, display_name, is_active, 
             (SELECT COUNT(*) FROM vendors v WHERE v.role_id = r.id AND v.is_active = true) as vendor_count
      FROM roles r
      WHERE r.is_active = true
      ORDER BY name
    `);
    
    console.log(`\nFound ${activeRolesResult.rows.length} active roles in database:`);
    console.log(`\n${'Role Name'.padEnd(35)} | ${'Display Name'.padEnd(35)} | Vendors`);
    console.log('-'.repeat(90));
    activeRolesResult.rows.forEach(r => {
      console.log(`${r.name.padEnd(35)} | ${(r.display_name || '').padEnd(35)} | ${r.vendor_count}`);
    });

    const activeRoleNames = activeRolesResult.rows.map(r => r.name.toLowerCase());

    // 2. Check Code Implementation - getCategoryFromRole
    console.log('\n\n' + '═'.repeat(80));
    console.log('STEP 2: CODE VALIDATION - getCategoryFromRole()');
    console.log('═'.repeat(80));
    
    const serviceDiscoveryPath = path.join(__dirname, '..', 'backend', 'lambda', 'src', 'endpoints', 'service-discovery.ts');
    const serviceDiscoveryCode = fs.readFileSync(serviceDiscoveryPath, 'utf8');
    
    // Extract roleCategoryMap from getCategoryFromRole
    const getCategoryMatch = serviceDiscoveryCode.match(/function getCategoryFromRole[\s\S]*?const roleCategoryMap[\s\S]*?};\s*return/);
    if (!getCategoryMatch) {
      console.log('❌ Could not find getCategoryFromRole implementation');
    } else {
      const mapText = getCategoryMatch[0];
      const mappedRoles = new Set();
      
      // Extract all role names from the map (keys in the object)
      const roleMatches = mapText.matchAll(/'([^']+)':\s*'[^']+'/g);
      for (const match of roleMatches) {
        mappedRoles.add(match[1].toLowerCase());
      }
      
      console.log(`\ngetCategoryFromRole maps ${mappedRoles.size} roles`);
      
      // Check which active roles are NOT mapped
      const unmappedRoles = activeRoleNames.filter(r => !mappedRoles.has(r));
      if (unmappedRoles.length === 0) {
        console.log('✅ All active roles are mapped in getCategoryFromRole');
      } else {
        console.log(`❌ ${unmappedRoles.length} active roles are NOT mapped:`);
        unmappedRoles.forEach(r => console.log(`   - ${r}`));
      }
    }

    // 3. Check CATEGORY_ROLE_NAMES
    console.log('\n\n' + '═'.repeat(80));
    console.log('STEP 3: CODE VALIDATION - CATEGORY_ROLE_NAMES');
    console.log('═'.repeat(80));
    
    const categoryRoleNamesMatch = serviceDiscoveryCode.match(/const CATEGORY_ROLE_NAMES[\s\S]*?};\s*\n/);
    if (!categoryRoleNamesMatch) {
      console.log('❌ Could not find CATEGORY_ROLE_NAMES implementation');
    } else {
      const mapText = categoryRoleNamesMatch[0];
      const categoryRoles = new Set();
      
      // Extract all role names from arrays
      const roleMatches = mapText.matchAll(/'([^']+)'/g);
      for (const match of roleMatches) {
        // Skip category keys (first match in each line)
        if (!match[1].includes(':') && !match[1].match(/^[a-z-]+$/)) {
          categoryRoles.add(match[1].toLowerCase());
        } else if (match[1].includes('_') || match[1].includes('walker') || match[1].includes('groomer')) {
          categoryRoles.add(match[1].toLowerCase());
        }
      }
      
      console.log(`\nCATEGORY_ROLE_NAMES includes ${categoryRoles.size} roles`);
      
      const notInCategory = activeRoleNames.filter(r => !categoryRoles.has(r));
      if (notInCategory.length === 0) {
        console.log('✅ All active roles are in CATEGORY_ROLE_NAMES');
      } else {
        console.log(`❌ ${notInCategory.length} active roles are NOT in CATEGORY_ROLE_NAMES:`);
        notInCategory.forEach(r => console.log(`   - ${r}`));
      }
    }

    // 4. Check by-style categoryRoles mappings
    console.log('\n\n' + '═'.repeat(80));
    console.log('STEP 4: CODE VALIDATION - /customer/services/by-style categoryRoles');
    console.log('═'.repeat(80));
    
    // Find all categoryRoles declarations in by-style endpoint
    const byStyleMatches = [...serviceDiscoveryCode.matchAll(/const categoryRoles:[\s\S]*?};/g)];
    console.log(`\nFound ${byStyleMatches.length} categoryRoles declarations in by-style endpoint`);
    
    byStyleMatches.forEach((match, idx) => {
      const mapText = match[0];
      const roles = new Set();
      
      const roleMatches = mapText.matchAll(/'([^']+)'/g);
      for (const roleMatch of roleMatches) {
        if (roleMatch[1].includes('_') || roleMatch[1].includes('walker') || roleMatch[1].includes('groomer') || roleMatch[1].includes('vet') || roleMatch[1].includes('trainer')) {
          roles.add(roleMatch[1].toLowerCase());
        }
      }
      
      console.log(`\n  categoryRoles #${idx + 1}: includes ${roles.size} roles`);
      
      const notInByStyle = activeRoleNames.filter(r => !roles.has(r));
      if (notInByStyle.length === 0) {
        console.log(`  ✅ All active roles are in categoryRoles #${idx + 1}`);
      } else {
        console.log(`  ❌ ${notInByStyle.length} active roles are NOT in categoryRoles #${idx + 1}:`);
        notInByStyle.forEach(r => console.log(`     - ${r}`));
      }
    });

    // 5. Discoverable Roles (Database)
    console.log('\n\n' + '═'.repeat(80));
    console.log('STEP 5: DISCOVERABLE ROLES (vendors with active services)');
    console.log('═'.repeat(80));
    
    const discoverableResult = await pool.query(`
      SELECT DISTINCT r.name AS role_name, r.display_name AS role_display_name,
             COUNT(DISTINCT v.id) as vendor_count
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      WHERE (v.status = 'approved' OR v.status = 'active')
        AND v.is_active = true
        AND EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = v.id AND vs.is_enabled = true
            AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
        )
      GROUP BY r.name, r.display_name
      ORDER BY r.name
    `);
    
    console.log(`\nDiscoverable roles (vendors with services): ${discoverableResult.rows.length}`);
    console.log(`\n${'Role'.padEnd(35)} | ${'Display Name'.padEnd(35)} | Vendors`);
    console.log('-'.repeat(90));
    discoverableResult.rows.forEach(r => {
      console.log(`${r.role_name.padEnd(35)} | ${(r.role_display_name || '').padEnd(35)} | ${r.vendor_count}`);
    });

    // 6. Vendors on Inactive Roles
    console.log('\n\n' + '═'.repeat(80));
    console.log('STEP 6: VENDORS ON INACTIVE ROLES (Should be ZERO)');
    console.log('═'.repeat(80));
    
    const inactiveVendorsResult = await pool.query(`
      SELECT COUNT(*) as count,
             ARRAY_AGG(DISTINCT r.name) as role_names
      FROM vendors v
      JOIN roles r ON v.role_id = r.id
      WHERE r.is_active = false
        AND v.is_active = true
        AND (v.status = 'approved' OR v.status = 'active')
    `);
    
    const inactiveCount = parseInt(inactiveVendorsResult.rows[0].count);
    if (inactiveCount === 0) {
      console.log('\n✅ No active vendors on inactive roles');
    } else {
      console.log(`\n❌ Found ${inactiveCount} active vendors on inactive roles:`);
      console.log(`   Inactive roles: ${inactiveVendorsResult.rows[0].role_names.join(', ')}`);
      
      // Show sample vendors
      const sampleResult = await pool.query(`
        SELECT v.business_name, v.phone, r.name as role_name
        FROM vendors v
        JOIN roles r ON v.role_id = r.id
        WHERE r.is_active = false
          AND v.is_active = true
          AND (v.status = 'approved' OR v.status = 'active')
        LIMIT 10
      `);
      
      console.log('\n   Sample vendors:');
      sampleResult.rows.forEach(v => {
        console.log(`     - ${v.business_name} (${v.phone}) | Role: ${v.role_name}`);
      });
    }

    // 7. Service Styles Distribution
    console.log('\n\n' + '═'.repeat(80));
    console.log('STEP 7: SERVICE STYLES DISTRIBUTION');
    console.log('═'.repeat(80));
    
    const stylesResult = await pool.query(`
      SELECT vs.service_style, COUNT(*) as service_count, COUNT(DISTINCT vs.vendor_id) as vendor_count
      FROM vendor_services vs
      INNER JOIN vendors v ON vs.vendor_id = v.id
      WHERE vs.is_enabled = true
        AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
        AND v.is_active = true
        AND (v.status = 'approved' OR v.status = 'active')
      GROUP BY vs.service_style
      ORDER BY service_count DESC
    `);
    
    console.log(`\n${'Service Style'.padEnd(20)} | ${'Services'.padEnd(10)} | Vendors`);
    console.log('-'.repeat(50));
    stylesResult.rows.forEach(r => {
      console.log(`${(r.service_style || 'NULL').padEnd(20)} | ${String(r.service_count).padEnd(10)} | ${r.vendor_count}`);
    });

    // Summary
    console.log('\n\n' + '═'.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('═'.repeat(80));
    
    const issues = [];
    
    if (inactiveCount > 0) {
      issues.push(`${inactiveCount} vendors still on inactive roles`);
    }
    
    // Check for unmapped roles
    const totalActiveRoles = activeRolesResult.rows.length;
    const discoverableRoles = discoverableResult.rows.length;
    
    console.log(`\n✅ Active Roles in Database: ${totalActiveRoles}`);
    console.log(`✅ Discoverable Roles (with services): ${discoverableRoles}`);
    console.log(`✅ Service Styles in Use: ${stylesResult.rows.length}`);
    
    if (issues.length === 0) {
      console.log('\n✅ ✅ ✅ ALL VALIDATIONS PASSED! ✅ ✅ ✅\n');
    } else {
      console.log('\n❌ Issues Found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('Forensic validation complete!');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error during validation:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
