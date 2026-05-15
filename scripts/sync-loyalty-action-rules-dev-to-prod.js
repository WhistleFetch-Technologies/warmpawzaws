#!/usr/bin/env node
/**
 * Copy all rows from dev `loyalty_action_rules` to prod (upsert on action_name).
 * Uses RDS Data API + @aws-sdk/client-rds-data (same pattern as sync-action-sources-dev-to-prod.js).
 *
 *   node scripts/sync-loyalty-action-rules-dev-to-prod.js
 *
 * Env: AWS_REGION (default ap-south-1)
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
  if (obj == null) return "'{}'::jsonb";
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return "'{}'::jsonb";
    }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) return "'{}'::jsonb";
  const s = JSON.stringify(obj);
  return "'" + s.replace(/'/g, "''") + "'::jsonb";
}

function sqlBool(v) {
  return v === true || v === 'true' || v === 't' || v === 1 ? 'true' : 'false';
}

function sqlNum(v) {
  if (v == null || v === '') return 'NULL';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : 'NULL';
}

function sqlInt(v) {
  if (v == null || v === '') return 'NULL';
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? String(n) : 'NULL';
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

function buildRuleUpsertSql(row) {
  const r = row;
  const actionName = r.action_name;
  if (!actionName) throw new Error('row missing action_name');

  const priorityVal = (() => {
    const p = r.priority;
    if (p == null || p === '') return '100';
    const n = parseInt(String(p), 10);
    return Number.isFinite(n) ? String(n) : '100';
  })();

  const vals = [
    sqlUuid(r.id),
    sqlStr(actionName),
    sqlStr(r.action_category),
    sqlStr(r.user_type),
    sqlStr(r.points_type),
    sqlNum(r.points_value) === 'NULL' ? '0' : sqlNum(r.points_value),
    sqlNum(r.base_amount),
    sqlNum(r.min_amount),
    sqlInt(r.max_points_per_transaction),
    r.frequency_type == null || r.frequency_type === '' ? 'NULL' : sqlStr(r.frequency_type),
    sqlInt(r.frequency_limit),
    r.frequency_period == null || r.frequency_period === '' ? 'NULL' : sqlStr(r.frequency_period),
    sqlJsonb(r.conditions),
    sqlJsonb(r.multiplier_conditions),
    sqlBool(r.is_active !== false && r.is_active !== 'false' && r.is_active !== 0),
    priorityVal,
    r.description == null || r.description === '' ? 'NULL' : sqlStr(r.description),
    r.notes == null || r.notes === '' ? 'NULL' : sqlStr(r.notes),
    sqlTimestamptz(r.created_at),
    sqlTimestamptz(r.updated_at),
  ];

  return `
INSERT INTO loyalty_action_rules (
  id, action_name, action_category, user_type, points_type, points_value,
  base_amount, min_amount, max_points_per_transaction,
  frequency_type, frequency_limit, frequency_period,
  conditions, multiplier_conditions,
  is_active, priority, description, notes, created_at, updated_at
) VALUES (
  ${vals.join(', ')}
)
ON CONFLICT (action_name) DO UPDATE SET
  id = EXCLUDED.id,
  action_category = EXCLUDED.action_category,
  user_type = EXCLUDED.user_type,
  points_type = EXCLUDED.points_type,
  points_value = EXCLUDED.points_value,
  base_amount = EXCLUDED.base_amount,
  min_amount = EXCLUDED.min_amount,
  max_points_per_transaction = EXCLUDED.max_points_per_transaction,
  frequency_type = EXCLUDED.frequency_type,
  frequency_limit = EXCLUDED.frequency_limit,
  frequency_period = EXCLUDED.frequency_period,
  conditions = EXCLUDED.conditions,
  multiplier_conditions = EXCLUDED.multiplier_conditions,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description,
  notes = EXCLUDED.notes,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at
`.trim();
}

async function main() {
  console.log('sync-loyalty-action-rules-dev-to-prod');
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
      sql: 'SELECT * FROM loyalty_action_rules ORDER BY action_name ASC',
      formatRecordsAs: 'JSON',
    })
  );

  const raw = selectRes.formattedRecords;
  if (!raw) {
    console.log('No formattedRecords (0 rows or error).');
    return;
  }

  const rows = JSON.parse(raw);
  console.log(`Dev loyalty_action_rules rows: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nothing to copy.');
    return;
  }

  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = row.action_name || `row ${i + 1}`;
    let sql;
    try {
      sql = buildRuleUpsertSql(row);
    } catch (e) {
      console.error(`[${i + 1}/${rows.length}] SKIP build error: ${label}`, e.message || e);
      continue;
    }
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
      sql: 'SELECT COUNT(*)::int AS n FROM loyalty_action_rules',
      formatRecordsAs: 'JSON',
    })
  );
  const vrows = JSON.parse(verify.formattedRecords || '[{"n":0}]');
  console.log(`Prod loyalty_action_rules count: ${vrows[0]?.n ?? '?'}`);
  console.log(`Done. Upserted ${ok} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
