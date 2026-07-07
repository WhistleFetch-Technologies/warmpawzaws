#!/usr/bin/env node
/**
 * Backfill: mirror external product image URLs (e.g. Google Drive links from
 * an earlier bulk upload) onto our own S3 bucket for products/SKUs that
 * already exist in the database, compressing each image on the way in.
 *
 * Why this is needed: bulk-uploading a corrected template only fixes rows
 * going forward. Products created by an EARLIER upload (or edited by a
 * vendor) may still have `products.images` / `product_skus.images` pointing
 * straight at a third-party host. This script finds those rows, downloads
 * each external image once, compresses it, uploads it to our S3 bucket, and
 * rewrites the DB row to reference the new S3 URL — nothing else changes.
 * Already-managed S3 URLs are left untouched (no re-download, no orphan).
 *
 * Requires network access to the RDS cluster on port 5432 (this could not be
 * verified from the current sandbox — its outbound port 5432 is blocked even
 * though the AWS-side security group already allows public access) and to
 * AWS Secrets Manager / S3 via the AWS CLI credentials in your environment.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/backfill-product-images-to-s3.js            # dry run (default)
 *   ENVIRONMENT=dev node scripts/backfill-product-images-to-s3.js --apply    # actually rewrite rows
 *   ENVIRONMENT=dev node scripts/backfill-product-images-to-s3.js --apply --vendor-id=<uuid>
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');

// Pure-JS image decode/resize/encode — reuses the same dependency already
// added to backend/lambda for the equivalent runtime ingestion pipeline
// (backend/lambda/src/utils/product-image-ingest.ts). Loaded from there
// directly so this standalone script doesn't need its own copy/dependency.
const { Jimp, JimpMime } = require(
  path.join(__dirname, '..', 'backend', 'lambda', 'node_modules', 'jimp'),
);

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const APPLY = process.argv.includes('--apply');
const VENDOR_FILTER = (process.argv.find((a) => a.startsWith('--vendor-id=')) || '').split('=')[1] || null;

const PRODUCT_S3_PREFIX = 'products/';
const BUCKET = process.env.S3_UPLOADS_BUCKET || `warmpawz-${ENVIRONMENT}-user-uploads-057442119249`;
const TARGET_MAX_BYTES = 500 * 1024;
const TARGET_MAX_EDGE_PX = 1600;
const JPEG_START_QUALITY = 85;
const JPEG_MIN_QUALITY = 40;
const JPEG_QUALITY_STEP = 10;

const s3Client = new S3Client({ region: REGION });

function isKeyForVendor(key, vendorId) {
  if (!key.startsWith(PRODUCT_S3_PREFIX)) return false;
  if (!vendorId) return true;
  return key.startsWith(`${PRODUCT_S3_PREFIX}${vendorId}/`);
}

function extractS3Key(value, vendorId) {
  if (value == null) return null;
  let raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes('X-Amz-Algorithm=') || raw.includes('X-Amz-Credential=')) {
    try {
      const u = new URL(raw);
      u.search = '';
      raw = u.toString();
    } catch {
      raw = raw.split('?')[0] || raw;
    }
  }
  if (raw.startsWith(PRODUCT_S3_PREFIX)) {
    return isKeyForVendor(raw, vendorId) ? raw : null;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const match = u.hostname.match(/^([^.]+)\.s3[./]/);
      if (match) {
        const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
        if (isKeyForVendor(key, vendorId)) return key;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function isManaged(value, vendorId) {
  return extractS3Key(value, vendorId) != null;
}

function normalizeImages(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.url ?? item.src ?? item.image_url ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeImages(parsed);
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

function fetchBinary(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft < 0) return reject(new Error(`Too many redirects: ${url}`));
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`Invalid URL: ${url}`));
    }
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.get(
      url,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WarmpawzImageBackfill/1.0)', Accept: 'image/*,*/*;q=0.8' },
        timeout: 20000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(fetchBinary(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          reject(new Error(`Fetch failed (${res.statusCode}) for ${url}`));
          return;
        }
        const chunks = [];
        let total = 0;
        res.on('data', (c) => {
          total += c.length;
          if (total > 15 * 1024 * 1024) {
            req.destroy();
            reject(new Error(`Image too large: ${url}`));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function compressToJpeg(buffer) {
  const image = await Jimp.fromBuffer(buffer);
  const longestEdge = Math.max(image.bitmap.width, image.bitmap.height);
  if (longestEdge > TARGET_MAX_EDGE_PX) {
    image.scaleToFit({ w: TARGET_MAX_EDGE_PX, h: TARGET_MAX_EDGE_PX });
  }
  let quality = JPEG_START_QUALITY;
  let out = await image.getBuffer(JimpMime.jpeg, { quality });
  while (out.length > TARGET_MAX_BYTES && quality > JPEG_MIN_QUALITY) {
    quality -= JPEG_QUALITY_STEP;
    out = await image.getBuffer(JimpMime.jpeg, { quality });
  }
  return out;
}

async function uploadToS3(vendorId, buffer) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const key = `${PRODUCT_S3_PREFIX}${vendorId}/${timestamp}_${randomStr}.jpg`;
  await s3Client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: 'image/jpeg' }),
  );
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/** Ingest every external URL in `urls`; managed URLs pass through untouched. */
async function ingestList(vendorId, urls, stats) {
  const out = [];
  for (const url of urls) {
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (isManaged(url, null)) {
      out.push(url);
      continue;
    }
    stats.externalFound++;
    try {
      const raw = await fetchBinary(url);
      const compressed = await compressToJpeg(raw);
      if (APPLY) {
        const hosted = await uploadToS3(vendorId, compressed);
        out.push(hosted);
      } else {
        out.push(url); // dry run: keep original, just count what would change
      }
      stats.externalIngested++;
    } catch (e) {
      stats.externalFailed++;
      console.warn(`   ! failed to ingest ${url}: ${e.message}`);
      out.push(url); // never drop an image on failure
    }
  }
  return out;
}

async function connectPool() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`, {
      encoding: 'utf8',
    }),
  );
  const cluster = clusterInfo.DBClusters[0];
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }
  const port = cluster.Port || 5432;
  const dbName = cluster.DatabaseName || 'warmpawz';
  const username = cluster.MasterUsername || 'warmpawz_admin';

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;

  const pool = new Pool({
    host: endpoint,
    port: Number(port),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    max: 2,
  });
  await pool.query('SELECT 1');
  return pool;
}

async function main() {
  console.log('🖼️  Product image S3 backfill');
  console.log('================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Mode: ${APPLY ? 'APPLY (will write to DB + S3)' : 'DRY RUN (no writes)'}`);
  if (VENDOR_FILTER) console.log(`Vendor filter: ${VENDOR_FILTER}`);
  console.log('');

  const pool = await connectPool();
  const stats = { productsScanned: 0, productsUpdated: 0, skusScanned: 0, skusUpdated: 0, externalFound: 0, externalIngested: 0, externalFailed: 0 };

  try {
    const productRows = await pool.query(
      VENDOR_FILTER
        ? `SELECT id, vendor_id, images FROM products WHERE images IS NOT NULL AND jsonb_array_length(images) > 0 AND vendor_id = $1`
        : `SELECT id, vendor_id, images FROM products WHERE images IS NOT NULL AND jsonb_array_length(images) > 0`,
      VENDOR_FILTER ? [VENDOR_FILTER] : [],
    );

    for (const row of productRows.rows) {
      stats.productsScanned++;
      const before = normalizeImages(row.images);
      const hasExternal = before.some((u) => /^https?:\/\//i.test(u) && !isManaged(u, null));
      if (!hasExternal) continue;

      console.log(`Product ${row.id} (vendor ${row.vendor_id}): ${before.length} image(s), backfilling…`);
      const after = await ingestList(row.vendor_id, before, stats);
      if (APPLY) {
        await pool.query('UPDATE products SET images = $1::jsonb, updated_at = NOW() WHERE id = $2', [
          JSON.stringify(after),
          row.id,
        ]);
      }
      stats.productsUpdated++;
    }

    const skuRows = await pool.query(
      VENDOR_FILTER
        ? `SELECT id, vendor_id, images FROM product_skus WHERE images IS NOT NULL AND jsonb_array_length(images) > 0 AND vendor_id = $1`
        : `SELECT id, vendor_id, images FROM product_skus WHERE images IS NOT NULL AND jsonb_array_length(images) > 0`,
      VENDOR_FILTER ? [VENDOR_FILTER] : [],
    );

    for (const row of skuRows.rows) {
      stats.skusScanned++;
      const before = normalizeImages(row.images);
      const hasExternal = before.some((u) => /^https?:\/\//i.test(u) && !isManaged(u, null));
      if (!hasExternal) continue;

      console.log(`SKU ${row.id} (vendor ${row.vendor_id}): ${before.length} image(s), backfilling…`);
      const after = await ingestList(row.vendor_id, before, stats);
      if (APPLY) {
        await pool.query('UPDATE product_skus SET images = $1::jsonb, updated_at = NOW() WHERE id = $2', [
          JSON.stringify(after),
          row.id,
        ]);
      }
      stats.skusUpdated++;
    }
  } finally {
    await pool.end();
  }

  console.log('');
  console.log('Summary');
  console.log('-------');
  console.log(`Products scanned: ${stats.productsScanned}, with external images: ${stats.productsUpdated}`);
  console.log(`SKUs scanned:     ${stats.skusScanned}, with external images: ${stats.skusUpdated}`);
  console.log(`External images found: ${stats.externalFound}, ingested: ${stats.externalIngested}, failed: ${stats.externalFailed}`);
  if (!APPLY) {
    console.log('');
    console.log('This was a DRY RUN — re-run with --apply to actually upload to S3 and update the database.');
  }
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
