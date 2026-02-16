#!/usr/bin/env node
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = 'prod';
const REGION = 'ap-south-1';

async function test() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));

  const cluster = clusterInfo.DBClusters[0];
  const endpoint = cluster.Endpoint;
  const port = cluster.Port || '5432';
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
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
  });

  try {
    const vendorId = '13b59aea-00a8-4679-bfc9-c0e211a160a0';
    const targetRolesLower = ['vet_solo'];
    const acceptableServiceStyles = ['tele', 'online', 'video_consultation'];
    const styleParamIndex = '2';
    
    // Check which columns exist
    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'vendors' AND table_schema = 'public'
      ORDER BY column_name
    `);
    const vendorColumns = new Set(columns.rows.map(r => r.column_name));
    
    console.log('Testing full Lambda query with all columns...\n');
    
    // Build query with conditional columns (like Lambda does)
    const hasLogoUrl = vendorColumns.has('logo_url');
    const hasLanguages = vendorColumns.has('languages');
    const hasIsVerified = vendorColumns.has('is_verified');
    const hasProfileImage = vendorColumns.has('profile_image');
    
    const logoColumn = hasLogoUrl ? 'v.logo_url' : 'NULL';
    const languagesColumn = hasLanguages ? 'v.languages' : 'NULL';
    const isVerifiedColumn = hasIsVerified ? 'v.is_verified' : 'NULL';
    const profileImageColumn = hasProfileImage ? 'v.profile_image' : 'NULL';
    
    console.log('Column checks:');
    console.log(`  logo_url: ${hasLogoUrl ? '✅' : '❌'}`);
    console.log(`  languages: ${hasLanguages ? '✅' : '❌'}`);
    console.log(`  is_verified: ${hasIsVerified ? '✅' : '❌'}`);
    console.log(`  profile_image: ${hasProfileImage ? '✅' : '❌'}`);
    
    const vendorQuery = `
      SELECT DISTINCT v.id, v.business_name, v.owner_name, v.phone, v.city, v.state,
             v.latitude, v.longitude, r.name as role_name, r.display_name as role_display_name,
             ${languagesColumn} as languages, ${isVerifiedColumn} as is_verified, v.profile_photo_url, ${profileImageColumn} as profile_image, ${logoColumn} as logo_url, v.specializations, v.is_online,
             v.vendor_type, v.metadata, r.config as role_config,
             v.service_radius,
             (SELECT MIN(vs.service_radius_km) FROM vendor_services vs
              WHERE vs.vendor_id = v.id AND vs.is_enabled = true
                AND vs.service_style = 'at_home') AS service_radius_km_min_home
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE (v.status = 'approved' OR v.status = 'active')
        AND v.is_active = true
        AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
        AND EXISTS (
          SELECT 1 FROM vendor_availability_v2 va
          WHERE va.vendor_id::text = v.id::text
            AND (va.is_available IS NULL OR va.is_available = true)
            AND (COALESCE(va.service_styles, ARRAY[]::text[]) && $2::text[])
        )
        AND (
          v.vendor_type = 'solo'
          OR LOWER(COALESCE(r.name, '')) LIKE '%_solo%'
          OR LOWER(COALESCE(r.name, '')) LIKE '%solo%'
          OR LOWER(COALESCE(r.name, '')) IN ('walker','pet_walker','dog_walker','pet_sitter','sitter','pet_taxi','pet_transport','pet_relocation','relocation')
        )
        AND r.id IS NOT NULL AND (LOWER(r.name) = ANY($1::text[]) OR LOWER(REPLACE(COALESCE(r.name, ''), ' ', '_')) = ANY($1::text[]))
        AND EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = v.id
            AND vs.service_style = ANY($2::text[])
            AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )
        AND v.id = $3
      LIMIT 200
    `;
    
    console.log('\nExecuting full query...');
    const result = await pool.query(vendorQuery, [targetRolesLower, acceptableServiceStyles, vendorId]);
    
    console.log(`\nQuery result: ${result.rows.length} vendor(s)`);
    if (result.rows.length > 0) {
      console.log(`✅ Vendor found: ${result.rows[0].business_name}`);
    } else {
      console.log('❌ Vendor NOT found');
    }
    
  } catch (error) {
    console.error('❌ Query error:', error.message);
    console.error('Error code:', error.code);
    if (error.position) {
      console.error('Error position:', error.position);
    }
  } finally {
    await pool.end();
  }
}

test().catch(console.error);
