#!/usr/bin/env node
/**
 * Run Migration 506: Add diagnostics statuses to bookings (AWS RDS)
 * Usage: node scripts/run-migration-506-diagnostics-status.js
 */
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function run() {
  const clusterId = `warmpawz-${ENV}-cluster`;
  let endpoint, port, dbName, username;
  try {
    endpoint = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`, { encoding: 'utf8' }).trim();
    port = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`, { encoding: 'utf8' }).trim() || '5432';
    dbName = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`, { encoding: 'utf8' }).trim() || 'warmpawz';
    username = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`, { encoding: 'utf8' }).trim() || 'warmpawz_admin';
  } catch (e) {
    console.error('RDS info failed:', e.message);
    process.exit(1);
  }
  const sm = new SecretsManagerClient({ region: REGION });
  const secret = JSON.parse((await sm.send(new GetSecretValueCommand({ SecretId: `warmpawz-${ENV}-rds-master-20260106164510791100000002` }))).SecretString);
  const password = secret.password || secret.Password;
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', '506_bookings_diagnostics_statuses.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration 506 applied.');
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
