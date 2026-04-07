const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';

function resolveDev() {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id warmpawz-dev-rds-master-20260106164510791100000002 --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: c.DatabaseName || 'warmpawz' };
}

async function main() {
  const t = resolveDev();
  const client = new RDSDataClient({ region: REGION });

  const cols = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'loyalty_rules'
            ORDER BY ordinal_position`,
      formatRecordsAs: 'JSON',
    })
  );
  console.log('=== loyalty_rules columns ===');
  console.log(cols.formattedRecords || '[]');

  const rows = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT * FROM loyalty_rules ORDER BY rule_name`,
      formatRecordsAs: 'JSON',
    })
  );
  console.log('=== loyalty_rules rows ===');
  console.log(rows.formattedRecords || '[]');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
