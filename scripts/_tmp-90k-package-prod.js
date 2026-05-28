const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

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
  const client = new RDSDataClient({ region: 'ap-south-1' });
  const t = target();

  const child = await q(
    client,
    t,
    `SELECT is_package_session, package_purchase_id::text, parent_booking_id::text, notes
     FROM bookings WHERE id = '${BID}'::uuid`
  );
  console.log('CHILD BOOKING:', JSON.stringify(child, null, 2));
  const ppId = child[0]?.package_purchase_id;

  let pkg = [];
  if (ppId) {
    pkg = await q(
      client,
      t,
      `SELECT id::text, package_name, package_price::text, amount::text, total_with_tax::text,
              total_sessions, remaining_sessions, status, created_at::text, vendor_id::text
       FROM package_purchases WHERE id = '${ppId}'::uuid`
    );
  }
  console.log('PACKAGE PURCHASE:', JSON.stringify(pkg, null, 2));

  const pss2 = await q(
    client,
    t,
    `SELECT pss.id::text, pss.package_purchase_id::text, pss.session_number, pss.status,
            pss.booking_id::text
     FROM package_scheduled_sessions pss
     WHERE pss.booking_id = '${BID}'::uuid`
  );
  console.log('SCHEDULED SESSION:', JSON.stringify(pss2, null, 2));

  if (ppId) {
    const parent = await q(
      client,
      t,
      `SELECT b.id::text, b.total_amount::text, b.payment_status, b.notes, b.status,
              b.is_package_session
       FROM bookings b
       WHERE b.package_purchase_id = '${ppId}'::uuid
         AND COALESCE(b.is_package_session, false) = false`
    );
    console.log('PARENT PACKAGE BOOKING:', JSON.stringify(parent, null, 2));

    const sessions = await q(
      client,
      t,
      `SELECT COUNT(*)::int AS slot_count,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count
       FROM package_scheduled_sessions WHERE package_purchase_id = '${ppId}'::uuid`
    );
    console.log('SESSION SLOTS:', JSON.stringify(sessions, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
