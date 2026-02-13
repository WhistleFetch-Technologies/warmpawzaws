#!/usr/bin/env node
/**
 * Script to check for vendors with at_center services in the database
 */

const { Pool } = require('pg');

const DB_HOST = process.env.DB_HOST || 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'warmpawz';
const DB_USER = process.env.DB_USER || 'warmpawz_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Warmpawz2026';

async function checkVendors() {
  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: false,
  });

  try {
    console.log('🔍 Checking for vendors with at_center services...\n');

    // 1. Check vendors with at_center services
    const vendorsWithServices = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.status,
        v.is_active,
        r.name as role_name,
        r.display_name as role_display_name,
        COUNT(vs.id) as service_count
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      INNER JOIN vendor_services vs ON vs.vendor_id = v.id
      WHERE vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
        AND vs.is_enabled = true
        AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      GROUP BY v.id, v.business_name, v.status, v.is_active, r.name, r.display_name
      ORDER BY v.business_name
      LIMIT 20
    `);

    console.log(`✅ Found ${vendorsWithServices.rows.length} vendors with at_center services:\n`);
    vendorsWithServices.rows.forEach((v, i) => {
      console.log(`${i + 1}. ${v.business_name} (${v.role_name})`);
      console.log(`   Status: ${v.status}, Active: ${v.is_active}, Services: ${v.service_count}`);
    });

    // 2. Check approved/active vendors with at_center services
    const approvedVendors = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.status,
        v.is_active,
        r.name as role_name,
        COUNT(vs.id) as service_count
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      INNER JOIN vendor_services vs ON vs.vendor_id = v.id
      WHERE (v.status = 'approved' OR v.status = 'active')
        AND v.is_active = true
        AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
        AND vs.is_enabled = true
        AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        AND LOWER(r.name) NOT LIKE '%solo%'
      GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
      ORDER BY v.business_name
      LIMIT 20
    `);

    console.log(`\n✅ Found ${approvedVendors.rows.length} approved/active vendors with at_center services (non-solo):\n`);
    approvedVendors.rows.forEach((v, i) => {
      console.log(`${i + 1}. ${v.business_name} (${v.role_name})`);
      console.log(`   ID: ${v.id}, Services: ${v.service_count}`);
    });

    // 3. Check vendor_availability_v2 for these vendors
    if (approvedVendors.rows.length > 0) {
      const vendorIds = approvedVendors.rows.map(v => v.id);
      const availabilityCheck = await pool.query(`
        SELECT 
          va.vendor_id,
          v.business_name,
          COUNT(va.id) as availability_slots,
          array_agg(DISTINCT va.service_styles) as service_styles_array
        FROM vendor_availability_v2 va
        INNER JOIN vendors v ON va.vendor_id = v.id
        WHERE va.vendor_id = ANY($1::uuid[])
          AND (va.is_available IS NULL OR va.is_available = true)
        GROUP BY va.vendor_id, v.business_name
      `, [vendorIds]);

      console.log(`\n✅ Availability check for ${approvedVendors.rows.length} vendors:\n`);
      availabilityCheck.rows.forEach((v, i) => {
        console.log(`${i + 1}. ${v.business_name}`);
        console.log(`   Slots: ${v.availability_slots}, Service Styles: ${JSON.stringify(v.service_styles_array)}`);
      });

      // 4. Check if service_styles array contains at_center
      const withMatchingStyles = await pool.query(`
        SELECT 
          va.vendor_id,
          v.business_name,
          va.service_styles,
          COUNT(va.id) as matching_slots
        FROM vendor_availability_v2 va
        INNER JOIN vendors v ON va.vendor_id = v.id
        WHERE va.vendor_id = ANY($1::uuid[])
          AND (va.is_available IS NULL OR va.is_available = true)
          AND (COALESCE(va.service_styles, ARRAY[]::text[]) && ARRAY['at_center', 'at_vendor', 'at_clinic']::text[])
        GROUP BY va.vendor_id, v.business_name, va.service_styles
        LIMIT 10
      `, [vendorIds]);

      console.log(`\n✅ Vendors with matching service_styles in availability:\n`);
      withMatchingStyles.rows.forEach((v, i) => {
        console.log(`${i + 1}. ${v.business_name}`);
        console.log(`   Service Styles: ${JSON.stringify(v.service_styles)}, Matching Slots: ${v.matching_slots}`);
      });
    }

    // 5. Check vet category specifically
    const vetVendors = await pool.query(`
      SELECT 
        v.id,
        v.business_name,
        v.status,
        v.is_active,
        r.name as role_name,
        COUNT(vs.id) as service_count
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      INNER JOIN vendor_services vs ON vs.vendor_id = v.id
      WHERE (v.status = 'approved' OR v.status = 'active')
        AND v.is_active = true
        AND LOWER(r.name) IN ('vet_clinic', 'veterinarian', 'vet')
        AND LOWER(r.name) NOT LIKE '%solo%'
        AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
        AND vs.is_enabled = true
        AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
      ORDER BY v.business_name
    `);

    console.log(`\n✅ Vet category vendors with at_center services:\n`);
    vetVendors.rows.forEach((v, i) => {
      console.log(`${i + 1}. ${v.business_name} (${v.role_name})`);
      console.log(`   ID: ${v.id}, Services: ${v.service_count}`);
    });

    // 6. Check if these vet vendors have availability
    if (vetVendors.rows.length > 0) {
      const vetIds = vetVendors.rows.map(v => v.id);
      const vetAvailability = await pool.query(`
        SELECT 
          va.vendor_id,
          v.business_name,
          COUNT(va.id) as availability_slots,
          COUNT(CASE WHEN COALESCE(va.service_styles, ARRAY[]::text[]) && ARRAY['at_center', 'at_vendor', 'at_clinic']::text[] THEN 1 END) as matching_slots
        FROM vendor_availability_v2 va
        INNER JOIN vendors v ON va.vendor_id = v.id
        WHERE va.vendor_id = ANY($1::uuid[])
          AND (va.is_available IS NULL OR va.is_available = true)
        GROUP BY va.vendor_id, v.business_name
      `, [vetIds]);

      console.log(`\n✅ Vet vendors availability:\n`);
      vetAvailability.rows.forEach((v, i) => {
        console.log(`${i + 1}. ${v.business_name}`);
        console.log(`   Total Slots: ${v.availability_slots}, Matching Slots: ${v.matching_slots}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkVendors();
