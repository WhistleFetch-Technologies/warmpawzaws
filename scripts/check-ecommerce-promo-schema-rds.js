#!/usr/bin/env node
/**
 * Read-only inventory: which ecommerce promo / discount-engine tables+columns exist.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/check-ecommerce-promo-schema-rds.js
 *   ENVIRONMENT=prod node scripts/check-ecommerce-promo-schema-rds.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

const TABLES = [
  'vendor_promotions',
  'ecommerce_admin_promotions',
  'commercial_discount_campaigns',
  'commercial_campaign_promotion_links',
  'commercial_campaign_audit_log',
  'ecommerce_order_settlements',
  'ecommerce_settlement_batches',
  'discount_policy_draft',
  'discount_policy_versions',
  'discount_policy_audit',
  'vendor_commission_config',
  'order_item_commission',
];

const COLUMNS = [
  ['orders', 'promotion_source'],
  ['orders', 'vendor_promotion_amount'],
  ['orders', 'admin_promotion_amount'],
  ['orders', 'vendor_payout_amount'],
  ['orders', 'commission_amount'],
  ['orders', 'commission_rate'],
  ['promotions', 'discount_domain'],
  ['coupons', 'discount_domain'],
  ['commercial_discount_campaigns', 'discount_domain'],
  ['commercial_discount_campaigns', 'budget_cap'],
  ['vendor_earnings', 'metadata'],
];

const MIGRATIONS_EXPECTED = [
  '1046_commercial_discount_campaigns.sql',
  '1055_order_promotion_columns.sql',
  '1063_ecommerce_admin_promotions.sql',
  '1064_ecommerce_order_settlements.sql',
  '1067_vendor_earnings_settlement_metadata.sql',
  '1068_discount_policy_center_v2.sql',
  '1069_coupons_service_targeting.sql',
  '1070_promotions_coupons_discount_domain.sql',
  '1071_commercial_campaigns_discount_domain_budget.sql',
];

async function main() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' },
    ),
  );
  const cluster = clusterInfo.DBClusters[0];
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }
  const port = cluster.Port || 5432;
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

  const pool = new Pool({
    host: endpoint,
    port,
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  console.log(`\n=== Ecommerce promo schema check (${ENVIRONMENT}) ===`);
  console.log(`Host: ${endpoint}\n`);

  const client = await pool.connect();
  try {
    const tableRes = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY 1`,
      [TABLES],
    );
    const presentTables = new Set(tableRes.rows.map((r) => r.table_name));
    console.log('Tables:');
    for (const t of TABLES) {
      console.log(`  ${presentTables.has(t) ? 'OK ' : 'MISS'}  ${t}`);
    }

    console.log('\nColumns:');
    for (const [table, column] of COLUMNS) {
      const colRes = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column],
      );
      console.log(`  ${colRes.rowCount > 0 ? 'OK ' : 'MISS'}  ${table}.${column}`);
    }

    // Infer which migrations are likely still needed
    const needs = [];
    if (!presentTables.has('commercial_discount_campaigns')) {
      needs.push('1046_commercial_discount_campaigns.sql');
    }
    const promoSrc = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='orders' AND column_name='promotion_source'`,
    );
    if (promoSrc.rowCount === 0) needs.push('1055_order_promotion_columns.sql');
    if (!presentTables.has('ecommerce_admin_promotions')) {
      needs.push('1063_ecommerce_admin_promotions.sql');
    }
    if (!presentTables.has('ecommerce_order_settlements')) {
      needs.push('1064_ecommerce_order_settlements.sql');
    }
    const veMeta = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='vendor_earnings' AND column_name='metadata'`,
    );
    if (veMeta.rowCount === 0) needs.push('1067_vendor_earnings_settlement_metadata.sql');
    if (!presentTables.has('discount_policy_versions')) {
      needs.push('1068_discount_policy_center_v2.sql');
    }
    const ddPromo = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='promotions' AND column_name='discount_domain'`,
    );
    const ddCoupon = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='coupons' AND column_name='discount_domain'`,
    );
    if (ddPromo.rowCount === 0 || ddCoupon.rowCount === 0) {
      needs.push('1070_promotions_coupons_discount_domain.sql');
    }
    const ddCamp = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='commercial_discount_campaigns' AND column_name='discount_domain'`,
    );
    if (presentTables.has('commercial_discount_campaigns') && ddCamp.rowCount === 0) {
      needs.push('1071_commercial_campaigns_discount_domain_budget.sql');
    }

    console.log('\nLikely missing migrations (inferred):');
    if (needs.length === 0) {
      console.log('  (none detected from structural checks)');
    } else {
      for (const m of needs) console.log(`  → ${m}`);
    }
    console.log('\nExpected related migration filenames:');
    for (const m of MIGRATIONS_EXPECTED) console.log(`  - ${m}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Schema check failed:', err.message || err);
  process.exit(1);
});
