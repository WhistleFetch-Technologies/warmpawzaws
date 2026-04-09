/**
 * Compare loyalty_transactions columns: dev vs prod (RDS Data API).
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const SQL = `
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'loyalty_transactions'
ORDER BY ordinal_position
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
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: c.DatabaseName || 'warmpawz' };
}

async function cols(client, t) {
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql: SQL, formatRecordsAs: 'JSON' })
  );
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: REGION });
  const dev = target('warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002');
  const prod = target('warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001');

  const devCols = await cols(client, dev);
  const prodCols = await cols(client, prod);

  const devNames = new Set(devCols.map((c) => c.column_name));
  const prodNames = new Set(prodCols.map((c) => c.column_name));

  console.log('=== DEV loyalty_transactions columns ===');
  console.log(devCols.map((c) => `${c.column_name} (${c.data_type})`).join('\n'));
  console.log('\n=== PROD loyalty_transactions columns ===');
  console.log(prodCols.map((c) => `${c.column_name} (${c.data_type})`).join('\n'));

  console.log('\n=== In DEV, not in PROD ===');
  for (const n of devNames) if (!prodNames.has(n)) console.log(' ', n);
  console.log('=== In PROD, not in DEV ===');
  for (const n of prodNames) if (!devNames.has(n)) console.log(' ', n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
