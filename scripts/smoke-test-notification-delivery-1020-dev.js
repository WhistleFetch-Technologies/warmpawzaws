#!/usr/bin/env node
/**
 * Smoke test migration 1020 notification delivery on DEV.
 * - Creates notification via API
 * - Verifies delivery_status = 'created' in RDS
 * - Marks read via API → delivery_status = 'opened', is_read = true
 * - Optionally checks notification_delivery_log after SQS processor path
 *
 * Usage: node scripts/smoke-test-notification-delivery-1020-dev.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_ARN = process.env.DEV_CLUSTER_ARN || '';
const SECRET_ARN = process.env.DEV_SECRET_ARN || '';

let clusterArn = CLUSTER_ARN;
let secretArn = SECRET_ARN;

function resolveCluster() {
  if (clusterArn && secretArn) return;
  const clusterJson = JSON.parse(
    execSync(
      'aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --output json',
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterJson.DBClusters[0];
  clusterArn = cluster.DBClusterArn;
  secretArn = cluster.MasterUserSecret?.SecretArn;
  if (!secretArn) {
    const secretName = 'warmpawz-dev-rds-master-20260106164510791100000002';
    const sec = JSON.parse(
      execSync(
        `aws secretsmanager describe-secret --secret-id "${secretName}" --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    );
    secretArn = sec.ARN;
  }
}

function rdsQuery(sql) {
  resolveCluster();
  const inputFile = path.join(__dirname, `_tmp_smoke_${Date.now()}.json`);
  fs.writeFileSync(
    inputFile,
    JSON.stringify({
      resourceArn: clusterArn,
      secretArn,
      database: 'warmpawz',
      sql,
    })
  );
  const fileUrl = 'file://' + inputFile.replace(/\\/g, '/');
  try {
    const out = execSync(
      `aws rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --include-result-metadata --output json`,
      {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const parsed = JSON.parse(out);
    const cols = (parsed.columnMetadata || []).map((c) => c.name);
    return (parsed.records || []).map((rec) => {
      const row = {};
      rec.forEach((field, i) => {
        const key = cols[i] || `col${i}`;
        if (field.isNull) row[key] = null;
        else if (field.stringValue !== undefined) row[key] = field.stringValue;
        else if (field.booleanValue !== undefined) row[key] = field.booleanValue;
        else if (field.longValue !== undefined) row[key] = field.longValue;
        else row[key] = null;
      });
      return row;
    });
  } finally {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
  }
}

function rdsExec(sql) {
  rdsQuery(sql);
}

async function httpJson(method, path, body) {
  const url = `${API_BASE.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('=== Smoke test: notification delivery (DEV) ===\n');
  console.log('API:', API_BASE);

  const customers = rdsQuery(
    `SELECT id::text AS id, phone FROM customers WHERE phone IS NOT NULL ORDER BY created_at DESC NULLS LAST LIMIT 1`
  );
  assert(customers.length > 0, 'No customer found in dev DB');
  const customerId = customers[0].id;
  console.log('Customer:', customerId, customers[0].phone || '');

  const createBody = {
    userId: customerId,
    userType: 'customer',
    notificationType: 'smoke_test_1020',
    title: 'Smoke test 1020',
    message: `Delivery state smoke test ${new Date().toISOString()}`,
  };

  console.log('\n1) POST /notifications');
  const created = await httpJson('POST', '/notifications', createBody);
  console.log('   HTTP', created.status, JSON.stringify(created.json).slice(0, 200));
  assert(created.status >= 200 && created.status < 300, `Create failed: ${created.status}`);

  const notificationId =
    created.json?.notification?.id ||
    created.json?.notificationId ||
    created.json?.id;
  assert(notificationId, 'No notification id in create response');

  console.log('\n2) Verify delivery_status = created');
  const rows1 = rdsQuery(
    `SELECT id::text AS id, delivery_status::text AS delivery_status, is_read
     FROM notifications WHERE id = '${notificationId}'::uuid`
  );
  assert(rows1.length === 1, 'Notification row missing');
  console.log('   ', rows1[0]);
  assert(rows1[0].delivery_status === 'created', `Expected created, got ${rows1[0].delivery_status}`);
  assert(rows1[0].is_read === false || rows1[0].is_read === 'false', 'Expected is_read false');

  console.log('\n3) PUT /notifications/:id/read');
  const read = await httpJson('PUT', `/notifications/${notificationId}/read`);
  console.log('   HTTP', read.status);
  assert(read.status >= 200 && read.status < 300, `Mark read failed: ${read.status}`);

  console.log('\n4) Verify delivery_status = opened, is_read = true');
  const rows2 = rdsQuery(
    `SELECT id::text AS id, delivery_status::text AS delivery_status, is_read, opened_at IS NOT NULL AS has_opened_at
     FROM notifications WHERE id = '${notificationId}'::uuid`
  );
  console.log('   ', rows2[0]);
  assert(rows2[0].delivery_status === 'opened', `Expected opened, got ${rows2[0].delivery_status}`);
  const isRead = rows2[0].is_read === true || rows2[0].is_read === 'true';
  assert(isRead, 'Expected is_read true');

  const logRows = rdsQuery(
    `SELECT channel, status::text AS status FROM notification_delivery_log
     WHERE notification_id = '${notificationId}'::uuid ORDER BY channel`
  );
  if (logRows.length > 0) {
    console.log('\n5) notification_delivery_log (API-created may have no rows):');
    logRows.forEach((r) => console.log('   ', r));
  } else {
    console.log('\n5) No notification_delivery_log rows (expected for POST /notifications only)');
  }

  // Cleanup test row
  rdsExec(`DELETE FROM notification_delivery_log WHERE notification_id = '${notificationId}'::uuid`);
  rdsExec(`DELETE FROM notifications WHERE id = '${notificationId}'::uuid`);

  console.log('\n✅ Smoke test passed (API insert + mark-read path)\n');
}

main().catch((e) => {
  console.error('\n❌ Smoke test failed:', e.message);
  process.exit(1);
});
