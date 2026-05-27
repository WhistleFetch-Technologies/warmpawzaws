/**
 * Prod: partial refund + Razorpay webhook trace for booking aeef3b4c...
 * Customer phone 8296974568
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const BOOKING_ID = 'aeef3b4c-e673-467c-8b80-3cac1e9a2654';
const PHONE = '8296974568';

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

  console.log('=== Customer by phone', PHONE, '===\n');
  const customers = await q(
    client,
    t,
    `SELECT id::text, phone, full_name, email, created_at::text
     FROM customers WHERE phone = '${PHONE}' OR phone LIKE '%${PHONE.slice(-10)}%'
     ORDER BY created_at DESC LIMIT 5`
  );
  console.log(JSON.stringify(customers, null, 2));

  console.log('\n=== Booking', BOOKING_ID, '===\n');
  const booking = await q(
    client,
    t,
    `SELECT b.id::text, b.status, b.payment_status, b.total_amount::text, b.base_price::text,
            b.vendor_id::text, v.business_name, b.customer_id::text, c.full_name, c.phone,
            b.created_at::text, b.updated_at::text, b.cancelled_at::text, b.notes
     FROM bookings b
     LEFT JOIN customers c ON c.id = b.customer_id
     LEFT JOIN vendors v ON v.id = b.vendor_id
     WHERE b.id = '${BOOKING_ID}'::uuid`
  );
  console.log(JSON.stringify(booking, null, 2));

  console.log('\n=== Payments for booking ===\n');
  const payments = await q(
    client,
    t,
    `SELECT id::text, amount::text, payment_status, payment_method,
            razorpay_payment_id, razorpay_order_id, transaction_id,
            created_at::text, updated_at::text, completed_at::text, failure_reason
     FROM payments
     WHERE booking_id = '${BOOKING_ID}'::uuid
     ORDER BY created_at`
  );
  console.log(JSON.stringify(payments, null, 2));

  console.log('\n=== Refunds for booking ===\n');
  const refunds = await q(
    client,
    t,
    `SELECT r.id::text, r.refund_amount::text, r.refund_status, r.refund_reason,
            r.refund_method, r.razorpay_refund_id,
            r.requested_at::text, r.processed_at::text, r.completed_at::text,
            r.rejection_reason,
            p.razorpay_payment_id, p.amount::text AS payment_amount
     FROM refunds r
     LEFT JOIN payments p ON p.id = r.payment_id
     WHERE r.booking_id = '${BOOKING_ID}'::uuid
     ORDER BY r.requested_at DESC NULLS LAST`
  );
  console.log(JSON.stringify(refunds, null, 2));

  console.log('\n=== All refunds for customer (recent 10) ===\n');
  if (customers[0]?.id) {
    const cid = customers[0].id;
    const custRefunds = await q(
      client,
      t,
      `SELECT r.id::text, r.booking_id::text, r.refund_amount::text, r.refund_status,
              r.razorpay_refund_id, r.refund_reason, r.requested_at::text, r.processed_at::text
       FROM refunds r
       WHERE r.customer_id = '${cid}'::uuid
       ORDER BY r.requested_at DESC NULLS LAST
       LIMIT 10`
    );
    console.log(JSON.stringify(custRefunds, null, 2));
  }

  console.log('\n=== Audit logs (booking / payment / refund) ===\n');
  const audit = await q(
    client,
    t,
    `SELECT id::text, action, resource_type, resource_id::text, details::text,
            performed_at::text, performed_by
     FROM audit_logs
     WHERE resource_id::text = '${BOOKING_ID}'
        OR details::text ILIKE '%${BOOKING_ID}%'
        OR details::text ILIKE '%aeef3b4c%'
     ORDER BY performed_at DESC
     LIMIT 20`
  );
  console.log(audit.length ? JSON.stringify(audit, null, 2) : '(no audit_logs rows)');

  console.log('\n=== Admin audit log ===\n');
  try {
    const adminAudit = await q(
      client,
      t,
      `SELECT id::text, action, resource_type, resource_id, metadata::text, created_at::text
       FROM admin_audit_log
       WHERE resource_id = '${BOOKING_ID}'
          OR metadata::text ILIKE '%${BOOKING_ID}%'
       ORDER BY created_at DESC
       LIMIT 15`
    );
    console.log(adminAudit.length ? JSON.stringify(adminAudit, null, 2) : '(none)');
  } catch (e) {
    console.log('(admin_audit_log skip)', e.message?.slice(0, 60));
  }

  console.log('\n=== Webhook inference ===\n');
  for (const r of refunds) {
    const lines = [];
    if (!r.razorpay_refund_id) {
      lines.push('❌ No razorpay_refund_id — Razorpay API likely never succeeded (webhook would not match payment).');
    } else {
      lines.push(`Razorpay refund id: ${r.razorpay_refund_id}`);
      if (r.refund_reason && String(r.refund_reason).includes('Razorpay webhook')) {
        lines.push('⚠️ refund_reason suggests webhook INSERT (not typical admin API path).');
      } else {
        lines.push('refund_reason looks admin/API-initiated (not webhook-only insert).');
      }
      if (r.refund_status === 'completed' && r.processed_at) {
        lines.push(`Status completed; processed_at=${r.processed_at}`);
        lines.push(
          'If requested_at << processed_at while status was processing first → likely refund.processed webhook updated row.'
        );
      } else if (r.refund_status === 'processing') {
        lines.push('⏳ Still processing — refund.processed webhook may not have arrived yet.');
      } else if (r.refund_status === 'pending' || r.refund_status === 'approved') {
        lines.push('⏳ Admin created pending refund; Razorpay call may not have run (approve step).');
      } else if (r.refund_status === 'failed' || r.refund_status === 'rejected') {
        lines.push(`Terminal status: ${r.refund_status}`);
      }
    }
    console.log('Refund', r.id, ':\n  ' + lines.join('\n  '));
  }

  if (payments.length && refunds.length) {
    const pay = payments[0];
    const sumRes = await q(
      client,
      t,
      `SELECT COALESCE(SUM(refund_amount),0)::text AS total_refunded
       FROM refunds
       WHERE payment_id = '${payments[0].id}'::uuid
         AND refund_status IN ('completed','processing','approved','processed')`
    );
    console.log('\nPayment', pay.payment_status, '| refunded sum:', sumRes[0]?.total_refunded, '/ paid', pay.amount);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
