#!/usr/bin/env node
/**
 * Forensic GPS booking trace (read-only)
 * Reports counts of at_home bookings with address_id / coords to validate tracking readiness.
 *
 * Usage:
 *   ENVIRONMENT=dev AWS_REGION=ap-south-1 node scripts/forensic-gps-bookings-trace.js
 */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const LIMIT = parseInt(process.env.LIMIT || '10', 10);

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

  const dbName = execSync(
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
  return `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
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
  console.log('🔍 GPS Booking Trace (read-only)');
  console.log(`Env: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);

  const { endpoint, port, dbName, username } = await resolveDbEndpoint();
  const secretArn = await resolveSecretArn();
  const creds = await getDbCredentials(secretArn);

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

  const hasServiceType = await columnExists(client, 'bookings', 'service_type');
  const hasServiceStyle = await columnExists(client, 'bookings', 'service_style');
  const hasAddressId = await columnExists(client, 'bookings', 'address_id');
  const hasDeliveryLat = await columnExists(client, 'bookings', 'delivery_latitude');
  const hasDeliveryLng = await columnExists(client, 'bookings', 'delivery_longitude');
  const hasLat = await columnExists(client, 'bookings', 'latitude');
  const hasLng = await columnExists(client, 'bookings', 'longitude');
  const hasAddress = await columnExists(client, 'bookings', 'address');

  const styleClause = (() => {
    const parts = [];
    if (hasServiceStyle) parts.push(`service_style = 'at_home'`);
    if (hasServiceType) parts.push(`service_type = 'at_home'`);
    return parts.length ? `(${parts.join(' OR ')})` : 'TRUE';
  })();

  const summary = await query(client, `
    SELECT
      COUNT(*) as total_bookings,
      SUM(CASE WHEN ${styleClause} THEN 1 ELSE 0 END) as at_home_bookings,
      SUM(CASE WHEN ${styleClause} AND ${hasAddressId ? 'address_id IS NOT NULL' : 'false'} THEN 1 ELSE 0 END) as with_address_id,
      SUM(CASE WHEN ${styleClause} AND ${hasDeliveryLat ? 'delivery_latitude IS NOT NULL' : 'false'} AND ${hasDeliveryLng ? 'delivery_longitude IS NOT NULL' : 'false'} THEN 1 ELSE 0 END) as with_delivery_coords,
      SUM(CASE WHEN ${styleClause} AND ${hasLat ? 'latitude IS NOT NULL' : 'false'} AND ${hasLng ? 'longitude IS NOT NULL' : 'false'} THEN 1 ELSE 0 END) as with_booking_coords,
      SUM(CASE WHEN ${styleClause} AND ${hasAddress ? 'address IS NOT NULL' : 'false'} THEN 1 ELSE 0 END) as with_address_text
    FROM bookings
  `);

  console.table(summary);

  const sample = await query(client, `
    SELECT id, vendor_id, customer_id, status,
           ${hasServiceStyle ? 'service_style' : 'NULL as service_style'},
           ${hasServiceType ? 'service_type' : 'NULL as service_type'},
           ${hasAddressId ? 'address_id' : 'NULL as address_id'},
           ${hasDeliveryLat ? 'delivery_latitude' : 'NULL as delivery_latitude'},
           ${hasDeliveryLng ? 'delivery_longitude' : 'NULL as delivery_longitude'},
           ${hasLat ? 'latitude' : 'NULL as latitude'},
           ${hasLng ? 'longitude' : 'NULL as longitude'},
           booking_date, booking_time
    FROM bookings
    WHERE ${styleClause}
    ORDER BY updated_at DESC NULLS LAST
    LIMIT $1
  `, [LIMIT]);

  console.log('\nRecent at_home bookings (sample):');
  console.table(sample);

  await client.end();
  console.log('✅ GPS booking trace complete.');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
