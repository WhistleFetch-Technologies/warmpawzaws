#!/usr/bin/env node
/**
 * Prod: device_tokens + recent campaign push delivery status (RDS Data API).
 *
 * Usage:
 *   node scripts/check-push-tokens-prod-rds-data.js --customerId=<uuid>
 *   node scripts/check-push-tokens-prod-rds-data.js --phone=8296974568
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER = 'warmpawz-prod-cluster';
const SECRET_FALLBACK = 'warmpawz-prod-rds-master-20260207201049162400000001';

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : '';
}

function getCluster() {
  const cluster = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  let secretArn = cluster.MasterUserSecret?.SecretArn;
  if (!secretArn) {
    secretArn = JSON.parse(
      execSync(
        `aws secretsmanager describe-secret --secret-id "${SECRET_FALLBACK}" --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    ).ARN;
  }
  return { clusterArn: cluster.DBClusterArn, secretArn, dbName: cluster.DatabaseName || 'warmpawz' };
}

function query(clusterArn, secretArn, dbName, sql) {
  const tmp = path.join(__dirname, `_tmp_push_check_${Date.now()}.json`);
  fs.writeFileSync(
    tmp,
    JSON.stringify({
      resourceArn: clusterArn,
      secretArn,
      database: dbName,
      sql,
      formatRecordsAs: 'JSON',
    }),
    'utf8'
  );
  const url = 'file://' + tmp.replace(/\\/g, '/');
  try {
    const out = execSync(
      `aws rds-data execute-statement --cli-input-json "${url}" --region ${REGION} --output json`,
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
    );
    const parsed = JSON.parse(out);
    let records = parsed.formattedRecords;
    if (typeof records === 'string') records = JSON.parse(records);
    if (!Array.isArray(records)) return [];
    return records.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  const phone = arg('phone');
  let customerId = arg('customerId');
  const { clusterArn, secretArn, dbName } = getCluster();

  if (!customerId && phone) {
    const digits = phone.replace(/\D/g, '');
    const rows = query(
      clusterArn,
      secretArn,
      dbName,
      `SELECT id::text AS id, phone FROM customers WHERE phone LIKE '%${esc(digits.slice(-10))}' LIMIT 3`
    );
    console.log('Customers matching phone:', rows);
    customerId = rows[0]?.id;
  }

  if (!customerId) {
    console.error('Need --customerId or --phone');
    process.exit(1);
  }

  const tokens = query(
    clusterArn,
    secretArn,
    dbName,
    `SELECT device_id, platform, is_active::text AS is_active,
            left(fcm_token, 20) AS token_prefix, updated_at::text AS updated_at
     FROM device_tokens
     WHERE user_id = '${esc(customerId)}'::uuid AND user_type = 'customer'
     ORDER BY updated_at DESC LIMIT 10`
  );

  console.log('\n=== device_tokens (PROD) ===');
  console.log('count:', tokens.length);
  tokens.forEach((r) => console.log(r));

  const active = tokens.filter((r) => r.is_active === 'true');
  const totalActive = query(
    clusterArn,
    secretArn,
    dbName,
    `SELECT count(*)::text AS c FROM device_tokens WHERE user_type='customer' AND is_active=true`
  );
  console.log('\nAll active customer device_tokens on PROD:', totalActive[0]?.c ?? '?');

  const recentTokens = query(
    clusterArn,
    secretArn,
    dbName,
    `SELECT left(user_id::text, 8) AS user_prefix, device_id, platform, updated_at::text
     FROM device_tokens WHERE user_type='customer' AND is_active=true
     ORDER BY updated_at DESC LIMIT 10`
  );
  if (recentTokens.length) {
    console.log('\nRecent active tokens (any user):');
    recentTokens.forEach((r) => console.log(' ', r));
  }

  if (active.length === 0) {
    console.log('\n⚠️  NO active prod FCM tokens for this user → tray push impossible (in-app still works).');
    console.log('   Phones must POST https://mss9sa4y01.../push/register-device after prod app open.');
    console.log('   Force-close APK → reopen → Settings → Enable push; check console for register-device ok.');
  } else {
    console.log('\n✅ User has active prod token(s) — tray should work for new PUSH campaigns.');
  }

  const deliveries = query(
    clusterArn,
    secretArn,
    dbName,
    `SELECT dl.channel, dl.status, dl.error_message, dl.updated_at::text AS updated_at
     FROM notification_delivery_log dl
     JOIN notifications n ON n.id = dl.notification_id
     WHERE n.recipient_id = '${esc(customerId)}'::uuid
       AND n.notification_type = 'campaign'
     ORDER BY dl.updated_at DESC
     LIMIT 8`
  );

  console.log('\n=== recent campaign delivery_log (PROD) ===');
  deliveries.forEach((r) => console.log(r));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
