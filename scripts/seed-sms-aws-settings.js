#!/usr/bin/env node
/**
 * Seed admin:settings:aws for SMS via SNS
 *
 * Upserts platform_settings with AWS credentials and SNS config for sending
 * real SMS (Login OTP, booking notifications) when UAT_MODE=false.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/seed-sms-aws-settings.js
 *   ENVIRONMENT=dev SMS_AWS_ACCESS_KEY_ID=xxx SMS_AWS_SECRET_ACCESS_KEY=yyy node scripts/seed-sms-aws-settings.js --enable
 *   ENVIRONMENT=dev node scripts/seed-sms-aws-settings.js --status
 *
 * Requires: AWS CLI configured; RDS cluster warmpawz-{ENVIRONMENT}-cluster; Secrets Manager.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function getDBConnection() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));

  if (!clusterInfo.DBClusters?.length) {
    throw new Error(`RDS cluster not found: ${clusterId}`);
  }

  const endpoint = clusterInfo.DBClusters[0].Endpoint;
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002` })
  );
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;

  return new Pool({
    host: endpoint,
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password,
    ssl: { rejectUnauthorized: false },
  });
}

async function getStatus() {
  console.log('📊 SMS AWS Settings Status');
  console.log('==========================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log('');

  const pool = await getDBConnection();
  try {
    const res = await pool.query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:settings:aws' LIMIT 1`
    );
    if (res.rows.length === 0) {
      console.log('No admin:settings:aws found.');
      console.log('Run with --enable and SMS_AWS_ACCESS_KEY_ID / SMS_AWS_SECRET_ACCESS_KEY to seed.');
      return;
    }
    const cfg = typeof res.rows[0].setting_value === 'string'
      ? JSON.parse(res.rows[0].setting_value)
      : res.rows[0].setting_value;

    console.log('Current config:');
    console.log(`  credentials.accessKeyId: ${cfg?.credentials?.accessKeyId ? '***' : '(empty)'}`);
    console.log(`  credentials.region: ${cfg?.credentials?.region || 'ap-south-1'}`);
    console.log(`  sns.enabled: ${cfg?.sns?.enabled ? 'YES' : 'NO'}`);
    console.log(`  sns.region: ${cfg?.sns?.region || 'ap-south-1'}`);
    console.log(`  sns.smsOriginationNumber: ${cfg?.sns?.smsOriginationNumber || 'WARMPZ'}`);
  } finally {
    await pool.end();
  }
}

async function seedConfig(options) {
  const accessKeyId = process.env.SMS_AWS_ACCESS_KEY_ID || options.accessKeyId || '';
  const secretAccessKey = process.env.SMS_AWS_SECRET_ACCESS_KEY || options.secretAccessKey || '';
  const enable = options.enable === true;

  const config = {
    credentials: {
      accessKeyId,
      secretAccessKey,
      region: process.env.AWS_REGION || 'ap-south-1',
    },
    s3: { enabled: false, bucket: '', region: 'ap-south-1' },
    sns: {
      enabled: enable && !!accessKeyId && !!secretAccessKey,
      region: 'ap-south-1',
      smsOriginationNumber: 'WARMPZ',
      entityId: process.env.SMS_ENTITY_ID || '1201176605406673276',
      templateId: process.env.SMS_TEMPLATE_ID || '1207177028377787269',
      emailSourceAddress: '',
    },
    sqs: { enabled: false, queueUrl: '', region: 'ap-south-1' },
    chime: { enabled: false, region: 'us-east-1' },
    bedrock: { enabled: false, region: 'us-east-1', modelId: 'anthropic.claude-v2' },
  };

  console.log('🔧 Seeding admin:settings:aws for SMS');
  console.log('=====================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`SNS enabled: ${config.sns.enabled}`);
  console.log(`Header: ${config.sns.smsOriginationNumber}`);
  console.log('');

  const pool = await getDBConnection();
  try {
    const existing = await pool.query(
      `SELECT id FROM platform_settings WHERE setting_key = 'admin:settings:aws'`
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE platform_settings SET setting_value = $1::jsonb, updated_at = NOW() WHERE setting_key = 'admin:settings:aws'`,
        [JSON.stringify(config)]
      );
      console.log('✅ Updated admin:settings:aws');
    } else {
      await pool.query(
        `INSERT INTO platform_settings (setting_key, setting_value, setting_type, is_public, created_at, updated_at)
         VALUES ('admin:settings:aws', $1::jsonb, 'object', false, NOW(), NOW())`,
        [JSON.stringify(config)]
      );
      console.log('✅ Created admin:settings:aws');
    }
    console.log('');
    console.log('When UAT_MODE=false and sns.enabled=true, Login OTP SMS will be sent via SNS.');
  } finally {
    await pool.end();
  }
}

// Parse args
const args = process.argv.slice(2);
const enable = args.includes('--enable');

if (args.includes('--status') || (args.length === 0 && !enable)) {
  getStatus().catch((e) => { console.error(e); process.exit(1); });
} else {
  seedConfig({ enable }).catch((e) => { console.error(e); process.exit(1); });
}
