/**
 * Fix action_sources for customer signup on POST /auth/verify-otp and /auth/otp/verify.
 * Uses RDS Data API (same backend as: aws rds-data execute-statement).
 *
 *   node scripts/apply-signup-action-sources-dev-prod.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';

const TARGETS = [
  {
    label: 'DEV',
    clusterId: 'warmpawz-dev-cluster',
    secretId: 'warmpawz-dev-rds-master-20260106164510791100000002',
  },
  {
    label: 'PROD',
    clusterId: 'warmpawz-prod-cluster',
    secretId: 'warmpawz-prod-rds-master-20260207201049162400000001',
  },
];

function resolveTarget(clusterId, secretId) {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${secretId} --region ${REGION} --output json`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit'],
    })
  );
  return {
    resourceArn: c.DBClusterArn,
    secretArn: s.ARN,
    database: c.DatabaseName || 'warmpawz',
  };
}

const UPDATE_SQL = `
UPDATE action_sources
SET
  success_predicate = '$.data.data.state == ''new''',
  entity_resolver = '$.data.data.user.id || $.jwt.sub',
  enabled = true,
  updated_at = NOW()
WHERE method = 'POST'
  AND action_name = 'signup'
  AND route_pattern IN ('/auth/verify-otp', '/auth/otp/verify');
`;

/** Clone verify-otp signup row to otp/verify when missing (same handler, different path). */
const INSERT_ALIAS_SQL = `
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max,
  success_predicate, action_name, entity_resolver, entity_type,
  metadata_resolvers, enabled, priority, dry_run, updated_at
)
SELECT s.source_type, '/auth/otp/verify', s.method, s.status_min, s.status_max,
       '$.data.data.state == ''new''',
       s.action_name,
       '$.data.data.user.id || $.jwt.sub',
       s.entity_type,
       s.metadata_resolvers,
       true,
       s.priority,
       s.dry_run,
       NOW()
FROM action_sources s
WHERE s.route_pattern = '/auth/verify-otp'
  AND s.method = 'POST'
  AND s.action_name = 'signup'
  AND NOT EXISTS (
    SELECT 1 FROM action_sources x
    WHERE x.method = 'POST'
      AND x.route_pattern = '/auth/otp/verify'
      AND x.action_name = 'signup'
  )
LIMIT 1;
`;

const VERIFY_SQL = `
SELECT route_pattern, enabled, success_predicate, entity_resolver
FROM action_sources
WHERE method = 'POST'
  AND action_name = 'signup'
  AND route_pattern IN ('/auth/verify-otp', '/auth/otp/verify')
ORDER BY route_pattern;
`;

async function main() {
  const client = new RDSDataClient({ region: REGION });

  for (const { label, clusterId, secretId } of TARGETS) {
    const t = resolveTarget(clusterId, secretId);
    console.log(`\n========== ${label} ==========`);

    const upd = await client.send(
      new ExecuteStatementCommand({ ...t, sql: UPDATE_SQL, includeResultMetadata: true })
    );
    console.log('UPDATE rows:', upd.numberOfRecordsUpdated ?? '(n/a)');

    const ins = await client.send(
      new ExecuteStatementCommand({ ...t, sql: INSERT_ALIAS_SQL, includeResultMetadata: true })
    );
    console.log('INSERT (alias) rows:', ins.numberOfRecordsUpdated ?? ins.updateResults ?? '(n/a)');

    const sel = await client.send(
      new ExecuteStatementCommand({ ...t, sql: VERIFY_SQL, formatRecordsAs: 'JSON' })
    );
    const rows = sel.formattedRecords ? JSON.parse(sel.formattedRecords) : [];
    console.log('Current rows:', JSON.stringify(rows, null, 2));
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
