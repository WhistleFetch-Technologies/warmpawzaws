const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const BID = '2ffd3a74-f73b-4c1f-b715-1d82986a4a67';

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
  const client = new RDSDataClient({ region: REGION });
  const t = target();

  const b = await q(
    client,
    t,
    `SELECT id::text, vendor_id::text, customer_id::text, status, payment_status,
            total_amount::text, base_price::text, service_id::text,
            booking_date::text, created_at::text, notes
     FROM bookings WHERE id = '${BID}'::uuid`
  );
  console.log('BOOKING:\n', JSON.stringify(b, null, 2));

  const ve = await q(
    client,
    t,
    `SELECT id::text, amount::text, total_amount::text, commission_amount::text,
            commission_rate::text, status, realized_at::text, created_at::text
     FROM vendor_earnings WHERE booking_id = '${BID}'::uuid`
  );
  console.log('\nVENDOR_EARNINGS:\n', JSON.stringify(ve, null, 2));

  for (const table of ['payments', 'razorpay_orders', 'booking_payments']) {
    try {
      const p = await q(
        client,
        t,
        `SELECT * FROM ${table} WHERE booking_id = '${BID}'::uuid LIMIT 5`
      );
      if (p.length) console.log(`\n${table}:`, JSON.stringify(p, null, 2));
    } catch (e) {
      console.log(`\n${table}: (skip)`, e.message?.slice(0, 80));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
