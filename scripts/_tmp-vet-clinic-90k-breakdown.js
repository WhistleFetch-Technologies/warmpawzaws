const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const VID = 'fc1b4292-ca38-4bd9-b046-7b7d37bc4493';

function target() {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ${REGION} --output json`,
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

  const bySvc = await q(
    client,
    t,
    `SELECT COALESCE(sc.service_name, s.name, 'unknown') AS svc,
            COUNT(*)::int AS n,
            ROUND(SUM(ve.amount)::numeric, 2)::text AS sum_amt,
            ROUND(MAX(ve.amount)::numeric, 2)::text AS max_amt
     FROM vendor_earnings ve
     LEFT JOIN bookings b ON b.id = ve.booking_id
     LEFT JOIN service_catalog sc ON b.service_id = sc.id
     LEFT JOIN services s ON b.service_id = s.id
     WHERE ve.vendor_id = '${VID}'::uuid
     GROUP BY 1
     ORDER BY SUM(ve.amount) DESC`
  );
  console.log('BY SERVICE:\n', JSON.stringify(bySvc, null, 2));

  const all = await q(
    client,
    t,
    `SELECT ve.amount::text AS vendor_amt,
            ve.total_amount::text AS gross,
            ve.commission_amount::text AS commission,
            ve.commission_rate::text AS rate,
            ve.booking_id::text,
            b.total_amount::text AS booking_total,
            b.payment_status,
            ve.status,
            ve.realized_at::text,
            COALESCE(sc.service_name, s.name) AS svc,
            c.full_name
     FROM vendor_earnings ve
     LEFT JOIN bookings b ON b.id = ve.booking_id
     LEFT JOIN service_catalog sc ON b.service_id = sc.id
     LEFT JOIN services s ON b.service_id = s.id
     LEFT JOIN customers c ON c.id = b.customer_id
     WHERE ve.vendor_id = '${VID}'::uuid
     ORDER BY ve.amount::numeric DESC`
  );
  console.log('\nALL ROWS (' + all.length + '):\n', JSON.stringify(all, null, 2));

  const periods = await q(
    client,
    t,
    `SELECT
       ROUND(COALESCE(SUM(amount) FILTER (
         WHERE realized_at >= (timezone('Asia/Kolkata', now()))::date AT TIME ZONE 'Asia/Kolkata'
       ), 0)::numeric, 2)::text AS today_ist,
       ROUND(COALESCE(SUM(amount) FILTER (
         WHERE realized_at >= ((timezone('Asia/Kolkata', now()))::date - interval '6 days') AT TIME ZONE 'Asia/Kolkata'
       ), 0)::numeric, 2)::text AS week_ist,
       ROUND(COALESCE(SUM(amount) FILTER (
         WHERE realized_at >= date_trunc('month', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata'
       ), 0)::numeric, 2)::text AS month_ist,
       ROUND(COALESCE(SUM(amount), 0)::numeric, 2)::text AS lifetime
     FROM vendor_earnings
     WHERE vendor_id = '${VID}'::uuid`
  );
  console.log('\nPERIODS (IST):', periods[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
