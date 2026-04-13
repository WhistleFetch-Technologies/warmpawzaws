const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const BID = 'fe38c44e-b830-4b6a-b32a-9059c9c2f8c7';
const CID = '505f9d3b-8391-4a22-ba27-eda0cf192b37';
const PAY = 'pay_SbjVXO2ygtgVV6';
const OID = 'order_SbjVONMRDrfhQX';

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
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

(async () => {
  const t = target();
  const c = new RDSDataClient({ region: REGION });

  console.log('=== booking row (loyalty classification inputs) ===');
  console.log(
    JSON.stringify(
      await q(
        c,
        t,
        `SELECT b.id::text, b.service_type, b.customer_id::text, b.total_amount::text, b.payment_status, b.status,
                v.vendor_type, vs.service_name
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN vendor_services vs ON b.service_id = vs.id
         WHERE b.id = '${BID}'::uuid`
      ),
      null,
      2
    )
  );

  console.log('\n=== payments row ===');
  console.log(
    JSON.stringify(
      await q(
        c,
        t,
        `SELECT id::text, booking_id::text, pharmacy_order_id::text, amount::text, payment_status, razorpay_payment_id, razorpay_order_id
         FROM payments WHERE razorpay_payment_id = '${PAY}' OR booking_id = '${BID}'::uuid OR razorpay_order_id = '${OID}'
         ORDER BY updated_at DESC NULLS LAST LIMIT 5`
      ),
      null,
      2
    )
  );

  console.log('\n=== processed_events (booking ref) ===');
  console.log(
    JSON.stringify(
      await q(
        c,
        t,
        `SELECT event_id, action_name, reference_type, reference_id::text, created_at
         FROM processed_events
         WHERE reference_type = 'booking' AND reference_id::text = '${BID}'
         ORDER BY created_at DESC LIMIT 10`
      ),
      null,
      2
    )
  );

  console.log('\n=== loyalty_transactions (booking ref) ===');
  console.log(
    JSON.stringify(
      await q(
        c,
        t,
        `SELECT id::text, points, reference_type, reference_id::text, description, created_at
         FROM loyalty_transactions
         WHERE customer_id = '${CID}'::uuid AND reference_id::text = '${BID}'
         ORDER BY created_at DESC LIMIT 10`
      ),
      null,
      2
    )
  );

  console.log('\n=== action_sources verify-payment book_vet + buy_medicine predicates ===');
  console.log(
    JSON.stringify(
      await q(
        c,
        t,
        `SELECT action_name, success_predicate, route_pattern
         FROM action_sources
         WHERE method = 'POST' AND route_pattern LIKE '%verify-payment%' AND action_name IN ('book_vet_consultation','buy_medicine')`
      ),
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
