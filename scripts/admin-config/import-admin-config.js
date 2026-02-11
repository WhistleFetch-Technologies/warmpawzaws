#!/usr/bin/env node
/**
 * Import admin configuration from JSON export into Prod RDS.
 * Run export-admin-config.js against Dev first, then this against Prod.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/admin-config/import-admin-config.js [path-to-export-dir]
 *   ENVIRONMENT=prod node scripts/admin-config/import-admin-config.js [path-to-export-dir]
 *
 * If path omitted, uses latest export dir under scripts/admin-config/export/.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';

// Same order as export (FK-safe for INSERT). Reverse order for DELETE.
const TABLE_ORDER = [
  'roles', 'role_permissions', 'service_categories', 'service_catalog',
  'specialization_master', 'specialization_symptoms', 'ecommerce_categories',
  'cancellation_policies', 'rbac_policies', 'booking_rules', 'payout_rules',
  'refund_rules', 'refund_tiers', 'booking_cancellation_rules', 'vendor_refund_tiers',
  'vendor_payment_rules', 'tax_categories', 'gst_configs', 'hsn_codes', 'gst_rules',
  'platform_settings', 'admin_settings', 'payment_gateway_settings',
  'settlement_rules', 'logistics_partners', 'logistics_rules', 'vendor_tiers',
  'ecommerce_policies', 'onboarding_forms', 'problem_grid_mappings', 'discovery_rules',
  'scheduling_policies', 'loyalty_rules', 'regions', 'notification_templates',
  'content_pages', 'report_templates',
];

// Self-referential: insert parents before children (e.g. service_categories.parent_category_id).
function sortSelfRef(rows, parentKey) {
  if (!rows.length) return rows;
  const idToIndex = new Map(rows.map((r, i) => [r.id, i]));
  return [...rows].sort((a, b) => {
    const aIdx = a[parentKey] != null ? idToIndex.get(a[parentKey]) : -1;
    const bIdx = b[parentKey] != null ? idToIndex.get(b[parentKey]) : -1;
    const aFirst = aIdx === -1 || aIdx === undefined;
    const bFirst = bIdx === -1 || bIdx === undefined;
    if (aFirst && !bFirst) return -1;
    if (!aFirst && bFirst) return 1;
    return (aIdx ?? 9999) - (bIdx ?? 9999);
  });
}

async function getPoolFromEnv() {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.TARGET_DATABASE_URL;
  if (DATABASE_URL) {
    return new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('rds.') ? { rejectUnauthorized: false } : undefined,
    });
  }
  const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
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

function getExportDir(argPath) {
  if (argPath) {
    const p = path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Error('Export directory not found: ' + argPath);
    return p;
  }
  const exportBase = path.join(__dirname, 'export');
  if (!fs.existsSync(exportBase)) throw new Error('No export directory found. Run export-admin-config.js first.');
  const dirs = fs.readdirSync(exportBase)
    .map(d => path.join(exportBase, d))
    .filter(d => fs.statSync(d).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!dirs.length) throw new Error('No export subdirectory found.');
  return dirs[0];
}

async function run() {
  const exportDir = getExportDir(process.argv[2]);
  console.log('Import from:', exportDir);

  const pool = await getPoolFromEnv();
  const manifestPath = path.join(exportDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json not found in export dir');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('Export manifest:', manifest.exportedAt);

  const skipBootstrapCheck = process.env.SKIP_BOOTSTRAP_CHECK === '1';
  if (!skipBootstrapCheck) {
    const r = await pool.query(`SELECT 1 FROM platform_settings WHERE setting_key = 'prod_bootstrap_completed' LIMIT 1`);
    if (r.rows.length > 0) {
      console.log('prod_bootstrap_completed already set. Set SKIP_BOOTSTRAP_CHECK=1 to re-import anyway.');
      await pool.end();
      process.exit(0);
    }
  }

  const reverseOrder = [...TABLE_ORDER].reverse();

  try {
    for (const table of reverseOrder) {
      const file = path.join(exportDir, `${table}.json`);
      if (!fs.existsSync(file)) continue;
      try {
        await pool.query(`DELETE FROM ${table}`);
        console.log('  DELETE', table);
      } catch (err) {
        if (err.code === '42P01') console.log('  skip (table missing):', table);
        else throw err;
      }
    }

    for (const table of TABLE_ORDER) {
      const file = path.join(exportDir, `${table}.json`);
      if (!fs.existsSync(file)) continue;
      let rows = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log('  INSERT', table, '0 rows');
        continue;
      }
      if (table === 'service_categories' || table === 'ecommerce_categories') {
        const parentKey = table === 'service_categories' ? 'parent_category_id' : 'parent_category_id';
        rows = sortSelfRef(rows, parentKey);
      }
      const exportedCols = Object.keys(rows[0]).filter(c => c !== undefined);
      const targetRes = await pool.query(
        `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      const targetCols = (targetRes.rows || []).map(r => r.column_name);
      const targetTypes = Object.fromEntries((targetRes.rows || []).map(r => [r.column_name, (r.data_type || '').toLowerCase()]));
      const cols = exportedCols.filter(c => targetCols.includes(c));
      if (cols.length === 0) {
        console.log('  INSERT', table, '0 rows (no matching columns)');
        continue;
      }
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
      let inserted = 0;
      for (const row of rows) {
        const vals = cols.map(c => {
          const v = row[c];
          if (v === undefined) return null;
          const dt = targetTypes[c] || '';
          const isJson = dt === 'jsonb' || dt === 'json';
          const isArray = dt === 'array' || (dt === 'user-defined' && (targetRes.rows?.find(r => r.column_name === c)?.udt_name || '').endsWith('_array'));
          if (isJson && (Array.isArray(v) || (typeof v === 'object' && v !== null))) return JSON.stringify(v);
          if (isJson && typeof v === 'string') return v;
          if ((isArray || dt === 'array') && Array.isArray(v)) return v;
          if (typeof v === 'object' && v !== null && !Buffer.isBuffer(v) && typeof v.toISOString !== 'function' && !Array.isArray(v)) return JSON.stringify(v);
          return v;
        });
        try {
          await pool.query(insertSql, vals);
          inserted++;
        } catch (err) {
          if (err.code === '23505') continue;
          throw err;
        }
      }
      console.log('  INSERT', table, inserted, 'rows');
    }

    await pool.query(`
      INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
      VALUES ('prod_bootstrap_completed', 'true', 'boolean', 'Admin config import completed', false, NOW(), NOW())
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'true', updated_at = NOW()
    `);
    console.log('  Set prod_bootstrap_completed');
    console.log('Done.');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
