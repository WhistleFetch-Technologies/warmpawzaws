/**
 * One-off: prod payment investigation for a booking.
 * Usage: node scripts/_tmp-query-booking-payment.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const BOOKING_ID = process.argv[2] || '5c4dfd94-186d-484e-9699-5b900becaf73';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

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

async function execJson(client, t, sql) {
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: REGION });
  const t = target();
  const bid = BOOKING_ID.replace(/'/g, "''");

  console.log('Booking ID:', BOOKING_ID);
  console.log('Environment: PROD\n');

  const booking = await execJson(
    client,
    t,
    `SELECT id, status, payment_status, total_amount, base_price, discount_amount,
            customer_id, vendor_id, service_type, booking_date, booking_time,
            created_at, updated_at
     FROM bookings WHERE id = '${bid}'::uuid`
  );

  const payments = await execJson(
    client,
    t,
    `SELECT id, payment_status, payment_method, amount, currency,
            razorpay_order_id, razorpay_payment_id, wallet_amount_used,
            loyalty_points_used, discount_amount, coupon_code,
            failure_reason, transaction_id, created_at, completed_at, updated_at
     FROM payments WHERE booking_id = '${bid}'::uuid
     ORDER BY created_at DESC`
  );

  let wallet = [];
  try {
    wallet = await execJson(
      client,
      t,
      `SELECT id, transaction_type, amount, balance_after, description, created_at,
              reference_type, reference_id
       FROM wallet_transactions
       WHERE reference_type = 'booking' AND reference_id = '${bid}'
       ORDER BY created_at DESC`
    );
  } catch (e) {
    wallet = [{ error: e.message }];
  }

  const orphanOrders = await execJson(
    client,
    t,
    `SELECT id, booking_id, payment_status, payment_method, amount,
            razorpay_order_id, razorpay_payment_id, customer_id, created_at
     FROM payments
     WHERE customer_id = (SELECT customer_id FROM bookings WHERE id = '${bid}'::uuid)
       AND created_at >= (SELECT created_at - interval '2 hours' FROM bookings WHERE id = '${bid}'::uuid)
       AND created_at <= (SELECT created_at + interval '2 hours' FROM bookings WHERE id = '${bid}'::uuid)
     ORDER BY created_at DESC
     LIMIT 20`
  );

  console.log('=== BOOKING ===');
  console.log(JSON.stringify(booking, null, 2));
  console.log('\n=== PAYMENTS (linked to booking) ===');
  console.log(JSON.stringify(payments, null, 2));
  console.log('\n=== WALLET TRANSACTIONS ===');
  console.log(JSON.stringify(wallet, null, 2));
  console.log('\n=== PAYMENTS near booking time (same customer ±2h) ===');
  console.log(JSON.stringify(orphanOrders, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
