#!/usr/bin/env node
/**
 * EXPLAIN ANALYZE storefront product list + COUNT queries (RDS read-only).
 * Mirrors GET /ecommerce/products?sort=popular&limit=10 for perf validation.
 *
 * Usage:
 *   node scripts/explain-storefront-products-list.js
 *   ENVIRONMENT=prod node scripts/explain-storefront-products-list.js
 */

const { execSync } = require('child_process');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

/** Legacy status filter (pre–Phase 1 sargable helper). */
const LEGACY_STATUS_WHERE = `
  p.is_active = true
  AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
`;

/** Sargable status filter (matches storefront-product-where.ts). */
const SARGABLE_STATUS_WHERE = `
  p.is_active = true
  AND LOWER(TRIM(COALESCE(p.status::text, 'pending'))) = 'active'
`;

const MEAL_EXCLUDE = `
  AND LOWER(COALESCE(NULLIF(TRIM(p.category::text), ''), '')) NOT IN ('meal_plan', 'nutrition')
  AND NOT EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = p.id)
`;

const ACTIVE_CATEGORY_SQL = `
  AND (
    p.category_id IS NULL
    OR EXISTS (
      SELECT 1 FROM ecommerce_categories ec
      WHERE ec.id = p.category_id AND ec.is_active = true
    )
  )
`;

function storefrontWhere(statusClause) {
  return `${statusClause}${MEAL_EXCLUDE}${ACTIVE_CATEGORY_SQL}`;
}

const COUNT_SQL = (statusClause) => `
  SELECT COUNT(*)::int AS count
  FROM products p
  LEFT JOIN vendors v ON p.vendor_id = v.id
  WHERE ${storefrontWhere(statusClause)}
`;

const LIST_SQL = (statusClause) => `
  SELECT p.id, p.name, p.review_count, p.created_at
  FROM products p
  LEFT JOIN vendors v ON p.vendor_id = v.id
  WHERE ${storefrontWhere(statusClause)}
  ORDER BY p.review_count DESC NULLS LAST, p.created_at DESC
  LIMIT 10 OFFSET 0
`;

async function getRdsConnection() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );

  if (!clusterInfo.DBClusters?.length) {
    throw new Error(`RDS cluster not found: ${clusterId}`);
  }

  const cluster = clusterInfo.DBClusters[0];
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }

  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : 'warmpawz-dev-rds-master-20260106164510791100000002';

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;

  return new Client({
    host: endpoint,
    port: cluster.Port || 5432,
    database: cluster.DatabaseName || 'warmpawz',
    user: cluster.MasterUsername || 'warmpawz_admin',
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
}

async function runExplain(client, label, sql) {
  console.log(`\n========== ${label} ==========`);
  const { rows } = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`);
  for (const row of rows) {
    console.log(row['QUERY PLAN']);
  }
}

async function main() {
  console.log(`Storefront products EXPLAIN (${ENVIRONMENT} RDS)\n`);

  const client = await getRdsConnection();
  await client.connect();

  try {
    const legacyCount = await client.query(COUNT_SQL(LEGACY_STATUS_WHERE));
    const sargableCount = await client.query(COUNT_SQL(SARGABLE_STATUS_WHERE));
    const legacyN = legacyCount.rows[0]?.count ?? 0;
    const sargableN = sargableCount.rows[0]?.count ?? 0;

    console.log('--- Parity: legacy vs sargable status filter ---');
    console.log(`  Legacy count:    ${legacyN}`);
    console.log(`  Sargable count:  ${sargableN}`);
    console.log(`  Match:           ${legacyN === sargableN ? 'YES' : 'NO — investigate before Phase 1'}`);

    if (legacyN !== sargableN) {
      const diff = await client.query(`
        SELECT COUNT(*)::int AS only_legacy FROM products p
        WHERE ${storefrontWhere(LEGACY_STATUS_WHERE)}
          AND NOT (${SARGABLE_STATUS_WHERE.trim()})
      `);
      const diff2 = await client.query(`
        SELECT COUNT(*)::int AS only_sargable FROM products p
        WHERE ${storefrontWhere(SARGABLE_STATUS_WHERE)}
          AND NOT (${LEGACY_STATUS_WHERE.trim()})
      `);
      console.log(`  Only in legacy:   ${diff.rows[0]?.only_legacy ?? 0}`);
      console.log(`  Only in sargable: ${diff2.rows[0]?.only_sargable ?? 0}`);
    }

    await runExplain(client, 'COUNT (legacy status filter)', COUNT_SQL(LEGACY_STATUS_WHERE));
    await runExplain(client, 'LIST popular LIMIT 10 (legacy)', LIST_SQL(LEGACY_STATUS_WHERE));
    await runExplain(client, 'COUNT (sargable status filter)', COUNT_SQL(SARGABLE_STATUS_WHERE));
    await runExplain(client, 'LIST popular LIMIT 10 (sargable)', LIST_SQL(SARGABLE_STATUS_WHERE));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
