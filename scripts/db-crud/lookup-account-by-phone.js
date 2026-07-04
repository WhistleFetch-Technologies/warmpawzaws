#!/usr/bin/env node
/**
 * Lookup customer + vendor accounts by phone on dev or prod RDS.
 * Usage: ENVIRONMENT=dev node scripts/db-crud/lookup-account-by-phone.js 9606901515
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const PHONE = process.argv[2] || '9606901515';
const LAST10 = PHONE.replace(/\D/g, '').slice(-10);
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function getPool() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  let secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : 'warmpawz-dev-rds-master-20260106164510791100000002';

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;

  return new Pool({
    host: endpoint,
    port: cluster.Port || 5432,
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
  });
}

async function main() {
  const pool = await getPool();
  const client = await pool.connect();
  const phonePattern = `%${LAST10}%`;

  console.log(`\n=== ${ENVIRONMENT.toUpperCase()} RDS — phone ${LAST10} ===\n`);

  const queries = [
    {
      label: 'customers',
      sql: `SELECT id, phone, email, full_name, username, onboarding_status, status, created_at
            FROM customers
            WHERE phone LIKE $1 OR RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = $2`,
    },
    {
      label: 'customer_identity',
      sql: `SELECT id, phone, email, onboarding_status, customer_id, created_at
            FROM customer_identity
            WHERE phone LIKE $1 OR RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = $2`,
    },
    {
      label: 'vendors',
      sql: `SELECT id, phone, email, business_name, owner_name, status, is_deleted, created_at
            FROM vendors
            WHERE phone LIKE $1 OR RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = $2`,
    },
    {
      label: 'vendor_identity',
      sql: `SELECT id, phone, email, business_name, onboarding_status, vendor_id, is_deleted, created_at
            FROM vendor_identity
            WHERE phone LIKE $1 OR RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = $2`,
    },
    {
      label: 'vendor_onboarding_applications',
      sql: `SELECT voa.id, voa.vendor_identity_id, voa.status, vi.phone
            FROM vendor_onboarding_applications voa
            JOIN vendor_identity vi ON vi.id = voa.vendor_identity_id
            WHERE vi.phone LIKE $1 OR RIGHT(REGEXP_REPLACE(COALESCE(vi.phone,''), '[^0-9]', '', 'g'), 10) = $2`,
    },
    {
      label: 'otp_tokens',
      sql: `SELECT id, phone, purpose, created_at, expires_at
            FROM otp_tokens
            WHERE phone LIKE $1 OR RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = $2
            ORDER BY created_at DESC LIMIT 5`,
    },
    {
      label: 'pets (via customer)',
      sql: `SELECT p.id, p.name, p.customer_id, c.phone
            FROM pets p
            JOIN customers c ON c.id = p.customer_id
            WHERE c.phone LIKE $1 OR RIGHT(REGEXP_REPLACE(COALESCE(c.phone,''), '[^0-9]', '', 'g'), 10) = $2`,
    },
  ];

  for (const q of queries) {
    try {
      const { rows } = await client.query(q.sql, [phonePattern, LAST10]);
      console.log(`--- ${q.label} (${rows.length}) ---`);
      if (rows.length === 0) console.log('  (none)');
      else console.log(JSON.stringify(rows, null, 2));
      console.log('');
    } catch (err) {
      console.log(`--- ${q.label} — ERROR: ${err.message} ---\n`);
    }
  }

  client.release();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
