const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const sid = '86f89155-0c60-477d-b7b0-68d82c4feaba';

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

async function q(client, t, sql) {
  const r = await client.send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: 'ap-south-1' });
  const t = target();
  console.log(
    await q(
      client,
      t,
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'service_catalog' AND column_name ILIKE '%price%'`
    )
  );
  console.log(
    await q(
      client,
      t,
      `SELECT * FROM service_catalog WHERE id = '${sid}'::uuid`
    )
  );
  console.log(
    await q(client, t, `SELECT * FROM vendor_services WHERE id = '${sid}'::uuid`)
  );
}

main();
