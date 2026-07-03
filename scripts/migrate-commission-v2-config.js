#!/usr/bin/env node
/**
 * Migrate ecommerce commission V2 vendor_commission_config from legacy seller_rates + category matrix.
 *
 * Usage (dry-run default):
 *   node scripts/migrate-commission-v2-config.js
 *   node scripts/migrate-commission-v2-config.js --apply
 *
 * Requires DATABASE_URL or ENVIRONMENT=dev with AWS credentials (same as run-migration-rds-node.js).
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const APPLY = process.argv.includes('--apply');

async function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

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
  const secretsClient = new SecretsManagerClient({ region: REGION });
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  if (ENVIRONMENT === 'prod') {
    secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  }
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const creds = JSON.parse(secretValue.SecretString);
  return new Pool({
    host: endpoint,
    port: cluster.Port || 5432,
    database: cluster.DatabaseName || 'warmpawz',
    user: creds.username || cluster.MasterUsername,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
  });
}

function parseSellerRate(entry) {
  if (entry == null) return null;
  if (typeof entry === 'number') return entry;
  if (typeof entry === 'string' && entry.trim() !== '') {
    const n = parseFloat(entry);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof entry === 'object' && entry.default != null) {
    const n = parseFloat(String(entry.default));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function main() {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const settingsRes = await client.query(
      `SELECT seller_rates FROM ecommerce_commission_settings WHERE setting_key = 'default' LIMIT 1`
    );
    const sellerRates = settingsRes.rows[0]?.seller_rates || {};
    const parsedRates =
      typeof sellerRates === 'string' ? JSON.parse(sellerRates) : sellerRates;

    const categoryRes = await client.query(
      `SELECT DISTINCT vendor_id::text AS vendor_id FROM vendor_category_commission_rates WHERE is_active = true`
    );
    const vendorsWithCategory = new Set(
      categoryRes.rows.map((r) => String(r.vendor_id))
    );

    const vendorIds = new Set([
      ...Object.keys(parsedRates || {}),
      ...vendorsWithCategory,
    ]);

    const report = {
      mode: APPLY ? 'apply' : 'dry-run',
      vendorsToMigrate: [],
      vendorsSkipped: [],
    };

    for (const vendorId of vendorIds) {
      const hasCategory = vendorsWithCategory.has(vendorId);
      const defaultRate = parseSellerRate(parsedRates[vendorId]);

      if (!hasCategory && defaultRate == null) {
        report.vendorsSkipped.push({ vendorId, reason: 'no seller_rates or category overrides' });
        continue;
      }

      const entry = {
        vendorId,
        commissionModel: 'category',
        defaultCommissionRate: defaultRate,
      };
      report.vendorsToMigrate.push(entry);

      if (APPLY) {
        await client.query(
          `INSERT INTO vendor_commission_config (vendor_id, commission_model, default_commission_rate)
           VALUES ($1::uuid, 'category', $2)
           ON CONFLICT (vendor_id) DO UPDATE SET
             commission_model = EXCLUDED.commission_model,
             default_commission_rate = COALESCE(EXCLUDED.default_commission_rate, vendor_commission_config.default_commission_rate),
             updated_at = NOW()`,
          [vendorId, defaultRate]
        );
      }
    }

    console.log(JSON.stringify(report, null, 2));
    console.log(
      `\n${APPLY ? 'Applied' : 'Dry-run'}: ${report.vendorsToMigrate.length} vendors, skipped ${report.vendorsSkipped.length}`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
