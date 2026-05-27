/**
 * deploy-with-clock-offset.mjs
 *
 * Deploys the Lambda zip using AWS SDK v3 with automatic clock-offset detection.
 * Bypasses AWS CLI InvalidSignatureException caused by local machine clock skew.
 *
 * Usage:
 *   node scripts/deploy-with-clock-offset.mjs
 *   node scripts/deploy-with-clock-offset.mjs --prod          # prod Lambda
 *   node scripts/deploy-with-clock-offset.mjs --admin-web     # also deploy admin-web to S3
 */

import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// Use require anchored to backend/lambda so AWS SDK packages resolve correctly
const require = createRequire(path.join(ROOT, 'backend/lambda/package.json'));

const PROD = process.argv.includes('--prod');
const ALSO_ADMIN_WEB = process.argv.includes('--admin-web');
const ALSO_CUSTOMER_WEB = process.argv.includes('--customer-web');
const ONLY_CUSTOMER_WEB = process.argv.includes('--only-customer-web');

const LAMBDA_FUNCTION_NAME = PROD
  ? (process.env.LAMBDA_FUNCTION_NAME ?? 'warmpawz-prod-api-handler')
  : (process.env.LAMBDA_FUNCTION_NAME ?? 'warmpawz-dev-api-handler');
const REGION = 'ap-south-1';
const LAMBDA_ZIP = path.join(ROOT, 'backend/lambda/api-handler.zip');

// --- S3 / CloudFront (admin-web) config ---
const ADMIN_S3_BUCKET = PROD
  ? 'warmpawz-prod-admin-frontend-ap-south-1'
  : 'warmpawz-dev-admin-frontend-ap-south-1';
const ADMIN_CF_DIST_ID = PROD ? 'E2NHO6UUI5UIHW' : 'E1WPXL8WBOWOE8';
const API_BASE_URL = PROD
  ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
  : (() => {
      try {
        const urls = JSON.parse(readFileSync(path.join(ROOT, 'config/urls.json'), 'utf8'));
        return urls.apiGatewayDefaultUrl || '';
      } catch {
        return 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
      }
    })();

// ── Helper: get AWS server time offset ──────────────────────────────────────
function getAwsServerTimeOffsetMs() {
  return new Promise((resolve) => {
    const localBefore = Date.now();
    const req = https.request(
      {
        hostname: `lambda.${REGION}.amazonaws.com`,
        path: '/',
        method: 'GET',
      },
      (res) => {
        const serverDateHeader = res.headers['date'];
        const localAfter = Date.now();
        const localMid = Math.round((localBefore + localAfter) / 2);
        if (serverDateHeader) {
          const serverMs = new Date(serverDateHeader).getTime();
          const offset = serverMs - localMid;
          console.log(`  Server time : ${new Date(serverMs).toISOString()}`);
          console.log(`  Local  time : ${new Date(localMid).toISOString()}`);
          console.log(`  Clock offset: ${Math.round(offset / 1000)}s`);
          resolve(offset);
        } else {
          console.log('  Could not read server Date header — using offset 0');
          resolve(0);
        }
        res.resume();
      }
    );
    req.on('error', () => resolve(0));
    req.end();
  });
}

// ── Lambda update ────────────────────────────────────────────────────────────
async function deployLambda(clockOffset) {
  const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');

  if (!existsSync(LAMBDA_ZIP)) {
    console.error(`❌ ${LAMBDA_ZIP} not found. Run npm run build in backend/lambda first.`);
    process.exit(1);
  }

  const zipBuffer = readFileSync(LAMBDA_ZIP);
  const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`\n📤 Uploading ${LAMBDA_FUNCTION_NAME} (${sizeMB} MB) …`);

  const client = new LambdaClient({
    region: REGION,
    systemClockOffset: clockOffset,
  });

  const result = await client.send(
    new UpdateFunctionCodeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      ZipFile: zipBuffer,
    })
  );

  console.log(`✅ Lambda deployed: ${result.FunctionArn}`);
  console.log(`   State         : ${result.State}`);
  console.log(`   Last modified : ${result.LastModified}`);
}

// Shared config from urls.json (used by both admin and customer web deploy)
const urls = (() => {
  try { return JSON.parse(readFileSync(path.join(ROOT, 'config/urls.json'), 'utf8')); } catch { return {}; }
})();

// ── Admin-web S3 sync ────────────────────────────────────────────────────────
async function deployAdminWeb(clockOffset) {
  const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
  const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
  const { readdirSync, statSync } = require('fs');
  const mime = require('mime-types');

  const distDir = path.join(ROOT, 'apps/admin-web/dist');
  if (!existsSync(distDir)) {
    console.error(`❌ Admin-web dist not found at ${distDir}. Build first.`);
    process.exit(1);
  }

  // Write runtime-config.js
  const customerWebUrl = PROD
    ? 'https://customer.warmpawz.com'
    : (urls?.cloudfront?.customer || 'https://d2aoyjj8ine0wk.cloudfront.net');
  const vendorWebUrl = PROD
    ? 'https://vendor.warmpawz.com'
    : (urls?.cloudfront?.vendor || 'https://d1s6ykkj381k58.cloudfront.net');

  const runtimeConfig = `window.__WARMPAWZ_RUNTIME_CONFIG__ = ${JSON.stringify({
    apiBaseUrl: API_BASE_URL,
    environment: PROD ? 'production' : 'development',
    uatMode: !PROD,
    customerWebUrl,
    vendorWebUrl,
  }, null, 2)};`;
  const { writeFileSync } = require('fs');
  writeFileSync(path.join(distDir, 'runtime-config.js'), runtimeConfig);
  console.log(`  runtime-config.js → ${API_BASE_URL}`);

  const s3 = new S3Client({ region: REGION, systemClockOffset: clockOffset });
  const cf = new CloudFrontClient({ region: 'us-east-1', systemClockOffset: clockOffset });

  // Enumerate all files
  function walkDir(dir, base = dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...walkDir(full, base));
      else files.push(full);
    }
    return files;
  }

  const files = walkDir(distDir);
  console.log(`\n📤 Uploading ${files.length} files to s3://${ADMIN_S3_BUCKET} …`);

  let uploaded = 0;
  for (const file of files) {
    const key = file.replace(distDir, '').replace(/\\/g, '/').replace(/^\//, '');
    const contentType = mime.lookup(file) || 'application/octet-stream';
    await s3.send(
      new PutObjectCommand({
        Bucket: ADMIN_S3_BUCKET,
        Key: key,
        Body: readFileSync(file),
        ContentType: contentType,
      })
    );
    uploaded++;
    if (uploaded % 20 === 0) process.stdout.write(`  ${uploaded}/${files.length} …\r`);
  }

  console.log(`✅ Uploaded ${uploaded} files to S3`);

  // CloudFront invalidation
  console.log(`\n🔄 Invalidating CloudFront ${ADMIN_CF_DIST_ID} …`);
  await cf.send(
    new CreateInvalidationCommand({
      DistributionId: ADMIN_CF_DIST_ID,
      InvalidationBatch: {
        CallerReference: `deploy-${Date.now()}`,
        Paths: { Quantity: 1, Items: ['/*'] },
      },
    })
  );
  console.log('✅ CloudFront invalidation created');
}

// ── Customer-web S3 sync ──────────────────────────────────────────────────────
async function deployCustomerWeb(clockOffset) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
  const { readdirSync } = require('fs');
  const mime = require('mime-types');

  const CUSTOMER_S3_BUCKET = PROD
    ? 'warmpawz-prod-customer-frontend-ap-south-1'
    : 'warmpawz-dev-customer-frontend-ap-south-1';
  const CUSTOMER_CF_DIST_ID = PROD ? 'E2F29N49KVOOBP' : 'E2RDORGXSWJJ87';
  const CUSTOMER_API_URL = PROD
    ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
    : API_BASE_URL;
  const CUSTOMER_WEB_URL = PROD
    ? 'https://customer.warmpawz.com'
    : (urls?.cloudfront?.customer || 'https://d2aoyjj8ine0wk.cloudfront.net');

  const distDir = path.join(ROOT, 'apps/customer-web/dist');
  if (!existsSync(distDir)) {
    console.error(`❌ Customer-web dist not found at ${distDir}. Build first.`);
    process.exit(1);
  }

  const { writeFileSync } = require('fs');
  // Inject runtime-config.js (matches the format the existing customer-web uses)
  const runtimeCfg = `(function() {\n  window.__WARMPAWZ_RUNTIME_CONFIG__ = ${JSON.stringify({
    apiBaseUrl: CUSTOMER_API_URL,
    uatMode: !PROD,
    environment: PROD ? 'production' : 'development',
  }, null, 4)};\n  console.log('Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);\n})();\n`;
  writeFileSync(path.join(distDir, 'runtime-config.js'), runtimeCfg);
  console.log(`  customer runtime-config.js → ${CUSTOMER_API_URL}`);

  function walkDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...walkDir(full));
      else files.push(full);
    }
    return files;
  }

  const s3 = new S3Client({ region: REGION, systemClockOffset: clockOffset });
  const cf = new CloudFrontClient({ region: 'us-east-1', systemClockOffset: clockOffset });

  const files = walkDir(distDir);
  console.log(`\n📤 Uploading ${files.length} files to s3://${CUSTOMER_S3_BUCKET} …`);

  let uploaded = 0;
  for (const file of files) {
    const key = file.replace(distDir, '').replace(/\\/g, '/').replace(/^\//, '');
    const contentType = mime.lookup(file) || 'application/octet-stream';
    await s3.send(new PutObjectCommand({
      Bucket: CUSTOMER_S3_BUCKET,
      Key: key,
      Body: readFileSync(file),
      ContentType: contentType,
    }));
    uploaded++;
    if (uploaded % 20 === 0) process.stdout.write(`  ${uploaded}/${files.length} …\r`);
  }
  console.log(`✅ Uploaded ${uploaded} files to S3 (customer-web)`);

  console.log(`\n🔄 Invalidating CloudFront ${CUSTOMER_CF_DIST_ID} …`);
  await cf.send(new CreateInvalidationCommand({
    DistributionId: CUSTOMER_CF_DIST_ID,
    InvalidationBatch: { CallerReference: `deploy-cw-${Date.now()}`, Paths: { Quantity: 1, Items: ['/*'] } },
  }));
  console.log('✅ CloudFront invalidation created (customer-web)');
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🕐 Detecting clock offset vs AWS …');
  const clockOffset = await getAwsServerTimeOffsetMs();

  if (!ONLY_CUSTOMER_WEB) {
    await deployLambda(clockOffset);
  }

  if (ALSO_ADMIN_WEB) {
    console.log('\n📦 Deploying admin-web …');
    await deployAdminWeb(clockOffset);
  }

  if (ALSO_CUSTOMER_WEB || ONLY_CUSTOMER_WEB) {
    console.log('\n📦 Deploying customer-web …');
    await deployCustomerWeb(clockOffset);
  }

  console.log('\n🎉 All deployments complete!');
})();
