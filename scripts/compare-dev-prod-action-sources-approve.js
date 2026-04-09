/** Compare action_sources for vendor approval paths: dev vs prod RDS */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const sql = `
SELECT route_pattern, method, enabled, success_predicate, action_name
FROM action_sources
WHERE action_name = 'vendor_refer_friend_who_joins'
   OR route_pattern ILIKE '%vendor/application%approve%'
ORDER BY route_pattern, action_name
`;

function target(clusterId, secretId) {
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
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

async function main() {
  const prod = target('warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001');
  const dev = target('warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002');
  const client = new RDSDataClient({ region: REGION });
  for (const [name, t] of [
    ['PROD', prod],
    ['DEV', dev],
  ]) {
    const r = await client.send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
    const rows = r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
    console.log(`\n=== ${name} (${rows.length} rows) ===`);
    console.log(JSON.stringify(rows, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
