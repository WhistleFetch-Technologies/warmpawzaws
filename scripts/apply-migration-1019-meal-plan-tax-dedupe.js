#!/usr/bin/env node

/**
 * MIGRATION 1019: Deduplicate meal-plan tax_categories (Food + Delivery Fee)
 *
 * Usage:
 *   node scripts/apply-migration-1019-meal-plan-tax-dedupe.js
 *   ENVIRONMENT=prod node scripts/apply-migration-1019-meal-plan-tax-dedupe.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

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
  let secretName = DB_SECRET_ARN;
  if (!secretName) {
    secretName =
      ENVIRONMENT === 'prod'
        ? 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE'
        : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  }
  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(response.SecretString || '{}');
  DB_USER = DB_USER || secret.username || secret.Username;
  DB_PASSWORD = secret.password || secret.Password;
}

async function main() {
  console.log('MIGRATION 1019: meal-plan tax_categories dedupe');
  console.log(`Environment: ${ENVIRONMENT}`);

  if (!DB_HOST || !DB_NAME) {
    const { execSync } = require('child_process');
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    DB_HOST = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query "DBClusters[0].Endpoint" --output text`,
      { encoding: 'utf8' },
    ).trim();
    DB_NAME =
      execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query "DBClusters[0].DatabaseName" --output text`,
        { encoding: 'utf8' },
      ).trim() || 'warmpawz';
    DB_USER =
      execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query "DBClusters[0].MasterUsername" --output text`,
        { encoding: 'utf8' },
      ).trim() || 'warmpawz_admin';
  }

  if (!DB_HOST || !DB_NAME) {
    console.error('Missing DB_HOST / DB_NAME');
    process.exit(1);
  }

  await fetchDbCredentials();

  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '1019_dedupe_meal_plan_tax_categories.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  try {
    console.log('Before:');
    const before = await pool.query(`
      SELECT id, COALESCE(name, category_name) AS label, gst_application_scope, catalog_category_id
      FROM tax_categories
      WHERE meal_plan_tax_kind(COALESCE(name, category_name, ''), gst_application_scope) IS NOT NULL
      ORDER BY label
    `);
    console.table(before.rows);

    await pool.query(sql);

    console.log('After:');
    const after = await pool.query(`
      SELECT id, COALESCE(name, category_name) AS label, gst_application_scope, catalog_category_id
      FROM tax_categories
      WHERE meal_plan_tax_kind(COALESCE(name, category_name, ''), gst_application_scope) IS NOT NULL
      ORDER BY label
    `);
    console.table(after.rows);
    console.log('Done.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
