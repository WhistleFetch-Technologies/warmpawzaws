#!/usr/bin/env node
/**
 * Purge internal-test customers on PROD by Indian mobile last-10 digits.
 * Hard-deletes customer row after clearing phone-linked auth rows so OTP signup is fresh.
 *
 * Usage:
 *   node scripts/purge-prod-customers-by-phone.js --lookup 8050107282 9749493369
 *   I_CONFIRM_PROD_CUSTOMER_PURGE=YES node scripts/purge-prod-customers-by-phone.js 8050107282 9749493369
 */
const {
  RDSDataClient,
  ExecuteStatementCommand,
} = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_ID = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DATABASE = 'warmpawz';

const args = process.argv.slice(2);
const lookupOnly = args[0] === '--lookup';
const phones = (lookupOnly ? args.slice(1) : args).map((p) => p.replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10);

if (phones.length === 0) {
  console.error('Usage: node scripts/purge-prod-customers-by-phone.js [--lookup] <last10> [<last10>...]');
  process.exit(1);
}

if (!lookupOnly && process.env.I_CONFIRM_PROD_CUSTOMER_PURGE !== 'YES') {
  console.error('Refusing to purge prod. Set I_CONFIRM_PROD_CUSTOMER_PURGE=YES');
  process.exit(1);
}

function getClusterAndSecret() {
  const cluster = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  if (!cluster?.HttpEndpointEnabled) {
    throw new Error('RDS Data API not enabled on prod cluster');
  }
  const secretArn = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${SECRET_ID} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  ).ARN;
  return { resourceArn: cluster.DBClusterArn, secretArn };
}

function cell(field) {
  if (!field || field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  return null;
}

async function execSql(client, base, sql, transactionId) {
  const input = { ...base, database: DATABASE, sql, includeResultMetadata: true };
  if (transactionId) input.transactionId = transactionId;
  const r = await client.send(new ExecuteStatementCommand(input));
  const cols = (r.columnMetadata || []).map((c) => c.name);
  const rows = (r.records || []).map((rec) =>
    Object.fromEntries(rec.map((v, i) => [cols[i], cell(v)]))
  );
  return { rows, updated: r.numberOfRecordsUpdated ?? 0 };
}

async function findCustomers(client, base, last10) {
  const sql = `
    SELECT id::text AS id, phone, full_name, email, username, is_active, created_at::text AS created_at
    FROM customers
    WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = '${last10}'
    ORDER BY created_at DESC`;
  return (await execSql(client, base, sql)).rows;
}

async function countRelated(client, base, customerId) {
  const sql = `
    SELECT
      (SELECT COUNT(*)::int FROM bookings WHERE customer_id = '${customerId}'::uuid) AS bookings,
      (SELECT COUNT(*)::int FROM orders WHERE customer_id = '${customerId}'::uuid) AS orders,
      (SELECT COUNT(*)::int FROM pets WHERE customer_id = '${customerId}'::uuid) AS pets,
      (SELECT COUNT(*)::int FROM customer_addresses WHERE customer_id = '${customerId}'::uuid) AS addresses,
      (SELECT COUNT(*)::int FROM customer_identity WHERE customer_id = '${customerId}'::uuid) AS identities`;
  return (await execSql(client, base, sql)).rows[0];
}

async function listBookingIds(client, base, customerId) {
  const sql = `SELECT id::text AS id, status FROM bookings WHERE customer_id = '${customerId}'::uuid ORDER BY created_at DESC`;
  return (await execSql(client, base, sql)).rows;
}

async function purgeCustomer(client, base, customerId, phoneHint, options) {
  const { forceWithBookings = false } = options;
  const bookings = await listBookingIds(client, base, customerId);
  if (bookings.length > 0 && !forceWithBookings) {
    throw new Error(`customer ${customerId} has ${bookings.length} booking(s); use forceWithBookings`);
  }

  const bookingIds = bookings.map((b) => b.id);
  /** @type {{ sql: string; optional: boolean }[]} */
  const steps = [];

  const optionalPreBookingDeletes = (bookingId) => [
    `DELETE FROM booking_services WHERE booking_id = '${bookingId}'::uuid`,
    `DELETE FROM booking_status_history WHERE booking_id = '${bookingId}'::uuid`,
    `DELETE FROM appointment_reminders WHERE booking_id = '${bookingId}'::uuid`,
    `UPDATE reviews SET booking_id = NULL WHERE booking_id = '${bookingId}'::uuid`,
    `DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE booking_id = '${bookingId}'::uuid)`,
    `DELETE FROM payments WHERE booking_id = '${bookingId}'::uuid`,
    `UPDATE support_tickets SET booking_id = NULL WHERE booking_id = '${bookingId}'::uuid`,
  ];

  for (const bookingId of bookingIds) {
    for (const sql of optionalPreBookingDeletes(bookingId)) {
      steps.push({ sql, optional: true });
    }
    steps.push({ sql: `DELETE FROM bookings WHERE id = '${bookingId}'::uuid`, optional: false });
  }

  const tailSteps = [
    `DELETE FROM otp_tokens WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = '${phoneHint}'`,
    `DELETE FROM customer_addresses WHERE customer_id = '${customerId}'::uuid`,
    `DELETE FROM pets WHERE customer_id = '${customerId}'::uuid`,
    `DELETE FROM loyalty_transactions WHERE customer_id = '${customerId}'::uuid`,
    `DELETE FROM referral_redemptions WHERE referred_id = '${customerId}'::uuid OR referral_id IN (SELECT id FROM referrals WHERE referrer_id = '${customerId}'::uuid)`,
    `DELETE FROM referrals WHERE referrer_id = '${customerId}'::uuid OR referred_id = '${customerId}'::uuid`,
    `DELETE FROM wallet_transactions WHERE wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = '${customerId}'::uuid)`,
    `DELETE FROM customer_wallets WHERE customer_id = '${customerId}'::uuid`,
    `UPDATE customers SET customer_identity_id = NULL WHERE id = '${customerId}'::uuid`,
    `DELETE FROM customer_identity WHERE customer_id = '${customerId}'::uuid OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = '${phoneHint}'`,
    `DELETE FROM customers WHERE id = '${customerId}'::uuid`,
  ];
  for (const sql of tailSteps) steps.push({ sql, optional: false });

  for (const step of steps) {
    try {
      const r = await execSql(client, base, step.sql);
      console.log(`   ${step.sql.trim().slice(0, 72)}... → ${r.updated} row(s)`);
    } catch (err) {
      if (step.optional && /does not exist|42P01/i.test(String(err.message || err))) {
        console.log(`   (skip optional) ${step.sql.trim().slice(0, 50)}...`);
        continue;
      }
      throw err;
    }
  }

  return true;
}

async function main() {
  const base = getClusterAndSecret();
  const client = new RDSDataClient({ region: REGION });

  console.log('=== Prod customer purge ===');
  console.log('Phones:', phones.join(', '));
  console.log('Mode:', lookupOnly ? 'LOOKUP' : 'PURGE');
  console.log('');

  for (const last10 of phones) {
    console.log(`--- ${last10} ---`);
    const customers = await findCustomers(client, base, last10);
    if (customers.length === 0) {
      console.log('No customer found.');
      console.log('');
      continue;
    }
    for (const c of customers) {
      console.log(JSON.stringify(c, null, 2));
      const counts = await countRelated(client, base, c.id);
      console.log('Related:', counts);
      if (!lookupOnly) {
        if (Number(counts.orders) > 0) {
          console.error(`ABORT: customer ${c.id} has orders. Manual review needed.`);
          process.exit(1);
        }
        console.log('Purging (including test bookings)...');
        await purgeCustomer(client, base, c.id, last10, { forceWithBookings: true });
        const after = await findCustomers(client, base, last10);
        console.log(after.length === 0 ? 'Verified: removed.' : 'WARNING: row still found after purge.');
      }
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
