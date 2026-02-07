#!/usr/bin/env node
/**
 * Diagnostic script for vendor 8123456780
 * Runs the diagnostic query to identify why the vendor is not appearing
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const VENDOR_PHONE = '8123456780';

async function diagnoseVendor() {
  console.log('🔍 Diagnostic Check: Vendor 8123456780');
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
    // Main diagnostic query
    console.log('📊 Running Main Diagnostic Query...');
    console.log('─────────────────────────────────────────────\n');
    
    const diagnosticQuery = `
      SELECT 
        -- Vendor Basic Info
        v.id,
        v.phone,
        v.status,
        v.is_active,
        v.metadata->>'vendorConfiguration' as vendor_configuration,
        v.role_id,
        
        -- Role Configuration
        r.name as role_name,
        r.display_name as role_display_name,
        r.config->>'vendorConfiguration' as role_vendor_config,
        r.config->'vendorTypes' as role_vendor_types,
        
        -- Service Counts (at_home and tele)
        (SELECT COUNT(*) 
         FROM vendor_services vs 
         WHERE vs.vendor_id = v.id 
           AND vs.service_style IN ('at_home', 'tele') 
           AND vs.is_enabled = true 
           AND vs.publish_status = 'published'
        ) as services_count_at_home_tele,
        
        -- Individual Service Details
        (SELECT COUNT(*) 
         FROM vendor_services vs 
         WHERE vs.vendor_id = v.id 
           AND vs.service_style = 'at_home' 
           AND vs.is_enabled = true 
           AND vs.publish_status = 'published'
        ) as services_count_at_home,
        
        (SELECT COUNT(*) 
         FROM vendor_services vs 
         WHERE vs.vendor_id = v.id 
           AND vs.service_style = 'tele' 
           AND vs.is_enabled = true 
           AND vs.publish_status = 'published'
        ) as services_count_tele,
        
        -- Schedule Configuration
        (SELECT COUNT(*) 
         FROM vendor_availability_v2 va 
         WHERE va.vendor_id = v.id
        ) as availability_count,
        
        0 as schedule_slots_count,
        
        -- Diagnostic Checks
        CASE 
          WHEN v.status = 'approved' AND v.is_active = true THEN '✅ Status OK'
          ELSE '❌ Status Issue'
        END as status_check,
        
        CASE 
          WHEN r.name LIKE '%_solo' 
               OR (v.metadata->>'vendorConfiguration')::text = 'solo'
               OR r.config->>'vendorConfiguration' = 'solo'
               OR (r.config->'vendorTypes' @> '["solo"]'::jsonb)
          THEN '✅ Solo Vendor Detected'
          ELSE '❌ Not Detected as Solo'
        END as solo_check,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM vendor_services vs 
                WHERE vs.vendor_id = v.id 
                  AND vs.service_style IN ('at_home', 'tele') 
                  AND vs.is_enabled = true 
                  AND vs.publish_status = 'published') > 0
          THEN '✅ Services Published'
          ELSE '❌ No Published Services'
        END as services_check,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id) > 0
          THEN '✅ Schedule Configured'
          ELSE '❌ Schedule NOT Configured'
        END as schedule_check,
        
        -- Final Verdict
        CASE 
          WHEN v.status = 'approved' 
            AND v.is_active = true
            AND (r.name LIKE '%_solo' 
                 OR (v.metadata->>'vendorConfiguration')::text = 'solo'
                 OR r.config->>'vendorConfiguration' = 'solo'
                 OR (r.config->'vendorTypes' @> '["solo"]'::jsonb))
            AND (SELECT COUNT(*) FROM vendor_services vs 
                 WHERE vs.vendor_id = v.id 
                   AND vs.service_style IN ('at_home', 'tele') 
                   AND vs.is_enabled = true 
                   AND vs.publish_status = 'published') > 0
            AND (SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id) > 0
          THEN '✅ SHOULD APPEAR'
          ELSE '❌ WILL NOT APPEAR - Check failing conditions above'
        END as final_verdict
        
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.phone = $1
    `;
    
    const result = await pool.query(diagnosticQuery, [VENDOR_PHONE]);
    
    if (result.rows.length === 0) {
      console.log('❌ Vendor not found with phone:', VENDOR_PHONE);
      console.log('\n⚠️  This means the vendor does not exist in the database.');
      await pool.end();
      return;
    }
    
    const vendor = result.rows[0];
    
    // Display results
    console.log('📋 VENDOR BASIC INFO:');
    console.log('─────────────────────────────────────────────');
    console.log(`ID: ${vendor.id}`);
    console.log(`Phone: ${vendor.phone}`);
    console.log(`Status: ${vendor.status}`);
    console.log(`Is Active: ${vendor.is_active}`);
    console.log(`Vendor Configuration: ${vendor.vendor_configuration || 'NULL'}`);
    console.log(`Role ID: ${vendor.role_id}`);
    console.log('');
    
    console.log('📋 ROLE CONFIGURATION:');
    console.log('─────────────────────────────────────────────');
    console.log(`Role Name: ${vendor.role_name || 'NULL'}`);
    console.log(`Role Display Name: ${vendor.role_display_name || 'NULL'}`);
    console.log(`Role Vendor Config: ${vendor.role_vendor_config || 'NULL'}`);
    console.log(`Role Vendor Types: ${JSON.stringify(vendor.role_vendor_types) || 'NULL'}`);
    console.log('');
    
    console.log('📋 SERVICE COUNTS:');
    console.log('─────────────────────────────────────────────');
    console.log(`at_home + tele: ${vendor.services_count_at_home_tele}`);
    console.log(`at_home only: ${vendor.services_count_at_home}`);
    console.log(`tele only: ${vendor.services_count_tele}`);
    console.log('');
    
    console.log('📋 SCHEDULE CONFIGURATION:');
    console.log('─────────────────────────────────────────────');
    console.log(`vendor_availability_v2 count: ${vendor.availability_count}`);
    console.log(`vendor_schedule_slots count: ${vendor.schedule_slots_count}`);
    console.log('');
    
    console.log('🔍 DIAGNOSTIC CHECKS:');
    console.log('─────────────────────────────────────────────');
    console.log(`Status Check: ${vendor.status_check}`);
    console.log(`Solo Check: ${vendor.solo_check}`);
    console.log(`Services Check: ${vendor.services_check}`);
    console.log(`Schedule Check: ${vendor.schedule_check}`);
    console.log('');
    
    console.log('🎯 FINAL VERDICT:');
    console.log('─────────────────────────────────────────────');
    console.log(`${vendor.final_verdict}`);
    console.log('');
    
    // Check service details
    console.log('📋 SERVICE DETAILS:');
    console.log('─────────────────────────────────────────────');
    const servicesResult = await pool.query(`
      SELECT 
        vs.id,
        vs.service_name,
        vs.service_style,
        vs.is_enabled,
        vs.publish_status,
        vs.price,
        vs.duration_minutes,
        CASE 
          WHEN vs.is_enabled = true AND vs.publish_status = 'published' 
          THEN '✅ Ready'
          ELSE '❌ Not Ready'
        END as service_status
      FROM vendors v
      JOIN vendor_services vs ON vs.vendor_id = v.id
      WHERE v.phone = $1
        AND vs.service_style IN ('at_home', 'tele')
      ORDER BY vs.service_style, vs.service_name
    `, [VENDOR_PHONE]);
    
    if (servicesResult.rows.length === 0) {
      console.log('No at_home or tele services found.\n');
    } else {
      servicesResult.rows.forEach((service, idx) => {
        console.log(`\n${idx + 1}. ${service.service_name} (${service.service_style})`);
        console.log(`   Status: ${service.service_status}`);
        console.log(`   Enabled: ${service.is_enabled}`);
        console.log(`   Published: ${service.publish_status}`);
        console.log(`   Price: ${service.price || 'N/A'}`);
        console.log(`   Duration: ${service.duration_minutes || 'N/A'} minutes`);
      });
      console.log('');
    }
    
    // Check schedule details
    console.log('📋 SCHEDULE DETAILS:');
    console.log('─────────────────────────────────────────────');
    const scheduleResult = await pool.query(`
      SELECT 
        'vendor_availability_v2' as schedule_type,
        COUNT(*) as count
      FROM vendors v
      JOIN vendor_availability_v2 va ON va.vendor_id = v.id
      WHERE v.phone = $1
    `, [VENDOR_PHONE]);
    
    if (scheduleResult.rows.length === 0) {
      console.log('No schedule configuration found.\n');
    } else {
      scheduleResult.rows.forEach(row => {
        console.log(`${row.schedule_type}: ${row.count} entries`);
      });
      console.log('');
    }
    
    // Summary
    console.log('═════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═════════════════════════════════════════════');
    const issues = [];
    if (vendor.status_check.includes('❌')) issues.push('Status Issue');
    if (vendor.solo_check.includes('❌')) issues.push('Not Detected as Solo');
    if (vendor.services_check.includes('❌')) issues.push('No Published Services');
    if (vendor.schedule_check.includes('❌')) issues.push('Schedule NOT Configured');
    
    if (issues.length === 0) {
      console.log('✅ All checks passed! Vendor should appear in service discovery.');
    } else {
      console.log('❌ Issues found:');
      issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
      console.log('\n💡 The first issue listed is the root cause.');
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Error running diagnostic query:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('✅ Diagnostic complete!');
  }
}

diagnoseVendor().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
