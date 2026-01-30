#!/usr/bin/env node
/**
 * List Staff Members and Their Enabled Services for at_home and tele styles
 * Uses direct PostgreSQL connection to query staff and their services
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

async function listStaffServices() {
  console.log('📊 Fetching staff members and their enabled services for at_home and tele styles...\n');

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

    // First check if service_styles column exists
    const checkColumn = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_services' AND column_name = 'service_styles'
      )
    `);
    const hasServiceStyles = checkColumn.rows[0]?.exists || false;

    let query;
    if (hasServiceStyles) {
      // Use service_styles array column
      query = `
        SELECT DISTINCT
          s.id as staff_id,
          s.name as staff_name,
          s.phone,
          s.email,
          s.role,
          s.is_active as staff_active,
          v.id as vendor_id,
          v.business_name,
          v.status as vendor_status,
          ss.service_id,
          COALESCE(srv.name, ss.service_id::text) as service_name,
          COALESCE(srv.category, 'N/A') as service_category,
          $1 as service_style,
          ss.is_active as service_enabled,
          COALESCE(ss.price, srv.price) as custom_price,
          COALESCE(ss.duration_minutes, srv.duration_minutes) as custom_duration,
          ss.service_styles,
          ss.created_at as service_enabled_at
        FROM staff s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        INNER JOIN staff_services ss ON s.id = ss.staff_id
        LEFT JOIN services srv ON ss.service_id = srv.id
        WHERE 
          s.is_active = true
          AND ss.is_active = true
          AND $1 = ANY(ss.service_styles)
          AND (v.id IS NULL OR (v.status = 'approved' AND v.is_active = true))
        ORDER BY 
          v.business_name NULLS LAST,
          s.name,
          COALESCE(srv.name, ss.service_id::text);
      `;
    } else {
      // Fallback: Query via vendor_services for the vendor that staff belongs to
      query = `
        SELECT DISTINCT
          s.id as staff_id,
          s.name as staff_name,
          s.phone,
          s.email,
          s.role,
          s.is_active as staff_active,
          v.id as vendor_id,
          v.business_name,
          v.status as vendor_status,
          ss.service_id,
          COALESCE(srv.name, ss.service_id::text) as service_name,
          COALESCE(srv.category, 'N/A') as service_category,
          vs.service_style,
          ss.is_active as service_enabled,
          COALESCE(ss.price, vs.custom_price, srv.price) as custom_price,
          COALESCE(ss.duration_minutes, vs.custom_duration, srv.duration_minutes) as custom_duration,
          ss.created_at as service_enabled_at
        FROM staff s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        INNER JOIN staff_services ss ON s.id = ss.staff_id
        LEFT JOIN services srv ON ss.service_id = srv.id
        INNER JOIN vendor_services vs ON vs.vendor_id = COALESCE(s.vendor_id, s.id) AND vs.service_id = ss.service_id
        WHERE 
          s.is_active = true
          AND ss.is_active = true
          AND vs.service_style = $1
          AND vs.is_enabled = true
          AND (v.id IS NULL OR (v.status = 'approved' AND v.is_active = true))
        ORDER BY 
          v.business_name NULLS LAST,
          s.name,
          vs.service_style,
          COALESCE(srv.name, ss.service_id::text);
      `;
    }

    // Query for at_home services
    console.log(`🔍 Querying at_home services (using ${hasServiceStyles ? 'service_styles array' : 'vendor_services'} method)...\n`);
    const atHomeResult = await client.query(query, ['at_home']);
    const atHomeRows = atHomeResult.rows;

    // Query for tele services
    console.log(`🔍 Querying tele services (using ${hasServiceStyles ? 'service_styles array' : 'vendor_services'} method)...\n`);
    const teleResult = await client.query(query, ['tele']);
    const teleRows = teleResult.rows;

    const allRows = [...atHomeRows, ...teleRows];

    if (allRows.length === 0) {
      console.log('❌ No staff members with enabled at_home or tele services found.\n');
      return;
    }

    console.log(`✅ Found ${allRows.length} enabled services for staff members:\n`);
    console.log(`   - at_home: ${atHomeRows.length} service(s)`);
    console.log(`   - tele: ${teleRows.length} service(s)\n`);
    console.log('═'.repeat(120));
    
    // Group by staff member
    const staffMap = new Map();
    allRows.forEach(row => {
      const staffId = row.staff_id;
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staff_id: staffId,
          staff_name: row.staff_name || 'N/A',
          phone: row.phone || 'N/A',
          email: row.email || 'N/A',
          role: row.role || 'N/A',
          staff_active: row.staff_active,
          vendor_id: row.vendor_id,
          business_name: row.business_name || 'N/A',
          vendor_status: row.vendor_status || 'N/A',
          services: []
        });
      }
      staffMap.get(staffId).services.push({
        service_id: row.service_id,
        service_name: row.service_name || 'N/A',
        service_category: row.service_category || 'N/A',
        service_style: row.service_style || 'N/A',
        is_enabled: row.service_enabled,
        custom_price: row.custom_price,
        custom_duration: row.custom_duration,
        publish_status: 'N/A', // staff_services doesn't have publish_status
        service_styles: row.service_styles || null,
        service_enabled_at: row.service_enabled_at
      });
    });

    // Display results
    let staffIndex = 1;
    staffMap.forEach((staff, staffId) => {
      console.log(`\n${staffIndex}. STAFF: ${staff.staff_name}`);
      console.log(`   ID: ${staff.staff_id}`);
      console.log(`   Phone: ${staff.phone} | Email: ${staff.email || 'N/A'}`);
      console.log(`   Role: ${staff.role}`);
      console.log(`   Status: ${staff.staff_active ? 'Active' : 'Inactive'}`);
      if (staff.vendor_id) {
        console.log(`   Vendor: ${staff.business_name} (${staff.vendor_id})`);
        console.log(`   Vendor Status: ${staff.vendor_status}`);
      } else {
        console.log(`   Type: Individual Provider (no vendor)`);
      }
      console.log(`   Enabled Services: ${staff.services.length}`);
      console.log('   ' + '─'.repeat(110));
      
      // Group services by style
      const servicesByStyle = new Map();
      staff.services.forEach(service => {
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
          if (service.service_styles && Array.isArray(service.service_styles)) {
            console.log(`         Service Styles: ${service.service_styles.join(', ')}`);
          }
        });
      });
      
      console.log('   ' + '─'.repeat(110));
      staffIndex++;
    });

    console.log(`\n\n📊 SUMMARY:`);
    console.log(`   Total Staff Members: ${staffMap.size}`);
    console.log(`   Total Enabled Services: ${allRows.length}`);
    
    // Count by service style
    const styleCounts = new Map();
    allRows.forEach(row => {
      const style = row.service_style || 'unknown';
      styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
    });
    
    console.log(`\n   Services by Style:`);
    styleCounts.forEach((count, style) => {
      console.log(`      ${style}: ${count} service(s)`);
    });

    // Count by vendor association
    const withVendor = Array.from(staffMap.values()).filter(s => s.vendor_id).length;
    const individualProviders = Array.from(staffMap.values()).filter(s => !s.vendor_id).length;
    console.log(`\n   Staff by Type:`);
    console.log(`      With Vendor/Clinic: ${withVendor}`);
    console.log(`      Individual Providers: ${individualProviders}`);

  } catch (error) {
    console.error('❌ Error executing query:', error.message);
    console.error('\n💡 Make sure you have:');
    console.error('   1. AWS credentials configured');
    console.error('   2. DB_HOST, DB_NAME, and DB_SECRET_ARN environment variables set');
    console.error('   3. Proper IAM permissions to access Secrets Manager');
  } finally {
    if (client) {
      await client.end();
      console.log('\n✅ Database connection closed.');
    }
  }
}

listStaffServices();
