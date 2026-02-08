#!/usr/bin/env node
/**
 * DB-level discovery trace (read-only)
 * Auto-resolves RDS endpoint + secret via AWS CLI (like check-db-schema.js)
 * Prints summary counts for services, availability, specializations, photos, coordinates.
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const DB_NAME_ENV = process.env.DB_NAME || '';

async function resolveDbEndpoint() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();

  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';

  const dbName = DB_NAME_ENV || execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';

  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';

  return { endpoint, port: parseInt(port, 10), dbName, username };
}

async function resolveSecretArn() {
  // Default secret naming convention used across scripts
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  return secretName;
}

async function getDbCredentials(secretArn) {
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return JSON.parse(response.SecretString);
}

async function query(client, sql, params) {
  const res = await client.query(sql, params);
  return res.rows;
}

async function columnExists(client, tableName, columnName) {
  const rows = await query(client, `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) as exists
  `, [tableName, columnName]).catch(() => [{ exists: false }]);
  return rows?.[0]?.exists === true || rows?.[0]?.exists === 't';
}

async function main() {
  console.log('🔍 DB Discovery Trace (read-only)');
  console.log(`Env: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);

  const { endpoint, port, dbName, username } = await resolveDbEndpoint();
  const secretArn = await resolveSecretArn();
  const creds = await getDbCredentials(secretArn);

  console.log(`DB Host: ${endpoint}`);
  console.log(`DB Name: ${dbName}`);
  console.log(`DB User: ${username}`);

  const client = new Client({
    host: endpoint,
    port,
    database: dbName,
    user: username,
    password: creds.password || creds.Password || creds.secret || creds.Secret,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();

  const blocks = [];

  // Detect availability schema variants
  const hasServiceStyle = await columnExists(client, 'vendor_availability_v2', 'service_style');
  const hasServiceStyles = await columnExists(client, 'vendor_availability_v2', 'service_styles');
  const hasServiceType = await columnExists(client, 'vendor_availability_v2', 'service_type');
  const hasIsEnabled = await columnExists(client, 'vendor_availability_v2', 'is_enabled');
  const hasIsAvailable = await columnExists(client, 'vendor_availability_v2', 'is_available');
  const hasLogoUrl = await columnExists(client, 'vendors', 'logo_url');
  const hasProfilePhotoUrl = await columnExists(client, 'vendors', 'profile_photo_url');
  const hasProfileImage = await columnExists(client, 'vendors', 'profile_image');

  const enabledExpr = (hasIsEnabled && hasIsAvailable)
    ? 'COALESCE(va.is_enabled, va.is_available, true) = true'
    : hasIsEnabled
      ? 'COALESCE(va.is_enabled, true) = true'
      : hasIsAvailable
        ? 'COALESCE(va.is_available, true) = true'
        : 'true';
  const styleExpr = hasServiceStyles
    ? `va.service_styles`
    : hasServiceStyle
      ? `ARRAY[va.service_style]`
      : hasServiceType
        ? `ARRAY[va.service_type]`
        : `ARRAY[]::text[]`;
  const styleCountArray = hasServiceStyles ? `va.service_styles` : null;
  const styleSingle = hasServiceStyle ? `va.service_style` : (hasServiceType ? `va.service_type` : null);

  blocks.push({
    title: 'Vendors by role/type (active+approved)',
    rows: await query(client, `
      SELECT r.name as role_name, v.vendor_type,
             COUNT(*) as vendors
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.is_active = true AND v.status IN ('approved','active')
      GROUP BY r.name, v.vendor_type
      ORDER BY vendors DESC
    `)
  });

  blocks.push({
    title: 'Published enabled services by role/type/style',
    rows: await query(client, `
      SELECT r.name as role_name, v.vendor_type, vs.service_style,
             COUNT(*) as services
      FROM vendor_services vs
      JOIN vendors v ON vs.vendor_id = v.id
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE vs.is_enabled = true AND vs.publish_status = 'published'
      GROUP BY r.name, v.vendor_type, vs.service_style
      ORDER BY services DESC
    `)
  });

  blocks.push({
    title: 'Availability rows: service_styles[] vs service_style',
    rows: await query(client, `
      SELECT r.name as role_name, v.vendor_type,
        ${styleCountArray ? `SUM(CASE WHEN ${styleCountArray} IS NOT NULL AND array_length(${styleCountArray},1) > 0 THEN 1 ELSE 0 END)` : '0'} as rows_with_array,
        ${styleSingle ? `SUM(CASE WHEN (${styleCountArray ? `${styleCountArray} IS NULL OR array_length(${styleCountArray},1) = 0` : 'true'}) AND ${styleSingle} IS NOT NULL THEN 1 ELSE 0 END)` : '0'} as rows_with_single,
        COUNT(*) as total_rows
      FROM vendor_availability_v2 va
      JOIN vendors v ON va.vendor_id = v.id
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE ${enabledExpr}
      GROUP BY r.name, v.vendor_type
      ORDER BY total_rows DESC
    `)
  });

  blocks.push({
    title: 'Availability style coverage (from service_styles or service_style)',
    rows: await query(client, `
      WITH styles AS (
        SELECT unnest(
          ${styleExpr}
        ) as style
        FROM vendor_availability_v2 va
        WHERE ${enabledExpr}
      )
      SELECT style, COUNT(*) as rows
      FROM styles
      WHERE style IS NOT NULL AND style <> ''
      GROUP BY style
      ORDER BY rows DESC
    `)
  });

  blocks.push({
    title: 'Vendors with at_home/tele services vs availability',
    rows: await query(client, `
      WITH svc AS (
        SELECT DISTINCT v.id vendor_id, r.name role_name, v.vendor_type, vs.service_style
        FROM vendor_services vs
        JOIN vendors v ON vs.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE vs.is_enabled = true AND vs.publish_status = 'published'
          AND vs.service_style IN ('at_home','tele')
      ),
      va AS (
        SELECT DISTINCT v.id vendor_id, r.name role_name, v.vendor_type,
          unnest(
            ${styleExpr}
          ) as style
        FROM vendor_availability_v2 va
        JOIN vendors v ON va.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE ${enabledExpr}
      )
      SELECT svc.service_style, svc.role_name, svc.vendor_type,
        COUNT(DISTINCT svc.vendor_id) as vendors_with_service,
        COUNT(DISTINCT va.vendor_id) FILTER (WHERE va.style = svc.service_style) as vendors_with_availability,
        COUNT(DISTINCT svc.vendor_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM va v2
            WHERE v2.vendor_id = svc.vendor_id AND v2.style = svc.service_style
          )
        ) as vendors_with_both
      FROM svc
      LEFT JOIN va ON va.vendor_id = svc.vendor_id AND va.style = svc.service_style
      GROUP BY svc.service_style, svc.role_name, svc.vendor_type
      ORDER BY svc.service_style, role_name
    `)
  });

  blocks.push({
    title: 'Vendor specialization coverage',
    rows: await query(client, `
      SELECT r.name as role_name, v.vendor_type,
        COUNT(DISTINCT v.id) as vendors,
        COUNT(DISTINCT vs.vendor_id) as vendors_with_specializations
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      LEFT JOIN vendor_specializations vs ON v.id = vs.vendor_id
      WHERE v.is_active = true AND v.status IN ('approved','active')
      GROUP BY r.name, v.vendor_type
      ORDER BY vendors DESC
    `)
  });

  blocks.push({
    title: 'Vendor photo coverage',
    rows: await query(client, `
      SELECT r.name as role_name, v.vendor_type,
        ${hasProfilePhotoUrl ? `SUM(CASE WHEN v.profile_photo_url IS NOT NULL AND v.profile_photo_url <> '' THEN 1 ELSE 0 END)` : '0'} as with_profile_photo_url,
        ${hasProfileImage ? `SUM(CASE WHEN v.profile_image IS NOT NULL AND v.profile_image <> '' THEN 1 ELSE 0 END)` : '0'} as with_profile_image,
        ${hasLogoUrl ? `SUM(CASE WHEN v.logo_url IS NOT NULL AND v.logo_url <> '' THEN 1 ELSE 0 END)` : '0'} as with_logo_url,
        COUNT(*) as total
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.is_active = true AND v.status IN ('approved','active')
      GROUP BY r.name, v.vendor_type
      ORDER BY total DESC
    `)
  });

  blocks.push({
    title: 'Vendor coordinate coverage',
    rows: await query(client, `
      SELECT r.name as role_name, v.vendor_type,
        SUM(CASE WHEN v.latitude IS NOT NULL AND v.longitude IS NOT NULL THEN 1 ELSE 0 END) as with_coords,
        COUNT(*) as total
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.is_active = true AND v.status IN ('approved','active')
      GROUP BY r.name, v.vendor_type
      ORDER BY total DESC
    `)
  });

  for (const block of blocks) {
    console.log('\n' + block.title);
    console.log('-'.repeat(block.title.length));
    if (!block.rows || block.rows.length === 0) {
      console.log('(no rows)');
      continue;
    }
    console.table(block.rows);
  }

  await client.end();
  console.log('\n✅ DB discovery trace complete.');
}

main().catch((err) => {
  console.error('❌ DB discovery trace failed:', err.message || err);
  process.exit(1);
});
