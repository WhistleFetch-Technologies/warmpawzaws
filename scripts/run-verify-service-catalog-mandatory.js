#!/usr/bin/env node
/**
 * Run service catalog mandatory-fields verification against RDS.
 * Uses same RDS connection as run-migration-rds-node.js.
 *
 * Usage: ENVIRONMENT=dev node scripts/run-verify-service-catalog-mandatory.js
 *
 * Exit 0 if all active/published services have applicable_roles, service_style, specialization_ids.
 * Exit 1 if any are missing (and print which rows).
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  console.log('🔍 Service Catalog Mandatory Fields Verification');
  console.log('================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log('');

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  console.log('📊 Getting RDS cluster...');
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    console.error(`❌ RDS cluster not found: ${clusterId}`);
    process.exit(1);
  }
  const cluster = clusterInfo.DBClusters[0];
  const endpoint = cluster.Endpoint;
  const port = cluster.Port || '5432';
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  console.log('🔐 Getting credentials...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;
  if (!password) {
    console.error('❌ Password not found in secret');
    process.exit(1);
  }

  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('❌ DB connection failed:', e.message);
    process.exit(1);
  }

  const listQuery = `
    SELECT id, service_id, service_name, category_id,
           applicable_roles, service_style,
           CASE WHEN applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL THEN 'MISSING' ELSE 'OK' END AS applicable_roles_status,
           CASE WHEN service_style IS NULL OR service_style NOT IN ('at_center','at_home','tele','all') THEN 'MISSING/INVALID' ELSE 'OK' END AS service_style_status,
           CASE WHEN specialization_ids IS NULL THEN 'MISSING' ELSE 'OK' END AS specialization_ids_status
    FROM service_catalog
    WHERE status = 'active'
      AND (publish_status = 'published' OR publish_status IS NULL)
      AND (applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL
           OR service_style IS NULL OR service_style NOT IN ('at_center', 'at_home', 'tele', 'all')
           OR specialization_ids IS NULL)
    ORDER BY category_id, service_name
  `;
  const summaryQuery = `
    SELECT
      COUNT(*) FILTER (WHERE applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL) AS missing_applicable_roles,
      COUNT(*) FILTER (WHERE service_style IS NULL OR service_style NOT IN ('at_center','at_home','tele','all')) AS missing_or_invalid_service_style,
      COUNT(*) FILTER (WHERE specialization_ids IS NULL) AS missing_specialization_ids,
      COUNT(*) AS total_active_published
    FROM service_catalog
    WHERE status = 'active' AND (publish_status = 'published' OR publish_status IS NULL)
  `;

  const listRes = await pool.query(listQuery);
  const summaryRes = await pool.query(summaryQuery);
  await pool.end();

  const summary = summaryRes.rows[0];
  const missingRoles = parseInt(summary.missing_applicable_roles, 10) || 0;
  const missingStyle = parseInt(summary.missing_or_invalid_service_style, 10) || 0;
  const missingSpec = parseInt(summary.missing_specialization_ids, 10) || 0;
  const total = parseInt(summary.total_active_published, 10) || 0;

  console.log('');
  console.log('📋 Summary (active + published services):');
  console.log(`   Total: ${total}`);
  console.log(`   Missing applicable_roles: ${missingRoles}`);
  console.log(`   Missing/invalid service_style: ${missingStyle}`);
  console.log(`   Missing specialization_ids: ${missingSpec}`);
  console.log('');

  if (listRes.rows.length > 0) {
    console.log('⚠️  Rows with missing/invalid fields:');
    listRes.rows.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.service_id || r.id} | ${r.service_name} | roles:${r.applicable_roles_status} style:${r.service_style_status} spec:${r.specialization_ids_status}`);
    });
    console.log('');
  }

  if (missingRoles === 0 && missingStyle === 0 && missingSpec === 0) {
    console.log('✅ All active/published services have the three mandatory fields.');
    process.exit(0);
  }

  console.log('❌ Some services are missing mandatory fields. Fix via admin catalog or migrations before deploy.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
