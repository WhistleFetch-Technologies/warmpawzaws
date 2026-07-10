#!/usr/bin/env node
/**
 * List ecommerce categories with storefront-active product counts (RDS read-only).
 * Mirrors GET /ecommerce/categories product_count rules for validation.
 *
 * Usage:
 *   node scripts/list-ecommerce-categories-product-counts.js
 *   ENVIRONMENT=prod node scripts/list-ecommerce-categories-product-counts.js
 */

const { execSync } = require('child_process');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

const CATEGORY_QUERY = `
  SELECT
    ec.id::text AS id,
    ec.name,
    ec.display_order,
    ec.is_active,
    COALESCE(pc.product_count, 0) AS storefront_product_count
  FROM ecommerce_categories ec
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS product_count
    FROM products p
    WHERE p.category_id = ec.id
      AND p.is_active = true
      AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
  ) pc ON true
  ORDER BY ec.display_order ASC, ec.name ASC
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

async function main() {
  console.log(`Ecommerce category product counts (${ENVIRONMENT} RDS)\n`);

  const client = await getRdsConnection();
  await client.connect();

  try {
    const { rows } = await client.query(CATEGORY_QUERY);
    const withProducts = rows.filter((r) => Number(r.storefront_product_count) > 0);
    const empty = rows.filter((r) => Number(r.storefront_product_count) === 0);

    console.log(`Total categories: ${rows.length}`);
    console.log(`With storefront products: ${withProducts.length}`);
    console.log(`Zero storefront products: ${empty.length}\n`);

    console.log('--- Categories WITH products (shown on home/shop) ---');
    for (const row of withProducts) {
      console.log(
        `  ${row.name.padEnd(28)} | count=${String(row.storefront_product_count).padStart(3)} | id=${row.id}`
      );
    }

    console.log('\n--- Categories with ZERO storefront products (hidden when with_products_only=true) ---');
    for (const row of empty) {
      const active = row.is_active ? 'active' : 'inactive';
      console.log(`  ${row.name.padEnd(28)} | ${active.padEnd(8)} | id=${row.id}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
