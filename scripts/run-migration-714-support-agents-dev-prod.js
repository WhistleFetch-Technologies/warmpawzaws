/**
 * Apply db/migrations/714_support_agents_table.sql on DEV + PROD via RDS Data API.
 * Use when direct psql to cluster endpoint times out (VPC-only RDS).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = process.env.AWS_REGION || 'ap-south-1';

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

async function main() {
  const sqlPath = path.join(__dirname, '..', 'db', 'migrations', '714_support_agents_table.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Missing:', sqlPath);
    process.exit(1);
  }
  const statements = splitSql(sqlPath);
  const client = new RDSDataClient({ region: REGION });
  for (const [label, t] of [
    ['DEV', target('warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002')],
    ['PROD', target('warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001')],
  ]) {
    for (const sql of statements) {
      await client.send(new ExecuteStatementCommand({ ...t, sql: sql + ';', formatRecordsAs: 'JSON' }));
    }
    console.log(`${label}: OK (${statements.length} statements)`);
  }
  console.log('714 support_agents applied on dev + prod.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
