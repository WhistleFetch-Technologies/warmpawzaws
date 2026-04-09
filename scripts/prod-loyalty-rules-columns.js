const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const R = 'ap-south-1';
(async () => {
  const c = JSON.parse(
    execSync(
      'aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ' +
        R +
        ' --output json',
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(
      'aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ' +
        R +
        ' --output json',
      { encoding: 'utf8' }
    )
  );
  const t = { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
  const client = new RDSDataClient({ region: R });
  const cols = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loyalty_rules' ORDER BY 1`,
      formatRecordsAs: 'JSON',
    })
  );
  console.log('columns:', JSON.parse(cols.formattedRecords || '[]').map((x) => x.column_name));
  const rows = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT * FROM loyalty_rules WHERE is_active = true`,
      formatRecordsAs: 'JSON',
    })
  );
  console.log('active:', rows.formattedRecords);
})();
