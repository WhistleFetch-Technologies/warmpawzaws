#!/usr/bin/env node
/**
 * Phase runner for migration 1068 (service_catalog UUID / General category backfill).
 *
 * Usage:
 *   ENVIRONMENT=dev  node scripts/apply-migration-1068-catalog-category-backfill.js --dry-run
 *   ENVIRONMENT=dev  node scripts/apply-migration-1068-catalog-category-backfill.js --apply
 *   ENVIRONMENT=dev  node scripts/apply-migration-1068-catalog-category-backfill.js --verify
 *   ENVIRONMENT=prod node scripts/apply-migration-1068-catalog-category-backfill.js --rollback
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const BACKUP_TABLE = 'service_catalog_category_backfill_20260713';
const MIGRATION_FILE = '1068_backfill_service_catalog_general_category.sql';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');
const verify = args.includes('--verify');
const rollback = args.includes('--rollback');

if (!dryRun && !apply && !verify && !rollback) {
  console.error(
    'Usage: ENVIRONMENT=dev|prod node scripts/apply-migration-1068-catalog-category-backfill.js --dry-run|--apply|--verify|--rollback'
  );
  process.exit(1);
}

function cell(f) {
  if (!f || f.isNull) return null;
  return f.stringValue ?? f.longValue ?? f.doubleValue ?? null;
}
function rows(r) {
  const c = (r.columnMetadata || []).map((x) => x.name);
  return (r.records || []).map((rec) => {
    const o = {};
    rec.forEach((f, i) => {
      o[c[i]] = cell(f);
    });
    return o;
  });
}

async function getMeta() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  if (!cluster.HttpEndpointEnabled) throw new Error('RDS Data API not enabled');
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(new GetSecretValueCommand({ SecretId: secretName }));
  return {
    resourceArn: cluster.DBClusterArn,
    secretArn: secretValue.ARN,
    database: cluster.DatabaseName || 'warmpawz',
  };
}

function splitSql(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const noComments = raw
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  return noComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function q(client, meta, sql) {
  const res = await client.send(
    new ExecuteStatementCommand({ ...meta, sql, includeResultMetadata: true })
  );
  return { rows: rows(res), updated: res.numberOfRecordsUpdated };
}

const DRY_RUN_SQL = `
SELECT
  sc.id::text,
  sc.service_id,
  sc.service_name,
  sc.category_id AS old_category_id,
  sc.category_name AS old_category_name,
  COALESCE(cat_by_id.category_id, cat_by_slug.category_id) AS new_category_id,
  COALESCE(cat_by_id.name, cat_by_slug.name) AS new_category_name
FROM service_catalog sc
LEFT JOIN service_categories cat_by_id
  ON cat_by_id.id::text = sc.category_id
  AND sc.category_id ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
LEFT JOIN service_categories cat_by_slug
  ON cat_by_slug.category_id = sc.category_id
  AND TRIM(COALESCE(sc.category_name, '')) = 'General'
  AND sc.category_id IS NOT NULL
  AND sc.category_id !~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
WHERE (
  TRIM(COALESCE(sc.category_name, '')) = 'General'
  OR sc.category_id ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
)
ORDER BY sc.service_name
`;

const VERIFY_SQL = `
SELECT
  (SELECT COUNT(*)::int FROM service_catalog WHERE TRIM(COALESCE(category_name, '')) = 'General') AS general_name_count,
  (SELECT COUNT(*)::int FROM service_catalog
   WHERE category_id ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$') AS uuid_category_id_count,
  (SELECT COUNT(*)::int FROM ${BACKUP_TABLE}) AS backup_row_count
`;

const ROLLBACK_SQL = `
UPDATE service_catalog sc
SET
  category_id = b.category_id,
  category_name = b.category_name,
  updated_at = b.updated_at
FROM ${BACKUP_TABLE} b
WHERE sc.id = b.id
`;

async function main() {
  const meta = await getMeta();
  const client = new RDSDataClient({ region: REGION });
  console.log(`Environment: ${ENVIRONMENT}`);

  if (dryRun) {
    const { rows: preview } = await q(client, meta, DRY_RUN_SQL);
    console.log(`Rows that would be fixed: ${preview.length}`);
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  if (verify) {
    const { rows: counts } = await q(client, meta, VERIFY_SQL);
    console.log(JSON.stringify(counts[0], null, 2));
    const sample = await q(
      client,
      meta,
      `SELECT id::text, service_id, service_name, category_id, category_name
       FROM service_catalog
       WHERE service_name IN ('Cardiac Diagnostics (ECG)', 'Ear Cleaning', 'Health Certificate ')
       ORDER BY service_name, created_at DESC
       LIMIT 10`
    );
    console.log('Sample rows:', JSON.stringify(sample.rows, null, 2));
    return;
  }

  if (rollback) {
    if (ENVIRONMENT === 'prod' && process.env.I_CONFIRM_PROD_ROLLBACK_1068 !== 'YES') {
      console.error('Prod rollback blocked. Set I_CONFIRM_PROD_ROLLBACK_1068=YES to proceed.');
      process.exit(1);
    }
    const { updated } = await q(client, meta, ROLLBACK_SQL);
    console.log(`Rollback complete. Rows restored: ${updated ?? 'n/a'}`);
    const { rows: counts } = await q(client, meta, VERIFY_SQL);
    console.log('After rollback:', JSON.stringify(counts[0], null, 2));
    return;
  }

  if (apply) {
    if (ENVIRONMENT === 'prod' && process.env.I_CONFIRM_PROD_MIGRATION_1068 !== 'YES') {
      console.error('Prod apply blocked. Set I_CONFIRM_PROD_MIGRATION_1068=YES to proceed.');
      process.exit(1);
    }
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', MIGRATION_FILE);
    const statements = splitSql(migrationPath);
    console.log(`Applying ${MIGRATION_FILE} (${statements.length} statements)...`);
    for (let i = 0; i < statements.length; i++) {
      const sql = `${statements[i]};`;
      const { updated } = await q(client, meta, sql);
      console.log(`  [${i + 1}/${statements.length}] updated: ${updated ?? 'n/a'}`);
    }
    const { rows: counts } = await q(client, meta, VERIFY_SQL);
    console.log('After apply:', JSON.stringify(counts[0], null, 2));
  }
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
