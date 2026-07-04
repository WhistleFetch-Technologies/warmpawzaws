#!/usr/bin/env node
/**
 * Lookup / delete customer + vendor accounts by phone via RDS Data API.
 *
 * Lookup:
 *   node scripts/db-crud/delete-account-by-phone.js 9606901515 --env dev --lookup
 *
 * Delete (requires --confirm):
 *   node scripts/db-crud/delete-account-by-phone.js 9606901515 --env dev --confirm
 *   node scripts/db-crud/delete-account-by-phone.js 9606901515 --env prod --confirm
 */

const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const args = process.argv.slice(2);
const PHONE = args.find((a) => !a.startsWith('--')) || '9606901515';
const LAST10 = PHONE.replace(/\D/g, '').slice(-10);
const envIdx = args.indexOf('--env');
const ENVIRONMENT = envIdx >= 0 ? args[envIdx + 1] : 'dev';
const LOOKUP_ONLY = args.includes('--lookup') || !args.includes('--confirm');
const CONFIRM = args.includes('--confirm');

const SECRETS = {
  dev: 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI',
  prod: 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001',
};

function getRdsArn() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const info = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  return info.DBClusters[0].DBClusterArn;
}

const rds = new RDSDataClient({ region: REGION });
let rdsArn;
let secretArn;

async function sql(query, params = []) {
  const cmd = new ExecuteStatementCommand({
    resourceArn: rdsArn,
    secretArn,
    database: 'warmpawz',
    sql: query,
    parameters: params.map((v) => ({ stringValue: String(v) })),
    includeResultMetadata: true,
  });
  const res = await rds.send(cmd);
  const cols = (res.columnMetadata || []).map((c) => c.name);
  const rows = (res.records || []).map((rec) => {
    const obj = {};
    rec.forEach((field, i) => {
      const key = cols[i] || `col${i}`;
      obj[key] =
        field.stringValue ??
        field.longValue ??
        field.doubleValue ??
        field.booleanValue ??
        (field.isNull ? null : JSON.stringify(field));
    });
    return obj;
  });
  return { rows, updated: res.numberOfRecordsUpdated ?? 0 };
}

async function lookup() {
  console.log(`\n=== ${ENVIRONMENT.toUpperCase()} — phone ${LAST10} ===\n`);

  const queries = [
    ['customers', `SELECT id, phone, email, full_name, username, onboarding_status, status, created_at FROM customers WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`],
    ['customer_identity', `SELECT id, phone, email, onboarding_status, customer_id, created_at FROM customer_identity WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`],
    ['vendors', `SELECT id, phone, email, business_name, owner_name, status, is_deleted, created_at FROM vendors WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`],
    ['vendor_identity', `SELECT id, phone, email, business_name, onboarding_status, vendor_id, is_deleted, created_at FROM vendor_identity WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`],
    ['vendor_onboarding_applications', `SELECT voa.id, voa.vendor_identity_id, voa.status FROM vendor_onboarding_applications voa JOIN vendor_identity vi ON vi.id = voa.vendor_identity_id WHERE RIGHT(REGEXP_REPLACE(COALESCE(vi.phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`],
    ['otp_tokens (recent)', `SELECT id, phone, purpose, created_at FROM otp_tokens WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}' ORDER BY created_at DESC LIMIT 5`],
    ['pets', `SELECT p.id, p.name, p.customer_id FROM pets p JOIN customers c ON c.id = p.customer_id WHERE RIGHT(REGEXP_REPLACE(COALESCE(c.phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`],
  ];

  for (const [label, q] of queries) {
    try {
      const { rows } = await sql(q);
      console.log(`--- ${label} (${rows.length}) ---`);
      console.log(rows.length ? JSON.stringify(rows, null, 2) : '  (none)');
      console.log('');
    } catch (e) {
      console.log(`--- ${label} — skip: ${e.message} ---\n`);
    }
  }
}

async function execStep(name, query, optional = true) {
  try {
    const { updated } = await sql(query);
    console.log(`  OK ${name}: ${updated} affected`);
    return updated;
  } catch (e) {
    if (optional) {
      console.log(`  SKIP ${name}: ${e.message}`);
      return 0;
    }
    throw new Error(`${name}: ${e.message}`);
  }
}

async function deleteAccount() {
  const { rows: vendors } = await sql(
    `SELECT id FROM vendors WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`
  );
  const { rows: customers } = await sql(
    `SELECT id FROM customers WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`
  );
  const { rows: viRows } = await sql(
    `SELECT id FROM vendor_identity WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`
  );
  const { rows: ciRows } = await sql(
    `SELECT id FROM customer_identity WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`
  );

  console.log(`\n=== DELETING on ${ENVIRONMENT.toUpperCase()} ===`);
  console.log(`  vendors: ${vendors.map((v) => v.id).join(', ') || 'none'}`);
  console.log(`  customers: ${customers.map((c) => c.id).join(', ') || 'none'}`);
  console.log(`  vendor_identity: ${viRows.map((v) => v.id).join(', ') || 'none'}`);
  console.log(`  customer_identity: ${ciRows.map((c) => c.id).join(', ') || 'none'}`);
  console.log('');

  // Vendor identity + onboarding first (FK vendor_identity.vendor_id -> vendors)
  for (const vi of viRows) {
    const viid = vi.id;
    console.log(`\nVendor identity ${viid}:`);
    await execStep('vendor_onboarding_transitions', `DELETE FROM vendor_onboarding_transitions WHERE application_id IN (SELECT id FROM vendor_onboarding_applications WHERE vendor_identity_id = '${viid}')`);
    await execStep('vendor_onboarding_comments', `DELETE FROM vendor_onboarding_comments WHERE application_id IN (SELECT id FROM vendor_onboarding_applications WHERE vendor_identity_id = '${viid}')`);
    await execStep('vendor_onboarding_applications', `DELETE FROM vendor_onboarding_applications WHERE vendor_identity_id = '${viid}'`);
    await execStep('vendor_identity unlink', `UPDATE vendor_identity SET vendor_id = NULL WHERE id = '${viid}'`);
  }

  for (const v of vendors) {
    const vid = v.id;
    console.log(`\nVendor ${vid}:`);
    await execStep('payments', `DELETE FROM payments WHERE vendor_id = '${vid}' OR booking_id IN (SELECT id FROM bookings WHERE vendor_id = '${vid}' OR service_id IN (SELECT id FROM services WHERE vendor_id = '${vid}'))`);
    await execStep('pharmacy_orders', `DELETE FROM pharmacy_orders WHERE prescription_id IN (SELECT id FROM prescriptions WHERE vendor_id = '${vid}')`);
    await execStep('prescriptions', `DELETE FROM prescriptions WHERE vendor_id = '${vid}'`);
    await execStep('bookings', `DELETE FROM bookings WHERE vendor_id = '${vid}' OR service_id IN (SELECT id FROM services WHERE vendor_id = '${vid}')`, false);
    await execStep('vendor_bank_details', `DELETE FROM vendor_bank_details WHERE vendor_id = '${vid}'`);
    await execStep('vendor_bank_accounts', `DELETE FROM vendor_bank_accounts WHERE vendor_id = '${vid}'`);
    await execStep('vendor_documents', `DELETE FROM vendor_documents WHERE vendor_id = '${vid}'`);
    await execStep('vendor_availability_v2', `DELETE FROM vendor_availability_v2 WHERE vendor_id = '${vid}'`);
    await execStep('vendor_services', `DELETE FROM vendor_services WHERE vendor_id = '${vid}'`);
    await execStep('vendor_specializations', `DELETE FROM vendor_specializations WHERE vendor_id = '${vid}'`);
    await execStep('vendor_service_areas', `DELETE FROM vendor_service_areas WHERE vendor_id = '${vid}'`);
    await execStep('featured_vendors', `DELETE FROM featured_vendors WHERE vendor_id = '${vid}'`);
    await execStep('staff', `DELETE FROM staff WHERE vendor_id = '${vid}'`);
    await execStep('services', `DELETE FROM services WHERE vendor_id = '${vid}'`, false);
    await execStep('reviews', `DELETE FROM reviews WHERE vendor_id = '${vid}'`);
    await execStep('package_purchases', `DELETE FROM package_purchases WHERE vendor_id = '${vid}'`);
    await execStep('products', `DELETE FROM products WHERE vendor_id = '${vid}'`);
    await execStep('vendor_promotions', `DELETE FROM vendor_promotions WHERE vendor_id = '${vid}'`);
    await execStep('vendor_capabilities', `DELETE FROM vendor_capabilities WHERE vendor_id = '${vid}'`);
    await execStep('payouts', `DELETE FROM payouts WHERE vendor_id = '${vid}'`);
    await execStep('settlements', `DELETE FROM settlements WHERE vendor_id = '${vid}'`);
    await execStep('payments (vendor direct)', `DELETE FROM payments WHERE vendor_id = '${vid}'`);
    await execStep('vendor', `DELETE FROM vendors WHERE id = '${vid}'`, false);
  }

  for (const vi of viRows) {
    const viid = vi.id;
    console.log(`\nVendor identity delete ${viid}:`);
    await execStep('vendor_identity', `DELETE FROM vendor_identity WHERE id = '${viid}'`, false);
  }

  for (const c of customers) {
    const cid = c.id;
    console.log(`\nCustomer ${cid}:`);
    await execStep('unlink customer_identity_id', `UPDATE customers SET customer_identity_id = NULL WHERE id = '${cid}'`);
    await execStep('payments (customer bookings)', `DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = '${cid}')`);
    await execStep('pharmacy_orders (customer)', `DELETE FROM pharmacy_orders WHERE prescription_id IN (SELECT id FROM prescriptions WHERE customer_id = '${cid}')`);
    await execStep('prescriptions (customer)', `DELETE FROM prescriptions WHERE customer_id = '${cid}'`);
    await execStep('bookings (customer)', `DELETE FROM bookings WHERE customer_id = '${cid}'`);
    await execStep('order_items', `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id = '${cid}')`);
    await execStep('orders', `DELETE FROM orders WHERE customer_id = '${cid}'`);
    await execStep('cart_items', `DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM shopping_carts WHERE customer_id = '${cid}')`);
    await execStep('shopping_carts', `DELETE FROM shopping_carts WHERE customer_id = '${cid}'`);
    await execStep('customer_addresses', `DELETE FROM customer_addresses WHERE customer_id = '${cid}'`);
    await execStep('wallet_transactions', `DELETE FROM wallet_transactions WHERE wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = '${cid}')`);
    await execStep('customer_wallets', `DELETE FROM customer_wallets WHERE customer_id = '${cid}'`);
    await execStep('customer_loyalty_points', `DELETE FROM customer_loyalty_points WHERE customer_id = '${cid}'`);
    await execStep('loyalty_transactions', `DELETE FROM loyalty_transactions WHERE customer_id = '${cid}'`);
    await execStep('customer_preferences', `DELETE FROM customer_preferences WHERE customer_id = '${cid}'`);
    await execStep('pets', `DELETE FROM pets WHERE customer_id = '${cid}'`);
    await execStep('customer', `DELETE FROM customers WHERE id = '${cid}'`, false);
  }

  for (const ci of ciRows) {
    const ciid = ci.id;
    console.log(`\nCustomer identity ${ciid}:`);
    await execStep('customer_identity', `DELETE FROM customer_identity WHERE id = '${ciid}'`, false);
  }

  await execStep('otp_tokens', `DELETE FROM otp_tokens WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${LAST10}'`);

  console.log('\n--- Verification ---');
  await lookup();
}

async function main() {
  rdsArn = getRdsArn();
  secretArn = SECRETS[ENVIRONMENT];
  if (!secretArn) throw new Error(`Unknown env: ${ENVIRONMENT}`);

  await lookup();

  if (LOOKUP_ONLY && !CONFIRM) {
    console.log('Lookup only. Re-run with --confirm to delete.');
    return;
  }

  if (!CONFIRM) {
    console.log('Pass --confirm to execute deletion.');
    return;
  }

  await deleteAccount();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
