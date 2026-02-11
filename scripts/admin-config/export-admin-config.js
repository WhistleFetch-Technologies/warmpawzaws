#!/usr/bin/env node
/**
 * Export admin configuration from Dev RDS to JSON files.
 * Use with Import script to migrate config Dev → Prod.
 *
 * Usage:
 *   DATABASE_URL="postgres://user:pass@host:5432/warmpawz" node scripts/admin-config/export-admin-config.js
 *   ENVIRONMENT=dev node scripts/admin-config/export-admin-config.js   # uses AWS Secrets Manager
 *
 * Output: scripts/admin-config/export/<YYYYMMDD-HHmmss>/<table>.json + manifest.json
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';

// Tables in FK-safe import order. Optional tables skipped if missing.
// Tables with platform-only filter: export only rows where vendor_id IS NULL (or no vendor_id column).
const TABLE_CONFIG = [
  { table: 'roles', optional: false },
  { table: 'role_permissions', optional: false },
  { table: 'service_categories', optional: false },
  { table: 'service_catalog', optional: false },
  { table: 'specialization_master', optional: false },
  { table: 'specialization_symptoms', optional: false },
  { table: 'ecommerce_categories', optional: false },
  { table: 'cancellation_policies', optional: false },
  { table: 'rbac_policies', optional: false },
  { table: 'booking_rules', optional: false },
  { table: 'payout_rules', optional: false },
  { table: 'refund_rules', optional: false },
  { table: 'refund_tiers', optional: false },
  { table: 'booking_cancellation_rules', optional: true },
  { table: 'vendor_refund_tiers', optional: false },
  { table: 'vendor_payment_rules', optional: false },
  { table: 'tax_categories', optional: false },
  { table: 'gst_configs', optional: false },
  { table: 'hsn_codes', optional: false },
  { table: 'gst_rules', optional: true },
  { table: 'platform_settings', optional: false },
  { table: 'admin_settings', optional: false },
  { table: 'payment_gateway_settings', optional: false },
  { table: 'settlement_rules', optional: true },
  { table: 'logistics_partners', optional: false },
  { table: 'logistics_rules', optional: false },
  { table: 'vendor_tiers', optional: false },
  { table: 'ecommerce_policies', optional: true, where: 'vendor_id IS NULL' },
  { table: 'onboarding_forms', optional: false },
  { table: 'problem_grid_mappings', optional: false },
  { table: 'discovery_rules', optional: false },
  { table: 'scheduling_policies', optional: false },
  { table: 'loyalty_rules', optional: false },
  { table: 'regions', optional: false },
  { table: 'notification_templates', optional: false },
  { table: 'content_pages', optional: false },
  { table: 'report_templates', optional: true },
];

function serializeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (Buffer.isBuffer(v)) {
      out[k] = v.toString('base64');
    } else if (v !== null && typeof v === 'object' && typeof v.toISOString === 'function') {
      out[k] = v.toISOString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function getPoolFromEnv() {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.TARGET_DATABASE_URL;
  if (DATABASE_URL) {
    return new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('rds.') ? { rejectUnauthorized: false } : undefined,
    });
  }
  const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${clusterId}`);
  }
  const cluster = clusterInfo.DBClusters[0];
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;
  if (!password) throw new Error('Password not found in secret');
  return new Pool({
    host: cluster.Endpoint,
    port: parseInt(cluster.Port || '5432', 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
}

async function run() {
  const outDir = path.join(__dirname, 'export', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '-'));
  fs.mkdirSync(outDir, { recursive: true });
  console.log('Export directory:', outDir);

  const pool = await getPoolFromEnv();
  const manifest = { exportedAt: new Date().toISOString(), tables: [], errors: [] };

  try {
    for (const { table, optional, where } of TABLE_CONFIG) {
      const sql = where
        ? `SELECT * FROM ${table} WHERE ${where}`
        : `SELECT * FROM ${table}`;
      try {
        const res = await pool.query(sql);
        const rows = (res.rows || []).map(serializeRow);
        const file = path.join(outDir, `${table}.json`);
        fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
        manifest.tables.push({ table, rowCount: rows.length });
        console.log(`  ${table}: ${rows.length} rows`);
      } catch (err) {
        if (optional && (err.message.includes('does not exist') || err.code === '42P01')) {
          console.log(`  ${table}: skipped (table missing)`);
          manifest.tables.push({ table, rowCount: 0, skipped: 'table missing' });
        } else {
          console.error(`  ${table}: ERROR`, err.message);
          manifest.errors.push({ table, error: err.message });
        }
      }
    }
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log('Done. Manifest:', path.join(outDir, 'manifest.json'));
    if (manifest.errors.length) {
      console.error('Errors:', manifest.errors);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
