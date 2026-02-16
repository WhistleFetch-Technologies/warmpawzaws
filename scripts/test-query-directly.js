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
    
    // Build the EXACT query from Lambda (simplified version)
    const vendorQuery = `
      SELECT DISTINCT v.id, v.business_name, v.vendor_type, r.name as role_name, r.config as role_config
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
    
    console.log('Testing Lambda query directly...\n');
    console.log('Query params:', JSON.stringify([targetRolesLower, acceptableServiceStyles, vendorId]));
    
    const result = await pool.query(vendorQuery, [targetRolesLower, acceptableServiceStyles, vendorId]);
    
    console.log(`\nQuery result: ${result.rows.length} vendor(s)`);
    if (result.rows.length > 0) {
      const v = result.rows[0];
      console.log(`✅ Vendor found: ${v.business_name}`);
      console.log(`   Role: ${v.role_name}`);
      console.log(`   Type: ${v.vendor_type}`);
      console.log(`   Role config: ${v.role_config ? 'present' : 'missing'}`);
      
      // Test roleConfigAllowsStyle
      function normalizeServiceStyle(style) {
        if (!style) return null;
        const key = String(style).toLowerCase().trim().replace(/\s+/g, '_');
        const STYLE_ALIASES = {
          'at_clinic': 'at_center',
          'at_vendor': 'at_center',
          'video_consultation': 'tele',
          'online': 'tele',
          'home_visit': 'at_home',
        };
        return STYLE_ALIASES[key] || key;
      }
      
      function normalizeServiceStylesArray(styles) {
        if (!styles) return [];
        const arr = Array.isArray(styles) ? styles : (styles?.selected ?? styles?.solo ?? []);
        if (!Array.isArray(arr)) return [];
        const out = [];
        for (const s of arr) {
          const norm = normalizeServiceStyle(s);
          if (norm && !out.includes(norm)) out.push(norm);
        }
        return out;
      }
      
      function parseRoleConfig(roleConfig) {
        if (!roleConfig) return null;
        try {
          return typeof roleConfig === 'string' ? JSON.parse(roleConfig || '{}') : roleConfig;
        } catch {
          return null;
        }
      }
      
      function roleConfigAllowsStyle(roleConfig, serviceStyle) {
        const normalized = normalizeServiceStyle(serviceStyle || '') || '';
        if (!normalized) return true;
        const config = parseRoleConfig(roleConfig);
        if (!config) return true;
        const styles = normalizeServiceStylesArray(config?.serviceStyles || config?.service_styles);
        if (styles.length === 0) return true;
        return styles.includes(normalized);
      }
      
      const allows = roleConfigAllowsStyle(v.role_config, 'tele');
      console.log(`\nroleConfigAllowsStyle('tele'): ${allows}`);
      if (!allows) {
        console.log('❌ PROBLEM: roleConfigAllowsStyle returns false - vendor will be filtered out!');
      } else {
        console.log('✅ roleConfigAllowsStyle returns true - vendor should pass');
      }
    } else {
      console.log('❌ Vendor NOT found by query');
      
      // Test each condition
      console.log('\nTesting each condition separately...');
      
      const base = await pool.query(`SELECT id FROM vendors WHERE id = $1 AND (status = 'approved' OR status = 'active') AND is_active = true`, [vendorId]);
      console.log(`  Base filters: ${base.rows.length > 0 ? '✅' : '❌'}`);
      
      const avail = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM vendor_availability_v2 va
          WHERE va.vendor_id::text = $1::text
            AND (va.is_available IS NULL OR va.is_available = true)
            AND (COALESCE(va.service_styles, ARRAY[]::text[]) && $2::text[])
        ) as exists
      `, [vendorId, acceptableServiceStyles]);
      console.log(`  Availability: ${avail.rows[0].exists ? '✅' : '❌'}`);
      
      const solo = await pool.query(`
        SELECT v.vendor_type = 'solo' as is_solo
        FROM vendors v WHERE v.id = $1
      `, [vendorId]);
      console.log(`  Solo check: ${solo.rows[0].is_solo ? '✅' : '❌'}`);
      
      const role = await pool.query(`
        SELECT LOWER(r.name) = ANY($1::text[]) as matches
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.id = $2
      `, [targetRolesLower, vendorId]);
      console.log(`  Role filter: ${role.rows[0].matches ? '✅' : '❌'}`);
      
      const service = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = $1
            AND vs.service_style = ANY($2::text[])
            AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        ) as exists
      `, [vendorId, acceptableServiceStyles]);
      console.log(`  Service filter: ${service.rows[0].exists ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

test().catch(console.error);
