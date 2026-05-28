const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

function target() {
  const c = JSON.parse(
    execSync(
      'aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ap-south-1 --output json',
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(
      'aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ap-south-1 --output json',
      { encoding: 'utf8' }
    )
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

async function main() {
  const client = new RDSDataClient({ region: 'ap-south-1' });
  const t = target();
  const sql = `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'support_tickets'
       AND column_name LIKE '%refund%'
     ORDER BY column_name`;
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  const cols = r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
  console.log('support_tickets refund-related columns:', cols.length ? cols : '(none)');
}

main();
