#!/usr/bin/env node
/**
 * Compare search_taxonomy_keywords between dev and prod RDS.
 * Usage: node scripts/compare-search-taxonomy-envs.js
 */
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';

const ENVS = {
  dev: {
    clusterId: 'warmpawz-dev-cluster',
    secretName: 'warmpawz-dev-rds-master-20260207201049162400000001',
    proxy: null,
  },
  prod: {
    clusterId: 'warmpawz-prod-cluster',
    secretName: 'warmpawz-prod-rds-master-20260207201049162400000001',
    proxy: 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  },
};

async function getPool(envKey) {
  const cfg = ENVS[envKey];
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${cfg.clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  const endpoint = cfg.proxy || cluster.Endpoint;
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: cfg.secretName })
  );
  const secret = JSON.parse(secretValue.SecretString);
  return new Pool({
    host: endpoint,
    port: cluster.Port || 5432,
    database: cluster.DatabaseName || 'warmpawz',
    user: secret.username || cluster.MasterUsername,
    password: secret.password,
    ssl: envKey === 'prod' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
  });
}

async function queryEnv(envKey) {
  const pool = await getPool(envKey);
  try {
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'search_taxonomy_keywords'
      ) AS exists
    `);
    if (!tableExists.rows[0]?.exists) {
      return { envKey, tableExists: false };
    }

    const total = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM search_taxonomy_keywords WHERE is_active = true'
    );
    const byHub = await pool.query(`
      SELECT hub_slug, COUNT(*)::int AS cnt
      FROM search_taxonomy_keywords WHERE is_active = true
      GROUP BY hub_slug ORDER BY cnt DESC
    `);
    const keywords = [
      'dog trainer',
      'dog walk',
      'walk my dog',
      'diet consultation',
      'diet consultant',
      'training',
      'trainer',
    ];
    const kwRows = [];
    for (const kw of keywords) {
      const res = await pool.query(
        `SELECT keyword, hub_slug, subcategory FROM search_taxonomy_keywords
         WHERE keyword_normalized = $1 AND is_active = true LIMIT 1`,
        [kw.toLowerCase().replace(/\s+/g, ' ').trim()]
      );
      kwRows.push({ kw, found: res.rows[0] || null });
    }

    const trainingVendors = await pool.query(`
      SELECT COUNT(DISTINCT v.id)::int AS cnt
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.is_active = true
        AND v.status IN ('approved', 'active')
        AND (
          LOWER(COALESCE(v.category, '')) LIKE '%train%'
          OR LOWER(COALESCE(r.name, '')) LIKE '%train%'
          OR EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id
              AND vs.is_enabled = true
              AND vs.publish_status IN ('published', 'auto_published')
              AND (
                LOWER(COALESCE(vs.category, '')) LIKE '%train%'
                OR LOWER(COALESCE(vs.service_name, '')) LIKE '%train%'
              )
          )
        )
    `);

    return {
      envKey,
      tableExists: true,
      totalActive: total.rows[0]?.cnt ?? 0,
      byHub: byHub.rows,
      keywords: kwRows,
      trainingVendorCount: trainingVendors.rows[0]?.cnt ?? 0,
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  for (const env of ['dev', 'prod']) {
    console.log(`\n========== ${env.toUpperCase()} ==========`);
    try {
      const result = await queryEnv(env);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`${env} failed:`, err.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
