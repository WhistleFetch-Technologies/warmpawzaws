#!/usr/bin/env node
/**
 * List active FCM device_tokens for a customer (dev RDS).
 *
 * Usage:
 *   node scripts/check-customer-push-tokens-dev.js --phone=919876543210
 *   node scripts/check-customer-push-tokens-dev.js --customerId=<uuid>
 */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const SECRET_ARN =
  process.env.DB_SECRET_ARN ||
  'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
const DB_HOST =
  process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_NAME = process.env.DB_NAME || 'warmpawz';

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : '';
}

const phone = arg('phone');
const customerId = arg('customerId');

if (!phone && !customerId) {
  console.error('Usage: --phone=<e164> OR --customerId=<uuid>');
  process.exit(1);
}

async function main() {
  const sm = new SecretsManagerClient({ region: REGION });
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  const creds = JSON.parse(secret.SecretString);

  const client = new Client({
    host: DB_HOST,
    port: 5432,
    database: DB_NAME,
    user: creds.username || creds.user,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let id = customerId;
  if (!id && phone) {
    const c = await client.query(
      `SELECT id, phone, full_name FROM customers WHERE phone = $1 OR phone = $2 LIMIT 1`,
      [phone, phone.replace(/^\+/, '')]
    );
    if (!c.rows[0]) {
      console.log('No customer found for phone:', phone);
      await client.end();
      process.exit(1);
    }
    id = c.rows[0].id;
    console.log('Customer:', c.rows[0].full_name || '(no name)', id, c.rows[0].phone);
  }

  const tokens = await client.query(
    `SELECT device_id, platform, is_active, left(fcm_token, 24) AS token_prefix,
            updated_at, created_at
     FROM device_tokens
     WHERE user_id = $1 AND user_type = 'customer'
     ORDER BY updated_at DESC`,
    [id]
  );

  console.log('\nDevice tokens (dev):', tokens.rows.length);
  for (const row of tokens.rows) {
    console.log(
      `  - device=${row.device_id} platform=${row.platform} active=${row.is_active} token=${row.token_prefix}… updated=${row.updated_at}`
    );
  }

  if (tokens.rows.filter((r) => r.is_active).length === 0) {
    console.log(
      '\n⚠️  No active FCM token on DEV — native tray push from dev campaigns will not reach this phone.'
    );
    console.log('   In-app inbox still works. Fix: Settings → Enable push on this device (permission granted).');
  } else {
    console.log('\n✅ At least one active token — dev PUSH campaigns can target this customer.');
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
