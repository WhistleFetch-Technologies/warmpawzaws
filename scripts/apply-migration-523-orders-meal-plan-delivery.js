#!/usr/bin/env node

/**
 * ============================================================================
 * MIGRATION 523: Orders Table - Meal Plan Delivery Columns
 * ============================================================================
 *
 * Purpose:
 * - Add order_type, delivery_date, delivery_time, payment_method to orders table
 * - Enables vendor GET /vendor/:vendorId/meal-orders to read meal_plan_delivery
 *   orders from the orders table (OBJECTIVE 2: vendor sees meal orders).
 *
 * Usage:
 *   node scripts/apply-migration-523-orders-meal-plan-delivery.js
 *
 * Environment Variables:
 *   - ENVIRONMENT: dev | stage | prod (default: dev)
 *   - DB_HOST, DB_PORT, DB_NAME: optional if AWS CLI + RDS cluster available
 *   - DB_SECRET_ARN: ARN of the secret containing DB credentials
 *   - DB_USER, DB_PASSWORD: Direct credentials (optional if DB_SECRET_ARN set)
 *   - AWS_REGION: AWS region (default: ap-south-1)
 *   - DB_SSL: Set to 'true' for SSL (e.g. when connecting to RDS)
 * ============================================================================
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
  if (DB_USER && DB_PASSWORD) {
    console.log('✅ Using credentials from environment variables');
    return;
  }

  let secretName = DB_SECRET_ARN;
  if (!secretName) {
    secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  }

  try {
    console.log(`📥 Fetching credentials from Secrets Manager: ${secretName}`);
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    DB_USER = DB_USER || secret.username || secret.Username || secret.user;
    DB_PASSWORD = secret.password || secret.Password;

    if (!DB_PASSWORD) throw new Error('Failed to parse password from secret');
    if (!DB_USER) throw new Error('Failed to parse username from secret');

    console.log('✅ Successfully fetched credentials from Secrets Manager');
  } catch (error) {
    if (!DB_USER || !DB_PASSWORD) {
      console.error('❌ Failed to fetch credentials from Secrets Manager:', error.message);
      console.error('   Set DB_USER and DB_PASSWORD, or DB_SECRET_ARN');
      throw error;
    }
    console.log('⚠️  Using provided credentials');
  }
}

async function applyMigration() {
  console.log('='.repeat(70));
  console.log('🚀 MIGRATION 523: Orders Table - Meal Plan Delivery Columns');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log('');

  if (!DB_HOST || !DB_NAME) {
    console.log('📊 Auto-discovering RDS cluster...');
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

      const endpoint = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      ).trim();

      if (endpoint && endpoint !== 'None' && endpoint !== 'null' && endpoint.length > 0) {
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
        console.log('✅ RDS cluster found via AWS CLI');
      }
    } catch (e) {
      console.log('⚠️  Could not auto-discover RDS (set DB_HOST, DB_NAME if needed)');
    }
  }

  if (!DB_HOST || !DB_NAME) {
    console.error('❌ Missing DB_HOST or DB_NAME. Set env or ensure AWS CLI + RDS cluster.');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   Host: ${DB_HOST}`);
  console.log(`   Port: ${DB_PORT}`);
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   User: ${DB_USER || '(from secret)'}`);
  console.log('');

  try {
    await fetchDbCredentials();
  } catch (e) {
    console.error('❌ Credentials:', e.message);
    process.exit(1);
  }

  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '523_orders_meal_plan_delivery_columns.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('📄 Migration file: 523_orders_meal_plan_delivery_columns.sql');
  console.log('');

  let pool;
  try {
    console.log('🔌 Connecting to database...');
    pool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 1,
    });

    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    console.log('');

    console.log('🔍 Pre-check: orders table columns...');
    const pre = await pool.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'orders' AND column_name IN ('order_type', 'delivery_date', 'delivery_time', 'payment_method')
       ORDER BY column_name
    `);
    const existing = (pre.rows || []).map((r) => r.column_name);
    console.log(`   Existing columns: ${existing.length ? existing.join(', ') : 'none'}`);
    console.log('');

    console.log('📝 Applying migration...');
    await pool.query(sql);
    console.log('✅ Migration SQL executed');
    console.log('');

    console.log('🔍 Post-check: orders table columns...');
    const post = await pool.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'orders' AND column_name IN ('order_type', 'delivery_date', 'delivery_time', 'payment_method')
       ORDER BY column_name
    `);
    const after = (post.rows || []).map((r) => r.column_name);
    console.log(`   Columns now: ${after.length ? after.join(', ') : 'none'}`);
    console.log('');

    console.log('✅ Migration 523 (orders meal plan delivery columns) complete.');
    await pool.end();
    console.log('');
    console.log('🎉 Done. Vendor GET /vendor/:vendorId/meal-orders can now read from orders table.');
  } catch (error) {
    console.error('');
    console.error('❌ MIGRATION FAILED:', error.message);
    if (error.stack) console.error(error.stack);
    if (pool) await pool.end();
    process.exit(1);
  }
}

applyMigration().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
