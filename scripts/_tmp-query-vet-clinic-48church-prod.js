/**
 * Prod: Vet Clinic @ 48 Church Street + ledger expansion
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const VIDS = [
  'fc1b4292-ca38-4bd9-b046-7b7d37bc4493', // Vet Clinc, 48 Church Street
  '1b20d8bb-370b-4a4d-9bae-58375d5c5497', // Praveen vet clinic, same phone
];

function target() {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${SECRET_NAME} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

async function q(client, t, sql) {
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: REGION });
  const t = target();

  const exact = await q(
    client,
    t,
    `SELECT id::text, business_name, address, phone, tier,
            total_earnings::text, pending_payout::text, commission_percentage::text
     FROM vendors
     WHERE trim(business_name) ILIKE 'vet clinic'
        OR id IN (${VIDS.map((id) => `'${id}'::uuid`).join(',')})`
  );
  console.log('=== Vendors (exact Vet Clinic + 48 Church ids) ===\n', JSON.stringify(exact, null, 2));

  for (const vid of VIDS) {
    console.log('\n' + '#'.repeat(60), '\nVENDOR_ID', vid);
    const info = await q(
      client,
      t,
      `SELECT business_name, address, phone, total_earnings::text, pending_payout::text FROM vendors WHERE id='${vid}'::uuid`
    );
    console.log('Row:', JSON.stringify(info[0], null, 2));

    const ve = await q(
      client,
      t,
      `SELECT COUNT(*)::int AS n, ROUND(COALESCE(SUM(amount),0)::numeric,2)::text AS sum_amt,
              ROUND(COALESCE(SUM(amount) FILTER (WHERE status='pending'),0)::numeric,2)::text AS pending_amt
       FROM vendor_earnings WHERE vendor_id='${vid}'::uuid`
    );
    console.log('vendor_earnings:', ve[0]);

    const ds = await q(
      client,
      t,
      `SELECT COUNT(*)::int AS n, ROUND(COALESCE(SUM(net_payout),0)::numeric,2)::text AS sum_net
       FROM delivery_settlements WHERE vendor_id='${vid}'::uuid`
    );
    console.log('delivery_settlements:', ds[0]);

    const recent = await q(
      client,
      t,
      `SELECT ve.amount::text, ve.status, ve.realized_at::text, c.full_name
       FROM vendor_earnings ve
       LEFT JOIN bookings b ON b.id = ve.booking_id
       LEFT JOIN customers c ON c.id = b.customer_id
       WHERE ve.vendor_id='${vid}'::uuid
       ORDER BY ve.realized_at DESC NULLS LAST LIMIT 5`
    );
    console.log('Recent earnings:', JSON.stringify(recent, null, 2));
  }

  // Same phone — all vendor rows + combined ledger
  console.log('\n=== Phone 8296974568 — all vendors + combined earnings ===');
  const phone = await q(
    client,
    t,
    `SELECT v.id::text, v.business_name, v.address,
            v.total_earnings::text, v.pending_payout::text,
            (SELECT COUNT(*)::int FROM vendor_earnings ve WHERE ve.vendor_id = v.id) AS ve_rows,
            (SELECT ROUND(COALESCE(SUM(ve.amount),0)::numeric,2)::text FROM vendor_earnings ve WHERE ve.vendor_id = v.id) AS ve_sum
     FROM vendors v WHERE v.phone = '8296974568'`
  );
  console.log(JSON.stringify(phone, null, 2));

  const combined = await q(
    client,
    t,
    `SELECT COUNT(*)::int AS n, ROUND(COALESCE(SUM(amount),0)::numeric,2)::text AS sum_amt
     FROM vendor_earnings
     WHERE vendor_id IN (SELECT id FROM vendors WHERE phone = '8296974568')`
  );
  console.log('Combined vendor_earnings for phone:', combined[0]);

  // Find ~90199.8 in any vendor total_earnings
  console.log('\n=== vendors.total_earnings near 90199 ===');
  const near = await q(
    client,
    t,
    `SELECT id::text, business_name, address, phone, total_earnings::text, pending_payout::text
     FROM vendors
     WHERE total_earnings BETWEEN 90000 AND 90500
     ORDER BY total_earnings DESC
     LIMIT 20`
  );
  console.log(JSON.stringify(near, null, 2));

  // Praveen D tele consult today
  console.log('\n=== Tele-Consultation ~9 INR on 2026-05-27 IST ===');
  const tele = await q(
    client,
    t,
    `SELECT ve.vendor_id::text, v.business_name, ve.amount::text, ve.status, ve.realized_at::text, c.full_name
     FROM vendor_earnings ve
     JOIN vendors v ON v.id = ve.vendor_id
     LEFT JOIN bookings b ON b.id = ve.booking_id
     LEFT JOIN customers c ON c.id = b.customer_id
     WHERE c.full_name ILIKE '%praveen%'
       AND ve.realized_at >= '2026-05-26'::timestamptz
       AND ve.amount BETWEEN 8 AND 10
     ORDER BY ve.realized_at DESC
     LIMIT 10`
  );
  console.log(JSON.stringify(tele, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
