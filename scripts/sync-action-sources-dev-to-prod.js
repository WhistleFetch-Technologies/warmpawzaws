#!/usr/bin/env node
/**
 * Copy all rows from dev `action_sources` to prod (upsert on method+route_pattern+action_name).
 *
 * Requires: AWS credentials, RDS Data API on dev + prod clusters.
 *
 * Usage (from repo root or scripts/):
 *   node scripts/sync-action-sources-dev-to-prod.js
 *
 * Optional env:
 *   AWS_REGION (default ap-south-1)
 */

const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DEV_CLUSTER = 'warmpawz-dev-cluster';
const DEV_SECRET = 'warmpawz-dev-rds-master-20260106164510791100000002';
const PROD_CLUSTER = 'warmpawz-prod-cluster';
const PROD_SECRET = 'warmpawz-prod-rds-master-20260207201049162400000001';

function resolveRdsTarget(clusterIdentifier, secretId) {
  const clusterJson = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterIdentifier} --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  );
  const c = clusterJson.DBClusters?.[0];
  if (!c) throw new Error(`Cluster not found: ${clusterIdentifier}`);
  if (!c.HttpEndpointEnabled) throw new Error(`Data API not enabled: ${clusterIdentifier}`);

  const secretJson = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id "${secretId}" --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  );

  return {
    resourceArn: c.DBClusterArn,
    secretArn: secretJson.ARN,
    database: c.DatabaseName || 'warmpawz',
  };
}

function sqlStr(v) {
  if (v == null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

function sqlJsonb(v) {
  let obj = v;
  if (obj == null) obj = {};
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      obj = {};
    }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) obj = {};
  const s = JSON.stringify(obj);
  return "'" + s.replace(/'/g, "''") + "'::jsonb";
}

function sqlBool(v) {
  return v === true || v === 'true' || v === 't' || v === 1 ? 'true' : 'false';
}

function sqlInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.trunc(n)) : '0';
}

function sqlUuid(v) {
  if (v == null || v === '') throw new Error('missing id');
  const s = String(v).trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(s)) throw new Error(`invalid uuid: ${s}`);
  return `'${s}'::uuid`;
}

function sqlTimestamptz(v) {
  if (v == null || v === '') return 'NOW()';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'NOW()';
  return sqlStr(d.toISOString()) + '::timestamptz';
}

function buildUpsertSql(row) {
  const r = row;
  const method = String(r.method || 'POST').toUpperCase();
  const route = r.route_pattern;
  const action = r.action_name;
  if (!route || !action) throw new Error('row missing route_pattern or action_name');

  const vals = [
    sqlUuid(r.id),
    sqlStr(r.source_type || 'http'),
    sqlStr(route),
    sqlStr(method),
    sqlInt(r.status_min ?? 200),
    sqlInt(r.status_max ?? 299),
    r.success_predicate == null || r.success_predicate === '' ? 'NULL' : sqlStr(r.success_predicate),
    sqlStr(action),
    sqlStr(r.entity_resolver),
    sqlStr(r.entity_type || 'auto'),
    r.amount_resolver == null || r.amount_resolver === '' ? 'NULL' : sqlStr(r.amount_resolver),
    r.reference_type == null || r.reference_type === '' ? 'NULL' : sqlStr(r.reference_type),
    r.reference_id_resolver == null || r.reference_id_resolver === '' ? 'NULL' : sqlStr(r.reference_id_resolver),
    sqlJsonb(r.metadata_resolvers),
    sqlBool(r.enabled !== false && r.enabled !== 'false' && r.enabled !== 0),
    sqlInt(r.priority ?? 100),
    sqlBool(r.dry_run === true || r.dry_run === 'true' || r.dry_run === 1),
    r.notes == null || r.notes === '' ? 'NULL' : sqlStr(r.notes),
    sqlTimestamptz(r.created_at),
    sqlTimestamptz(r.updated_at),
  ];

  return `
INSERT INTO action_sources (
  id, source_type, route_pattern, method, status_min, status_max,
  success_predicate, action_name, entity_resolver, entity_type,
  amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes,
  created_at, updated_at
) VALUES (
  ${vals.join(', ')}
)
ON CONFLICT (method, route_pattern, action_name) DO UPDATE SET
  id = EXCLUDED.id,
  source_type = EXCLUDED.source_type,
  status_min = EXCLUDED.status_min,
  status_max = EXCLUDED.status_max,
  success_predicate = EXCLUDED.success_predicate,
  entity_resolver = EXCLUDED.entity_resolver,
  entity_type = EXCLUDED.entity_type,
  amount_resolver = EXCLUDED.amount_resolver,
  reference_type = EXCLUDED.reference_type,
  reference_id_resolver = EXCLUDED.reference_id_resolver,
  metadata_resolvers = EXCLUDED.metadata_resolvers,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority,
  dry_run = EXCLUDED.dry_run,
  notes = EXCLUDED.notes,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at
`.trim();
}

async function main() {
  console.log('sync-action-sources-dev-to-prod');
  console.log('Region:', REGION);

  const dev = resolveRdsTarget(DEV_CLUSTER, DEV_SECRET);
  const prod = resolveRdsTarget(PROD_CLUSTER, PROD_SECRET);

  console.log('Dev cluster:', dev.resourceArn.split(':').pop());
  console.log('Prod cluster:', prod.resourceArn.split(':').pop());

  const client = new RDSDataClient({ region: REGION });

  const selectRes = await client.send(
    new ExecuteStatementCommand({
      resourceArn: dev.resourceArn,
      secretArn: dev.secretArn,
      database: dev.database,
      sql: 'SELECT * FROM action_sources ORDER BY priority DESC NULLS LAST, updated_at DESC NULLS LAST, id ASC',
      formatRecordsAs: 'JSON',
    })
  );

  const raw = selectRes.formattedRecords;
  if (!raw) {
    console.log('No formattedRecords (0 rows or error).');
    return;
  }

  const rows = JSON.parse(raw);
  console.log(`Dev rows: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nothing to copy.');
    return;
  }

  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `${row.method || '?'} ${row.route_pattern || '?'} -> ${row.action_name || '?'}`;
    const sql = buildUpsertSql(row);
    if (sql.length > 60000) {
      console.error(`Row ${i + 1} SQL too large, skip: ${label}`);
      continue;
    }
    try {
      await client.send(
        new ExecuteStatementCommand({
          resourceArn: prod.resourceArn,
          secretArn: prod.secretArn,
          database: prod.database,
          sql,
        })
      );
      ok++;
      console.log(`[${i + 1}/${rows.length}] OK ${label}`);
    } catch (e) {
      console.error(`[${i + 1}/${rows.length}] FAIL ${label}`);
      console.error(e.message || e);
      process.exit(1);
    }
  }

  const verify = await client.send(
    new ExecuteStatementCommand({
      resourceArn: prod.resourceArn,
      secretArn: prod.secretArn,
      database: prod.database,
      sql: 'SELECT COUNT(*)::int AS n FROM action_sources',
      formatRecordsAs: 'JSON',
    })
  );
  const vrows = JSON.parse(verify.formattedRecords || '[{"n":0}]');
  console.log(`Prod action_sources count: ${vrows[0]?.n ?? '?'}`);
  console.log(`Done. Upserted ${ok} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
