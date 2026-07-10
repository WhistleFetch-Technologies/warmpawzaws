#!/usr/bin/env node
/**
 * Phase 3: backfill legacy image keys to WebP (run after migration 1067 + Lambda deploy).
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/backfill-image-webp.js --dry-run
 *   ENVIRONMENT=dev node scripts/backfill-image-webp.js --apply --limit=50
 *   ENVIRONMENT=prod node scripts/backfill-image-webp.js --use-rds-data-api --apply --vendor-id=<uuid> --limit=20
 */

const { Pool } = require('pg');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createHash } = require('crypto');
const { execSync } = require('child_process');
const path = require('path');

const sharp = require(path.join(__dirname, '..', 'backend', 'lambda', 'node_modules', 'sharp'));

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;
const USE_RDS_DATA_API = process.argv.includes('--use-rds-data-api');
const VENDOR_FILTER = (process.argv.find((a) => a.startsWith('--vendor-id=')) || '').split('=')[1] || null;
const limitArg = process.argv.find((a) => a.startsWith('--limit'));
const LIMIT = limitArg
  ? parseInt(limitArg.split('=')[1] || process.argv[process.argv.indexOf('--limit') + 1], 10)
  : 500;

const BUCKET = process.env.S3_UPLOADS_BUCKET || `warmpawz-${ENVIRONMENT}-user-uploads-057442119249`;
const s3Client = new S3Client({ region: REGION });

const stats = {
  scanned: 0,
  skippedWebp: 0,
  skippedExternal: 0,
  migrated: 0,
  failed: 0,
};

function isWebpKey(key) {
  return /\.webp$/i.test(String(key || '').trim());
}

function extractS3Key(value) {
  if (value == null) return null;
  let raw = String(value).trim();
  if (!raw || raw.startsWith('data:')) return null;
  if (raw.includes('X-Amz-Algorithm=')) {
    try {
      const u = new URL(raw);
      u.search = '';
      raw = u.toString();
    } catch {
      raw = raw.split('?')[0];
    }
  }
  if (!raw.includes('://')) return raw.replace(/^\/+/, '');
  try {
    const u = new URL(raw.split('?')[0]);
    const match = u.hostname.match(/^([^.]+)\.s3[./]/);
    if (match) return decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
  return null;
}

function buildWebpKey(assetType, ownerId, legacyKey) {
  const hash = createHash('sha256').update(legacyKey).digest('hex').slice(0, 8);
  const suffix = `${Date.now().toString(36)}${hash}`;
  const id = String(ownerId).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
  switch (assetType) {
    case 'profile':
      if (legacyKey.includes('media/vendor/') || legacyKey.includes('vendors/')) {
        return `media/vendor/${id}/profile_${suffix}.webp`;
      }
      return `media/customer/${id}/profile_${suffix}.webp`;
    case 'pet':
      return `media/pet/${id}/avatar_${suffix}.webp`;
    case 'product':
      return `products/${id}/${suffix}.webp`;
    case 'facility':
      return `media/vendor/${id}/facility/${suffix}.webp`;
    case 'banner':
      return `admin/banners/${id}_${suffix}.webp`;
    case 'staff':
      return `media/staff/${id}/${suffix}.webp`;
    default:
      return `media/misc/${id}/${suffix}.webp`;
  }
}

function thumbKey(displayKey) {
  return displayKey.endsWith('.webp')
    ? displayKey.replace(/\.webp$/, '.thumb.webp')
    : `${displayKey}.thumb.webp`;
}

async function encodeWebp(buffer, maxEdge, targetBytes) {
  let quality = 85;
  let out = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
  while (out.length > targetBytes * 1.1 && quality > 35) {
    quality -= 8;
    out = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();
  }
  return out;
}

async function migrateKey(assetType, ownerId, legacyValue) {
  const key = extractS3Key(legacyValue);
  if (!key) {
    stats.skippedExternal++;
    return null;
  }
  if (isWebpKey(key)) {
    stats.skippedWebp++;
    return null;
  }
  stats.scanned++;

  const displayKey = buildWebpKey(assetType, ownerId, key);
  const thumb = thumbKey(displayKey);

  if (DRY_RUN) {
    console.log(`[dry-run] ${assetType} ${key} -> ${displayKey}`);
    stats.migrated++;
    return displayKey;
  }

  try {
    const obj = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = await obj.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);
    const displayBuf = await encodeWebp(buffer, 2048, 250 * 1024);
    const thumbBuf = await encodeWebp(buffer, 400, 20 * 1024);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: displayKey,
        Body: displayBuf,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumb,
        Body: thumbBuf,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    stats.migrated++;
    return { displayKey, legacyKey: key };
  } catch (err) {
    stats.failed++;
    console.warn(`   ! migrate failed ${key}: ${err.message}`);
    return null;
  }
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
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const pool = new Pool({
    host: endpoint,
    port: Number(cluster.Port || 5432),
    database: cluster.DatabaseName || 'warmpawz',
    user: cluster.MasterUsername || 'warmpawz_admin',
    password: secret.password || secret.Password,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  await pool.query('SELECT 1');
  return pool;
}

function rowsFromRdsDataResult(result) {
  if (result.formattedRecords) {
    try {
      return JSON.parse(result.formattedRecords);
    } catch {
      /* fall through */
    }
  }
  const cols = (result.columnMetadata || []).map((c) => c.name);
  return (result.records || []).map((rec) => {
    const row = {};
    rec.forEach((field, i) => {
      const key = cols[i] || `col_${i}`;
      if (field == null || field.isNull) row[key] = null;
      else if (field.stringValue !== undefined) row[key] = field.stringValue;
      else if (field.longValue !== undefined) row[key] = field.longValue;
      else if (field.doubleValue !== undefined) row[key] = field.doubleValue;
      else if (field.booleanValue !== undefined) row[key] = field.booleanValue;
      else row[key] = null;
    });
    return row;
  });
}

async function connectRdsDataApi() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`, {
      encoding: 'utf8',
    }),
  );
  const cluster = clusterInfo.DBClusters[0];
  if (!cluster.HttpEndpointEnabled) {
    throw new Error(`RDS Data API not enabled on ${clusterId}`);
  }
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  return {
    client: new RDSDataClient({ region: REGION }),
    meta: {
      resourceArn: cluster.DBClusterArn,
      secretArn: secretValue.ARN,
      database: cluster.DatabaseName || 'warmpawz',
    },
  };
}

async function rdsDataQuery(db, sql, parameters = []) {
  const res = await db.client.send(
    new ExecuteStatementCommand({
      ...db.meta,
      sql,
      parameters,
      formatRecordsAs: 'JSON',
      includeResultMetadata: true,
    }),
  );
  return rowsFromRdsDataResult(res);
}

async function rdsDataExecute(db, sql, parameters = []) {
  await db.client.send(
    new ExecuteStatementCommand({
      ...db.meta,
      sql,
      parameters,
    }),
  );
}

async function logMigrationDb(db, legacyKey, webpKey) {
  if (DRY_RUN) return;
  if (db.type === 'pool') {
    await db.pool.query(
      `INSERT INTO image_migration_log (legacy_key, webp_key) VALUES ($1, $2) ON CONFLICT (legacy_key) DO NOTHING`,
      [legacyKey, webpKey],
    );
    return;
  }
  await rdsDataExecute(db.rds, `INSERT INTO image_migration_log (legacy_key, webp_key)
    VALUES (:legacy_key, :webp_key) ON CONFLICT (legacy_key) DO NOTHING`, [
    { name: 'legacy_key', value: { stringValue: legacyKey } },
    { name: 'webp_key', value: { stringValue: webpKey } },
  ]);
}

async function processScalarRows(db, table, column, idColumn, assetType, ownerColumn) {
  const vendorClause = VENDOR_FILTER && table === 'vendors' ? ` AND id = '${VENDOR_FILTER}'::uuid` : '';
  const sql = `SELECT ${idColumn}::text AS id, ${(ownerColumn || idColumn)}::text AS owner_id, ${column} AS val
     FROM ${table}
     WHERE ${column} IS NOT NULL AND TRIM(${column}) <> ''
     ${vendorClause}
     LIMIT ${LIMIT}`;

  const rows =
    db.type === 'pool'
      ? (await db.pool.query(sql.replace(`LIMIT ${LIMIT}`, 'LIMIT $1'), [LIMIT])).rows
      : await rdsDataQuery(db.rds, sql);

  for (const row of rows) {
    if (stats.migrated >= LIMIT) break;
    const result = await migrateKey(assetType, row.owner_id || row.id, row.val);
    if (!result || DRY_RUN) continue;
    if (db.type === 'pool') {
      await db.pool.query(
        `UPDATE ${table} SET ${column} = $2, updated_at = NOW() WHERE ${idColumn} = $1::uuid`,
        [row.id, result.displayKey],
      );
    } else {
      await rdsDataExecute(
        db.rds,
        `UPDATE ${table} SET ${column} = :val, updated_at = NOW() WHERE ${idColumn} = :id::uuid`,
        [
          { name: 'val', value: { stringValue: result.displayKey } },
          { name: 'id', value: { stringValue: String(row.id) } },
        ],
      );
    }
    await logMigrationDb(db, result.legacyKey, result.displayKey);
  }
}

async function processProductImages(db) {
  const vendorClause = VENDOR_FILTER ? ` AND vendor_id = '${VENDOR_FILTER}'::uuid` : '';
  const sql = `SELECT id::text AS id, vendor_id::text AS vendor_id, images::text AS images FROM products
     WHERE images IS NOT NULL AND jsonb_array_length(images) > 0
     ${vendorClause}
     LIMIT ${LIMIT}`;

  const rows =
    db.type === 'pool'
      ? (await db.pool.query(
          `SELECT id, vendor_id, images FROM products
           WHERE images IS NOT NULL AND jsonb_array_length(images) > 0
           ${vendorClause}
           LIMIT $1`,
          [LIMIT],
        )).rows
      : await rdsDataQuery(db.rds, sql);

  for (const row of rows) {
    if (stats.migrated >= LIMIT) break;
    let images = row.images;
    if (typeof images === 'string') {
      try {
        images = JSON.parse(images);
      } catch {
        images = [];
      }
    }
    if (!Array.isArray(images)) continue;
    let changed = false;
    const next = [];
    for (const item of images) {
      const raw = typeof item === 'string' ? item : item?.url || item?.src || '';
      const result = await migrateKey('product', row.vendor_id, raw);
      if (result && !DRY_RUN && result.displayKey) {
        next.push(result.displayKey);
        await logMigrationDb(db, result.legacyKey, result.displayKey);
        changed = true;
      } else if (result && DRY_RUN) {
        next.push(result);
        changed = true;
      } else {
        next.push(typeof item === 'string' ? item : raw);
      }
    }
    if (changed && !DRY_RUN) {
      const imagesJson = JSON.stringify(next);
      if (db.type === 'pool') {
        await db.pool.query(`UPDATE products SET images = $2::jsonb, updated_at = NOW() WHERE id = $1::uuid`, [
          row.id,
          imagesJson,
        ]);
      } else {
        await rdsDataExecute(db.rds, `UPDATE products SET images = :images::jsonb, updated_at = NOW() WHERE id = :id::uuid`, [
          { name: 'images', value: { stringValue: imagesJson } },
          { name: 'id', value: { stringValue: String(row.id) } },
        ]);
      }
    }
  }
}

async function main() {
  console.log(
    `[backfill-image-webp] env=${ENVIRONMENT} dryRun=${DRY_RUN} limit=${LIMIT} vendor=${VENDOR_FILTER || 'all'} rdsDataApi=${USE_RDS_DATA_API}`,
  );

  let db;
  if (USE_RDS_DATA_API) {
    db = { type: 'rds', rds: await connectRdsDataApi() };
  } else {
    db = { type: 'pool', pool: await connectPool() };
  }

  try {
    await processScalarRows(db, 'customers', 'profile_photo_url', 'id', 'profile', 'phone');
    await processScalarRows(db, 'pets', 'profile_photo_url', 'id', 'pet');
    await processScalarRows(db, 'vendors', 'profile_photo_url', 'id', 'profile');
    await processScalarRows(db, 'banners', 'image_url', 'id', 'banner');
    await processProductImages(db);
  } finally {
    if (db.type === 'pool') await db.pool.end();
  }

  console.log('\nSummary:', stats);
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
