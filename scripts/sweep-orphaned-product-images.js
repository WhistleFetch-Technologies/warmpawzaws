#!/usr/bin/env node
/**
 * Find and optionally delete orphaned product images in S3 uploads bucket.
 * Orphan = key under products/{vendorId}/ not referenced in products.images,
 * product_skus.images, or legacy metadata.variants image URLs.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/sweep-orphaned-product-images.js           # dry-run (default)
 *   ENVIRONMENT=dev node scripts/sweep-orphaned-product-images.js --execute # delete orphans
 *   ENVIRONMENT=dev node scripts/sweep-orphaned-product-images.js --vendor-id=<uuid>
 *
 * Uses RDS Data API (no VPC required). Requires AWS credentials with RDS Data + S3 access.
 */

const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { getClusterInfo, parseRecords, DATABASE_NAME } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const PRODUCT_S3_PREFIX = 'products/';
const MANAGED_KEY_RE = /^products\/[0-9a-f-]{36}\/\d+_[a-z0-9]+\.(jpg|jpeg|png|webp)$/i;

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const vendorFilter = (() => {
  const arg = args.find((a) => a.startsWith('--vendor-id='));
  return arg ? arg.split('=')[1]?.trim() : null;
})();

const rdsData = new RDSDataClient({ region: REGION });

function getUploadsBuckets() {
  if (process.env.S3_UPLOADS_BUCKET) {
    return [process.env.S3_UPLOADS_BUCKET];
  }
  if (ENVIRONMENT === 'prod') {
    const accountId = process.env.AWS_ACCOUNT_ID || '057442119249';
    return [`warmpawz-prod-user-uploads-${accountId}`];
  }
  // Dev/stage: current user-uploads bucket + legacy alias bucket
  return [
    'warmpawz-dev-user-uploads-057442119249',
    'warmpawz-dev-uploads',
  ];
}

function stripPresignQuery(raw) {
  if (!raw.includes('X-Amz-Algorithm=') && !raw.includes('X-Amz-Credential=')) {
    return raw;
  }
  try {
    const u = new URL(raw);
    u.search = '';
    return u.toString();
  } catch {
    return raw.split('?')[0] ?? raw;
  }
}

function extractProductS3Key(value, vendorId) {
  if (value == null) return null;
  let raw = String(value).trim();
  if (!raw) return null;
  raw = stripPresignQuery(raw);

  const isKeyForVendor = (key) => {
    if (!key.startsWith(PRODUCT_S3_PREFIX)) return false;
    if (!vendorId) return true;
    return key.startsWith(`${PRODUCT_S3_PREFIX}${vendorId}/`);
  };

  if (raw.startsWith(PRODUCT_S3_PREFIX)) {
    return isKeyForVendor(raw) ? raw : null;
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const match = u.hostname.match(/^([^.]+)\.s3[./]/);
      if (match) {
        const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
        if (isKeyForVendor(key)) return key;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeImagesArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const o = item;
          return String(o.url ?? o.src ?? o.image_url ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeImagesArray(parsed);
      if (parsed && typeof parsed === 'object') return normalizeImagesArray([parsed]);
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

function parseJsonColumn(value) {
  if (value == null || value === '' || value === 'null') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function collectImageStringsFromJson(node, out) {
  if (node == null) return;
  if (typeof node === 'string') {
    if (
      node.includes('products/') ||
      (node.includes('.amazonaws.com/') && node.includes('/products/'))
    ) {
      out.push(node);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectImageStringsFromJson(item, out);
    return;
  }
  if (typeof node === 'object') {
    for (const value of Object.values(node)) collectImageStringsFromJson(value, out);
  }
}

async function dataQuery(sql, columnNames) {
  const { clusterArn, secretArn } = await getClusterInfo();
  const result = await rdsData.send(
    new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn,
      database: DATABASE_NAME,
      sql,
    }),
  );
  return parseRecords(result, columnNames);
}

async function loadReferencedKeys() {
  const referenced = new Set();

  const productsRes = await dataQuery(
    `SELECT vendor_id::text AS vendor_id, images::text AS images, metadata::text AS metadata FROM products`,
    ['vendor_id', 'images', 'metadata'],
  );
  for (const row of productsRes) {
    const vendorId = String(row.vendor_id || '');
    for (const url of normalizeImagesArray(parseJsonColumn(row.images))) {
      const key = extractProductS3Key(url, vendorId);
      if (key) referenced.add(key);
    }
    const metadata = parseJsonColumn(row.metadata);
    if (metadata) {
      const strings = [];
      collectImageStringsFromJson(metadata, strings);
      for (const url of strings) {
        const key = extractProductS3Key(url, vendorId);
        if (key) referenced.add(key);
      }
    }
  }

  const skusRes = await dataQuery(
    `SELECT vendor_id::text AS vendor_id, images::text AS images FROM product_skus`,
    ['vendor_id', 'images'],
  );
  for (const row of skusRes) {
    const vendorId = String(row.vendor_id || '');
    for (const url of normalizeImagesArray(parseJsonColumn(row.images))) {
      const key = extractProductS3Key(url, vendorId);
      if (key) referenced.add(key);
    }
  }

  return referenced;
}

async function listManagedProductKeys(s3, bucket) {
  const keys = [];
  let continuationToken;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: PRODUCT_S3_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of res.Contents || []) {
      if (obj.Key && MANAGED_KEY_RE.test(obj.Key)) {
        if (!vendorFilter || obj.Key.startsWith(`${PRODUCT_S3_PREFIX}${vendorFilter}/`)) {
          keys.push(obj.Key);
        }
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function main() {
  const buckets = getUploadsBuckets();
  console.log('Product image orphan sweeper');
  console.log('============================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Bucket(s):   ${buckets.join(', ')}`);
  console.log(`Mode:        ${EXECUTE ? 'EXECUTE (delete)' : 'DRY-RUN'}`);
  if (vendorFilter) console.log(`Vendor:      ${vendorFilter}`);
  console.log('');

  const referenced = await loadReferencedKeys();
  console.log(`Referenced managed keys in DB: ${referenced.size}`);

  const s3 = new S3Client({ region: REGION });
  const s3Keys = [];
  for (const bucket of buckets) {
    const keys = await listManagedProductKeys(s3, bucket);
    console.log(`Managed keys in ${bucket}: ${keys.length}`);
    for (const key of keys) {
      s3Keys.push({ bucket, key });
    }
  }
  console.log(`Total managed keys in S3: ${s3Keys.length}`);

  const orphans = s3Keys.filter(({ key }) => !referenced.has(key));
  console.log(`Orphan candidates: ${orphans.length}`);
  console.log('');

  if (orphans.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  for (const { bucket, key } of orphans.slice(0, 50)) {
    console.log(`  s3://${bucket}/${key}`);
  }
  if (orphans.length > 50) {
    console.log(`  ... and ${orphans.length - 50} more`);
  }
  console.log('');

  if (!EXECUTE) {
    console.log('Dry-run only. Re-run with --execute to delete these objects.');
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const { bucket, key } of orphans) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      deleted += 1;
    } catch (err) {
      failed += 1;
      console.warn(`Failed to delete s3://${bucket}/${key}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Deleted: ${deleted}, failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
