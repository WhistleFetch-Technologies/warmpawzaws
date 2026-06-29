#!/usr/bin/env node
/**
 * Restore warmpawz-dev-api-handler environment after accidental wipe.
 * Values sourced from infra/envs/dev/main.tf + terraform output + AWS.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FN = 'warmpawz-dev-api-handler';
const REGION = 'ap-south-1';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:5173',
  'https://dev.admin.warmpawz.com',
  'https://dev.vendor.warmpawz.com',
  'https://dev.customer.warmpawz.com',
  'https://dfof7mguaa0a5.cloudfront.net',
  'https://d2aoyjj8ine0wk.cloudfront.net',
  'https://d1s6ykkj381k58.cloudfront.net',
].join(',');

const Variables = {
  ENVIRONMENT: 'dev',
  SETTLEMENT_CALCULATE_CRON_RULE_NAME: 'warmpawz-dev-settlement-calculate-daily',
  ALLOWED_ORIGINS,
  UAT_MODE: 'true',
  BYPASS_24H_MEAL_VALIDATION: 'true',
  NODE_ENV: 'development',
  DB_HOST: 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  DB_NAME: 'warmpawz',
  DB_SECRET_ARN:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI',
  DB_POOL_MAX: '10',
  DYNAMODB_SESSIONS_TABLE: 'warmpawz-dev-sessions',
  DYNAMODB_CACHE_TABLE: 'warmpawz-dev-cache',
  S3_UPLOADS_BUCKET: 'warmpawz-dev-user-uploads-057442119249',
  SQS_BOOKING_QUEUE_URL:
    'https://sqs.ap-south-1.amazonaws.com/057442119249/warmpawz-dev-booking-processing',
  SQS_PAYMENT_QUEUE_URL:
    'https://sqs.ap-south-1.amazonaws.com/057442119249/warmpawz-dev-payment-processing',
  SNS_NOTIFICATIONS_TOPIC_ARN:
    'arn:aws:sns:ap-south-1:057442119249:warmpawz-dev-user-notifications',
  SNS_BOOKING_UPDATES_ARN:
    'arn:aws:sns:ap-south-1:057442119249:warmpawz-dev-booking-updates',
  SNS_VENDOR_TOPIC_ARN:
    'arn:aws:sns:ap-south-1:057442119249:warmpawz-dev-vendor-notifications',
  RAZORPAY_SECRET_ARN:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz/dev/razorpay-7i05CE',
  GOOGLE_MAPS_SECRET_ARN:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz/dev/google-maps-Nbr9yB',
  SHIPROCKET_SECRET_ARN:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz/dev/shiprocket-al4nuE',
  AFTERSHIP_SECRET_ARN:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz/dev/aftership-vNHwKb',
  API_BASE_URL: 'https://dev.api.warmpawz.com',
  COGNITO_USER_POOL_ID: 'ap-south-1_HV6DrQLz4',
  COGNITO_CLIENT_ID: '3q3p9rqc00cpii3bqj0k5t4fao',
  DELIVERY_SERVICE_BASE_URL:
    'http://internal-warmpawz-dev-delivery-i-1043780974.ap-south-1.elb.amazonaws.com',
  MEAL_DELIVERY_NOTIFY_SECRET: 'warmpawz-dev-meal-delivery-notify-2026',
  SEARCH_USE_FTS: 'true',
  PLATFORM_TAX_DOCUMENTS_ENABLED: 'true',
};

function main() {
  const tmp = path.join(os.tmpdir(), `lambda-env-dev-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ Variables }));
  console.log(`Updating ${FN} with ${Object.keys(Variables).length} env vars...`);
  execSync(
    `aws lambda update-function-configuration --function-name ${FN} --region ${REGION} --environment file://${tmp.replace(/\\/g, '/')}`,
    { stdio: 'inherit' },
  );
  fs.unlinkSync(tmp);
  console.log('Waiting for Lambda update...');
  execSync(`aws lambda wait function-updated --function-name ${FN} --region ${REGION}`, {
    stdio: 'inherit',
  });
  console.log('Done.');
}

main();
