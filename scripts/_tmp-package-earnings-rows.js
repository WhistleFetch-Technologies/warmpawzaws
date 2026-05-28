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

async function q(client, t, sql) {
  const r = await client.send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: 'ap-south-1' });
  const t = target();
  const pp = 'a9ac49a3-9267-439b-895f-0b216fb24740';

  console.log(
    await q(
      client,
      t,
      `SELECT ve.booking_id::text, ve.amount::text, ve.total_amount::text,
              b.is_package_session, b.total_amount::text AS booking_total
       FROM vendor_earnings ve
       JOIN bookings b ON b.id = ve.booking_id
       WHERE b.package_purchase_id = '${pp}'::uuid`
    )
  );

  console.log(
    '\nParent:',
    await q(
      client,
      t,
      `SELECT id::text, total_amount::text, base_price::text, created_at::text, updated_at::text
       FROM bookings WHERE id = '660b0acd-9ba4-4318-b1e4-dbb78c0dfc72'::uuid`
    )
  );

  // Expected slice: 118/14
  console.log('\nExpected per session gross ~', (118 / 14).toFixed(2));
}

main();
