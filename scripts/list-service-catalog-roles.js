#!/usr/bin/env node

/**
 * ============================================================================
 * Service Catalog Role Discovery (Audit)
 * ============================================================================
 *
 * Lists all service_catalog rows with applicable_roles for audit and
 * verifying which roles see which services in vendor service management.
 *
 * Usage:
 *   node scripts/list-service-catalog-roles.js
 *   node scripts/list-service-catalog-roles.js --role vet_solo   # filter by role
 *   node scripts/list-service-catalog-roles.js --csv             # CSV output
 *
 * Environment: Same as apply-migration-255-service-catalog-role-assignment.js
 *   ENVIRONMENT, DB_HOST, DB_NAME, DB_SECRET_ARN or DB_USER/DB_PASSWORD, AWS_REGION, DB_SSL
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

let DB_HOST = process.env.DB_HOST || process.env.RDS_HOSTNAME;
let DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
let DB_NAME = process.env.DB_NAME || process.env.RDS_DB_NAME;
let DB_USER = process.env.DB_USER || process.env.RDS_USERNAME;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN;
let DB_PASSWORD = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;

const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

async function fetchDbCredentials() {
  if (DB_USER && DB_PASSWORD) return;
  let secretName = DB_SECRET_ARN || `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(response.SecretString);
  DB_USER = DB_USER || secret.username || secret.Username || secret.user;
  DB_PASSWORD = secret.password || secret.Password;
  if (!DB_PASSWORD || !DB_USER) throw new Error('Failed to parse credentials from secret');
}

async function main() {
  const filterRole = process.argv.includes('--role')
    ? process.argv[process.argv.indexOf('--role') + 1]
    : null;
  const csv = process.argv.includes('--csv');

  if (!DB_HOST || !DB_NAME) {
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
      const endpoint = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      ).trim();
      if (endpoint && endpoint !== 'None' && endpoint !== 'null') {
        DB_HOST = endpoint;
        DB_PORT = parseInt(
          execSync(
            `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          ).trim() || '5432',
          10
        );
        DB_NAME = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim() || 'warmpawz';
        DB_USER = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim() || 'warmpawz_admin';
      }
    } catch (e) {
      /* ignore */
    }
  }

  if (!DB_HOST || !DB_NAME) {
    console.error('Set DB_HOST and DB_NAME, or run with AWS CLI + RDS cluster.');
    process.exit(1);
  }

  await fetchDbCredentials();

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  let queryText = `
    SELECT service_id, service_name, category_name, service_style,
           applicable_roles, status, publish_status
    FROM service_catalog
    WHERE status = 'active'
    ORDER BY category_name ASC, service_name ASC
  `;
  const params = [];
  if (filterRole) {
    queryText = `
      SELECT service_id, service_name, category_name, service_style,
             applicable_roles, status, publish_status
      FROM service_catalog
      WHERE status = 'active'
        AND (applicable_roles @> $1::text[] OR applicable_roles IS NULL)
      ORDER BY category_name ASC, service_name ASC
    `;
    params.push([filterRole]);
  }

  const result = await pool.query(queryText, params);
  const rows = result.rows || [];

  await pool.end();

  if (csv) {
    console.log('service_id,service_name,category_name,service_style,applicable_roles');
    rows.forEach((r) => {
      const roles = Array.isArray(r.applicable_roles) ? r.applicable_roles.join(';') : (r.applicable_roles || '');
      console.log([r.service_id, r.service_name, r.category_name, r.service_style, roles].map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(','));
    });
    return;
  }

  console.log('Service Catalog Role Assignment (audit)');
  console.log('=======================================');
  if (filterRole) console.log(`Filter: role = ${filterRole}`);
  console.log(`Total active services: ${rows.length}`);
  console.log('');

  const byCategory = {};
  rows.forEach((r) => {
    const cat = r.category_name || 'General';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  });

  Object.keys(byCategory).sort().forEach((cat) => {
    console.log(`[${cat}]`);
    byCategory[cat].forEach((r) => {
      const roles = Array.isArray(r.applicable_roles) ? r.applicable_roles.join(', ') : (r.applicable_roles || '—');
      console.log(`  ${r.service_id || r.service_name} | ${r.service_name} | style: ${r.service_style || '—'} | roles: ${roles}`);
    });
    console.log('');
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
