#!/usr/bin/env node
/**
 * Verify walker role consolidation status after migration 521.
 * Uses same RDS connection as run-migration-rds-node.js (AWS RDS + Secrets Manager)
 * or DATABASE_URL if set.
 *
 * Usage:
 *   node scripts/verify-walker-status.js
 *   ENVIRONMENT=dev node scripts/verify-walker-status.js
 *   DATABASE_URL=postgresql://... node scripts/verify-walker-status.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('rds.') ? { rejectUnauthorized: false } : undefined,
    });
  }

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';
  const dbName = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';
  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;
  if (!password) throw new Error('Password not found in secret');

  return new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
}

async function main() {
  console.log('🔍 Walker role consolidation – verification');
  console.log('============================================\n');

  const pool = await getPool();
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }

  const queries = [
    {
      title: '1) Canonical walker role',
      sql: `SELECT id, name AS role_code, display_name, description, is_active, customer_service
            FROM roles WHERE name = 'walker'`,
    },
    {
      title: '2) All roles containing "walk" (canonical + legacy)',
      sql: `SELECT name AS role_code, display_name, is_active
            FROM roles WHERE LOWER(name) LIKE '%walk%' OR LOWER(display_name) LIKE '%walk%'
            ORDER BY is_active DESC, name`,
    },
    {
      title: '3) Vendor counts by walker role',
      sql: `SELECT r.name AS role_code, r.display_name, r.is_active, COUNT(v.id) AS vendor_count
            FROM roles r
            LEFT JOIN vendors v ON v.role_id = r.id
            WHERE LOWER(r.name) IN ('walker', 'walker_solo', 'pet_walker', 'dog_walker')
               OR LOWER(REPLACE(r.name, ' ', '_')) IN ('walker', 'walker_solo', 'pet_walker', 'dog_walker')
            GROUP BY r.id, r.name, r.display_name, r.is_active
            ORDER BY r.is_active DESC, r.name`,
    },
    {
      title: '4) Vendors on canonical walker role',
      sql: `SELECT v.id, v.business_name, v.phone, v.status, v.is_active
            FROM vendors v
            JOIN roles r ON v.role_id = r.id AND r.name = 'walker'
            ORDER BY v.business_name`,
    },
    {
      title: '5) Vendors still on legacy walker roles (should be 0)',
      sql: `SELECT v.id, v.business_name, r.name AS role_name, r.is_active AS role_active
            FROM vendors v
            JOIN roles r ON v.role_id = r.id
            WHERE LOWER(r.name) IN ('walker_solo', 'pet_walker', 'dog_walker')
               OR (LOWER(REPLACE(r.name, ' ', '_')) IN ('walker_solo', 'pet_walker', 'dog_walker') AND r.name != 'walker')`,
    },
  ];

  let canonicalWalker = null;
  let vendorCountWalker = 0;
  let legacyVendorCount = 0;

  for (let i = 0; i < queries.length; i++) {
    const { title, sql } = queries[i];
    console.log(title);
    console.log('─'.repeat(60));
    const res = await pool.query(sql);
    if (res.rows.length === 0) {
      console.log('(no rows)\n');
    } else {
      console.table(res.rows);
      if (i === 0 && res.rows[0]) canonicalWalker = res.rows[0];
      if (i === 2) {
        const walkerRow = res.rows.find(r => (r.role_code || '').toLowerCase() === 'walker');
        vendorCountWalker = walkerRow ? parseInt(walkerRow.vendor_count, 10) : 0;
      }
      if (i === 4) legacyVendorCount = res.rows.length;
      console.log('');
    }
  }

  await pool.end();

  console.log('════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log('Canonical role "walker" (Pet Walker):', canonicalWalker?.is_active ? '✅ present and active' : '❌ missing or inactive');
  console.log('Vendors on walker role:', vendorCountWalker);
  console.log('Vendors on legacy walker roles:', legacyVendorCount, legacyVendorCount === 0 ? '✅' : '❌ should be 0');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
