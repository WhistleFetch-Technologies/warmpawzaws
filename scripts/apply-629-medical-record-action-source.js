#!/usr/bin/env node
/**
 * Apply db/migrations/629_action_source_put_medical_records_update_health.sql to dev + prod RDS.
 * Ensures loyalty_action_rules.update_health_record exists (043 seed) via ON CONFLICT DO NOTHING.
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';

const TARGETS = [
  ['DEV', 'warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002'],
  ['PROD', 'warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001'],
];

function resolveTarget(clusterId, secretId) {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${secretId} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  );
  return {
    resourceArn: c.DBClusterArn,
    secretArn: s.ARN,
    database: c.DatabaseName || 'warmpawz',
  };
}

// RDS Data API: one SQL statement per execute. Matches db/migrations/629_*.sql
const SQL_ACTION_INSERT = `
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_resolver, entity_type, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/medical-records/:recordId', 'PUT', 200, 299, '$.success',
  'update_health_record', '$.customerId', 'customer', 'medical_record', '$.recordId',
  '{}'::jsonb, true, 100, false,
  'Customer medical record update; entity from customerId; reference recordId for audit'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'PUT' AND a.route_pattern = '/medical-records/:recordId'
    AND a.action_name = 'update_health_record'
)
`.trim();

const SQL_ACTION_UPDATE = `
UPDATE action_sources SET
  success_predicate = '$.success',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'medical_record',
  reference_id_resolver = '$.recordId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'Customer medical record update; entity from customerId; reference recordId for audit',
  updated_at = NOW()
WHERE method = 'PUT' AND route_pattern = '/medical-records/:recordId'
  AND action_name = 'update_health_record'
`.trim();

const SQL_RULE = `
INSERT INTO loyalty_action_rules (
  action_name, action_category, user_type, points_type, points_value, base_amount,
  frequency_type, description, notes, is_active
)
SELECT
  'update_health_record', 'loyalty', 'customer', 'fixed', 50, NULL,
  'recurring', 'Update Last Health Record Digitally',
  'Encourages digilocker of all health data', true
WHERE NOT EXISTS (
  SELECT 1 FROM loyalty_action_rules r WHERE r.action_name = 'update_health_record'
)
`.trim();

async function runSql(client, t, label, sql) {
  await client.send(
    new ExecuteStatementCommand({
      resourceArn: t.resourceArn,
      secretArn: t.secretArn,
      database: t.database,
      sql,
    })
  );
  console.log(`OK ${label}`);
}

async function verify(client, t) {
  const sql = `
SELECT a.method, a.route_pattern, a.action_name, a.enabled, a.entity_resolver,
       (SELECT r.is_active FROM loyalty_action_rules r WHERE r.action_name = a.action_name LIMIT 1) AS rule_active
FROM action_sources a
WHERE a.method = 'PUT' AND a.route_pattern = '/medical-records/:recordId' AND a.action_name = 'update_health_record'
`;
  const r = await client.send(
    new ExecuteStatementCommand({
      resourceArn: t.resourceArn,
      secretArn: t.secretArn,
      database: t.database,
      sql,
      formatRecordsAs: 'JSON',
    })
  );
  const rows = r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
  console.log('verify:', JSON.stringify(rows, null, 2));
}

async function main() {
  const client = new RDSDataClient({ region: REGION });
  for (const [name, clusterId, secretId] of TARGETS) {
    console.log(`\n=== ${name} ===`);
    const t = resolveTarget(clusterId, secretId);
    await runSql(client, t, `${name} action_sources INSERT`, SQL_ACTION_INSERT);
    await runSql(client, t, `${name} action_sources UPDATE`, SQL_ACTION_UPDATE);
    await runSql(client, t, `${name} loyalty_action_rules`, SQL_RULE);
    await verify(client, t);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
