#!/usr/bin/env node
/**
 * Performance RCA master triage — read-only.
 * RDS schema + null/orphan taxonomy, Lambda endpoint hits (CloudWatch), S3 PNG/storage.
 *
 * Usage:
 *   node scripts/rca-performance-master.js
 *   ENVIRONMENT=prod node scripts/rca-performance-master.js
 *   HOURS=24 node scripts/rca-performance-master.js
 *
 * Output: scripts/_rca-performance-master-output.json
 */

const fs = require('fs');
const path = require('path');
const {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  DescribeLogGroupsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');
const {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetBucketLocationCommand,
} = require('@aws-sdk/client-s3');
const { query, getClusterInfo } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const HOURS = Number(process.env.HOURS || 24);
const OUT_FILE = path.join(__dirname, `_rca-performance-master-${ENVIRONMENT}.json`);

const PERF_ENDPOINT_PATTERNS = [
  { id: 'home_banners', label: 'Home banners', match: /\/customer\/banners/i },
  { id: 'home_service_launch', label: 'Service launch config', match: /\/config\/service-launch\/customer/i },
  { id: 'home_articles', label: 'Home articles', match: /\/customer\/articles/i },
  { id: 'home_adoption_stats', label: 'Adoption stats', match: /\/customer\/adoption-stats/i },
  { id: 'home_ecommerce_categories', label: 'Shop categories', match: /\/ecommerce\/categories/i },
  { id: 'home_featured_products', label: 'Featured products', match: /\/products\?.*featured/i },
  { id: 'service_catalog_categories', label: 'Service catalog categories', match: /\/service-catalog\/categories/i },
  { id: 'service_catalog_role', label: 'Service catalog by role', match: /\/service-catalog\/role\//i },
  { id: 'discover_services', label: 'Discover services', match: /\/customer\/discover-services/i },
  { id: 'services_by_style', label: 'Services by style', match: /\/customer\/services\/by-style/i },
  { id: 'customer_services', label: 'Customer services list', match: /\/customer\/services(\?|$)/i },
  { id: 'problem_grid', label: 'Problem grid (specialization)', match: /\/public\/problem-grid/i },
  { id: 'search', label: 'Universal search', match: /\/search(\?|$)/i },
  { id: 'vendor_search', label: 'Vendor search', match: /\/customer\/vendors\/search/i },
  { id: 'storage_refresh', label: 'S3 presign refresh (PNG rerender)', match: /\/storage\/refresh-url/i },
  { id: 'customer_bookings_active', label: 'Active bookings poll', match: /\/customer\/bookings\?.*status=/i },
  { id: 'customer_notifications', label: 'Notifications poll', match: /\/customer\/.*\/notifications/i },
  { id: 'customer_profile', label: 'Customer profile', match: /\/customer\/profile/i },
  { id: 'customer_pets', label: 'Customer pets', match: /\/customer\/pets\//i },
];

const FRONTEND_BUCKETS = {
  dev: {
    customer: 'warmpawz-dev-customer-frontend-ap-south-1',
    vendor: 'warmpawz-dev-vendor-frontend-ap-south-1',
    admin: 'warmpawz-dev-admin-frontend-ap-south-1',
  },
  prod: {
    customer: 'warmpawz-prod-customer-frontend-ap-south-1',
    vendor: 'warmpawz-prod-vendor-frontend-ap-south-1',
    admin: 'warmpawz-prod-admin-frontend-ap-south-1',
  },
};

const UPLOAD_BUCKETS = {
  dev: ['warmpawz-dev-uploads', 'warmpawz-uploads', 'warmpawz-media', 'warmpawz-documents'],
  prod: ['warmpawz-prod-uploads', 'warmpawz-uploads', 'warmpawz-media', 'warmpawz-documents'],
};

function quiet(fn) {
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  return fn().finally(() => {
    console.log = origLog;
    console.error = origErr;
  });
}

async function runSql(label, sql) {
  try {
    const rows = await quiet(() => query(sql));
    return { ok: true, label, rows, count: rows.length };
  } catch (err) {
    return { ok: false, label, error: err.message || String(err) };
  }
}

async function auditRds() {
  const sections = {};

  sections.meta = await runSql('cluster', `SELECT current_database() AS db, current_user AS usr, NOW() AS ts`);

  sections.tableInventory = await runSql(
    'table_inventory',
    `
    SELECT
      c.relname AS table_name,
      COALESCE(c.reltuples::bigint, 0) AS est_rows,
      pg_total_relation_size(c.oid) AS total_bytes,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 200
    `
  );

  sections.columnInventory = await runSql(
    'column_inventory',
    `
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
    `
  );

  sections.highNullColumns = await runSql(
    'high_null_columns',
    `
    SELECT
      schemaname,
      tablename,
      attname AS column_name,
      ROUND(null_frac::numeric, 4) AS null_frac,
      n_distinct,
      avg_width,
      (SELECT reltuples::bigint FROM pg_class WHERE relname = tablename) AS est_rows
    FROM pg_stats
    WHERE schemaname = 'public'
      AND null_frac >= 0.80
      AND (SELECT reltuples FROM pg_class WHERE relname = tablename) > 10
    ORDER BY null_frac DESC, tablename, attname
    LIMIT 150
    `
  );

  sections.recentSparseColumns = await runSql(
    'recent_sparse_columns',
    `
    WITH cols AS (
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND is_nullable = 'YES'
    )
    SELECT c.table_name, c.column_name, c.data_type,
           s.null_frac, s.n_distinct,
           pg.reltuples::bigint AS est_rows
    FROM cols c
    JOIN pg_stats s ON s.schemaname = 'public' AND s.tablename = c.table_name AND s.attname = c.column_name
    JOIN pg_class pg ON pg.relname = c.table_name
    WHERE s.null_frac >= 0.95 AND pg.reltuples > 50
    ORDER BY s.null_frac DESC, pg.reltuples DESC
    LIMIT 100
    `
  );

  sections.orphanServiceCatalog = await runSql(
    'orphan_service_catalog',
    `
    SELECT sc.service_id, sc.service_name, sc.category_id, sc.sub_category_id, sc.status, sc.publish_status
    FROM service_catalog sc
    WHERE sc.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM vendor_services vs
        WHERE vs.service_id::text = sc.id::text
           OR vs.service_name ILIKE sc.service_name
      )
    ORDER BY sc.category_id NULLS FIRST, sc.service_name
    LIMIT 100
    `
  );

  sections.orphanSpecializations = await runSql(
    'orphan_specializations',
    `
    SELECT sm.specialization_id, sm.name, sm.category_id, sm.is_active, sm.show_in_problem_grid
    FROM specialization_master sm
    WHERE sm.is_active = true
      AND NOT EXISTS (SELECT 1 FROM vendor_specializations vs WHERE vs.specialization = sm.specialization_id)
      AND NOT EXISTS (SELECT 1 FROM problem_grid_mappings pgm WHERE pgm.problem_id = sm.specialization_id)
    ORDER BY sm.category_id, sm.name
    LIMIT 100
    `
  );

  sections.orphanProblemGridMappings = await runSql(
    'orphan_problem_grid_mappings',
    `
    SELECT pgm.problem_id, pgm.problem_name, pgm.role_id, pgm.sub_category_id
    FROM problem_grid_mappings pgm
    WHERE NOT EXISTS (SELECT 1 FROM specialization_master sm WHERE sm.specialization_id = pgm.problem_id)
    ORDER BY pgm.role_id, pgm.problem_id
    LIMIT 100
    `
  );

  sections.orphanServiceCategories = await runSql(
    'orphan_service_categories',
    `
    SELECT DISTINCT sc.category_id, COUNT(*) AS catalog_count
    FROM service_catalog sc
    WHERE sc.category_id IS NOT NULL AND sc.category_id <> ''
      AND NOT EXISTS (
        SELECT 1 FROM service_categories cat
        WHERE LOWER(cat.name) = LOWER(sc.category_id)
           OR cat.id::text = sc.category_id
      )
    GROUP BY sc.category_id
    ORDER BY catalog_count DESC
    LIMIT 50
    `
  );

  sections.orphanVendorSpecializations = await runSql(
    'orphan_vendor_specializations',
    `
    SELECT vs.specialization, COUNT(*) AS vendor_count
    FROM vendor_specializations vs
    WHERE NOT EXISTS (
      SELECT 1 FROM specialization_master sm WHERE sm.specialization_id = vs.specialization
    )
    AND NOT EXISTS (
      SELECT 1 FROM problem_grid_mappings pgm WHERE pgm.problem_id = vs.specialization
    )
    GROUP BY vs.specialization
    ORDER BY vendor_count DESC
    LIMIT 50
    `
  );

  sections.taxonomyCounts = await runSql(
    'taxonomy_counts',
    `
    SELECT 'service_catalog' AS entity, COUNT(*)::bigint AS cnt FROM service_catalog
    UNION ALL SELECT 'service_categories', COUNT(*)::bigint FROM service_categories
    UNION ALL SELECT 'specialization_master', COUNT(*)::bigint FROM specialization_master
    UNION ALL SELECT 'problem_grid_mappings', COUNT(*)::bigint FROM problem_grid_mappings
    UNION ALL SELECT 'vendor_specializations', COUNT(*)::bigint FROM vendor_specializations
    UNION ALL SELECT 'vendor_services', COUNT(*)::bigint FROM vendor_services
    UNION ALL SELECT 'vendors', COUNT(*)::bigint FROM vendors
    UNION ALL SELECT 'roles', COUNT(*)::bigint FROM roles
    `
  );

  sections.unusedJsonbMetadataKeys = await runSql(
    'service_catalog_metadata_keys',
    `
    SELECT key, COUNT(*) AS rows_with_key
    FROM service_catalog sc,
         LATERAL jsonb_object_keys(COALESCE(sc.metadata, '{}'::jsonb)) AS key
    GROUP BY key
    ORDER BY rows_with_key DESC
    LIMIT 30
    `
  );

  return sections;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findLambdaLogGroup() {
  const client = new CloudWatchLogsClient({ region: REGION });
  const prefix = `/aws/lambda/warmpawz-${ENVIRONMENT}-api-handler`;
  try {
    const out = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: prefix, limit: 5 })
    );
    const groups = (out.logGroups || []).map((g) => g.logGroupName);
    if (groups.length) return groups[0];
  } catch (_) {
    /* fall through */
  }
  return prefix;
}

async function runLogsInsights(logGroupName) {
  const client = new CloudWatchLogsClient({ region: REGION });
  const endTime = Date.now();
  const startTime = endTime - HOURS * 3600 * 1000;

  const queries = [
    {
      id: 'endpoint_hits',
      query: `
        fields @timestamp, @message
        | filter @message like /GET |POST |PUT |DELETE |PATCH /
        | parse @message /(?<method>GET|POST|PUT|DELETE|PATCH)\\s+(?<path>\\/[^\\s?"']+)/
        | filter ispresent(path)
        | stats count() as hits by path
        | sort hits desc
        | limit 80
      `,
    },
    {
      id: 'perf_flow_hits',
      query: `
        fields @timestamp, @message
        | filter @message like /discover-services|service-catalog|problem-grid|by-style|refresh-url|customer\\/banners|service-launch|\\/search/
        | stats count() as hits by @message
        | sort hits desc
        | limit 60
      `,
    },
    {
      id: 'errors_by_path',
      query: `
        fields @timestamp, @message
        | filter @message like /Error|ERROR|500|ReferenceError|timeout/i
        | filter @message like /discover-services|service-catalog|problem-grid|search|banners|refresh-url/
        | stats count() as errors by @message
        | sort errors desc
        | limit 30
      `,
    },
  ];

  const results = {};
  for (const q of queries) {
    try {
      const start = await client.send(
        new StartQueryCommand({
          logGroupName,
          startTime: Math.floor(startTime / 1000),
          endTime: Math.floor(endTime / 1000),
          queryString: q.query,
        })
      );
      const queryId = start.queryId;
      let status = 'Running';
      let rows = [];
      for (let i = 0; i < 60; i++) {
        await sleep(2000);
        const res = await client.send(new GetQueryResultsCommand({ queryId }));
        status = res.status;
        if (status === 'Complete' || status === 'Failed' || status === 'Cancelled') {
          rows = (res.results || []).map((r) => {
            const obj = {};
            for (const f of r) obj[f.field] = f.value;
            return obj;
          });
          break;
        }
      }
      results[q.id] = { status, rows, windowHours: HOURS };
    } catch (err) {
      results[q.id] = { status: 'Error', error: err.message || String(err) };
    }
  }

  // Bucket raw paths into perf flows
  const endpointRows = results.endpoint_hits?.rows || [];
  const flowSummary = PERF_ENDPOINT_PATTERNS.map((p) => {
    let hits = 0;
    const matchedPaths = [];
    for (const row of endpointRows) {
      const pth = row.path || '';
      if (p.match.test(pth)) {
        hits += Number(row.hits || 0);
        matchedPaths.push({ path: pth, hits: Number(row.hits || 0) });
      }
    }
    matchedPaths.sort((a, b) => b.hits - a.hits);
    return { ...p, hits, topPaths: matchedPaths.slice(0, 5) };
  }).sort((a, b) => b.hits - a.hits);

  return { logGroupName, windowHours: HOURS, queries: results, flowSummary };
}

async function bucketExists(s3, name) {
  try {
    await s3.send(new GetBucketLocationCommand({ Bucket: name }));
    return true;
  } catch {
    return false;
  }
}

async function scanBucketPrefix(s3, bucket, prefix, maxKeys = 5000) {
  let continuationToken;
  let scanned = 0;
  let totalBytes = 0;
  let pngCount = 0;
  let pngBytes = 0;
  let jpgCount = 0;
  let webpCount = 0;
  let otherCount = 0;
  const largePngs = [];
  const topPrefixes = {};

  while (scanned < maxKeys) {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: Math.min(1000, maxKeys - scanned),
      })
    );
    for (const obj of out.Contents || []) {
      scanned += 1;
      const key = obj.Key || '';
      const size = obj.Size || 0;
      totalBytes += size;
      const ext = key.split('.').pop()?.toLowerCase() || '';
      const top = key.split('/').slice(0, 2).join('/') || '(root)';
      topPrefixes[top] = (topPrefixes[top] || 0) + size;

      if (ext === 'png') {
        pngCount += 1;
        pngBytes += size;
        if (size > 200 * 1024) {
          largePngs.push({ key, sizeBytes: size, sizeKb: Math.round(size / 1024) });
        }
      } else if (ext === 'jpg' || ext === 'jpeg') {
        jpgCount += 1;
      } else if (ext === 'webp') {
        webpCount += 1;
      } else {
        otherCount += 1;
      }
    }
    if (!out.IsTruncated) break;
    continuationToken = out.NextContinuationToken;
  }

  largePngs.sort((a, b) => b.sizeBytes - a.sizeBytes);
  const prefixBreakdown = Object.entries(topPrefixes)
    .map(([p, bytes]) => ({ prefix: p, bytes, mb: Math.round((bytes / 1024 / 1024) * 10) / 10 }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15);

  return {
    bucket,
    prefix: prefix || '(all)',
    scannedObjects: scanned,
    truncated: scanned >= maxKeys,
    totalBytes,
    totalMb: Math.round((totalBytes / 1024 / 1024) * 10) / 10,
    pngCount,
    pngBytes,
    pngMb: Math.round((pngBytes / 1024 / 1024) * 10) / 10,
    jpgCount,
    webpCount,
    otherCount,
    pngSharePct: totalBytes ? Math.round((pngBytes / totalBytes) * 1000) / 10 : 0,
    largePngs: largePngs.slice(0, 20),
    prefixBreakdown,
  };
}

async function auditS3() {
  const s3 = new S3Client({ region: REGION });
  const report = { bucketsFound: [], frontend: {}, uploads: {}, errors: [] };

  const uploadCandidates = [...(UPLOAD_BUCKETS[ENVIRONMENT] || UPLOAD_BUCKETS.dev)];

  try {
    const all = await s3.send(new ListBucketsCommand({}));
    report.allWarmpawzBuckets = (all.Buckets || [])
      .map((b) => b.Name)
      .filter((n) => /warmpawz/i.test(n))
      .sort();
    const uploadFromList = report.allWarmpawzBuckets.filter(
      (n) => /upload|media|document|static/i.test(n) && !/frontend|logs|backup/i.test(n)
    );
    for (const b of uploadFromList) {
      if (!uploadCandidates.includes(b)) uploadCandidates.push(b);
    }
  } catch (err) {
    report.errors.push({ section: 'list_buckets', error: err.message });
  }

  const fe = FRONTEND_BUCKETS[ENVIRONMENT] || FRONTEND_BUCKETS.dev;
  for (const [app, bucket] of Object.entries(fe)) {
    if (!(await bucketExists(s3, bucket))) {
      report.frontend[app] = { bucket, exists: false };
      continue;
    }
    report.frontend[app] = {
      exists: true,
      ...(await scanBucketPrefix(s3, bucket, '', 3000)),
    };
  }

  for (const bucket of uploadCandidates) {
    if (!(await bucketExists(s3, bucket))) continue;
    report.uploads[bucket] = await scanBucketPrefix(s3, bucket, '', 5000);
    report.bucketsFound.push(bucket);
  }

  // Focus prefixes likely tied to listing photos / banners
  const primaryUpload = report.bucketsFound[0];
  if (primaryUpload) {
    for (const prefix of ['banners/', 'vendors/', 'products/', 'ecommerce/', 'facility/', 'profiles/']) {
      try {
        report.uploads[`${primaryUpload}:${prefix}`] = await scanBucketPrefix(s3, primaryUpload, prefix, 2000);
      } catch (err) {
        report.errors.push({ section: `prefix_${prefix}`, error: err.message });
      }
    }
  }

  return report;
}

function codeIntel() {
  return {
    customerHomeApiCalls: [
      'GET /customer/banners (×3 slots: top/middle/lower)',
      'GET /config/service-launch/customer',
      'GET /customer/articles?limit=3&featured=true',
      'GET /customer/announcements?limit=3',
      'GET /customer/adoption-stats',
      'GET /ecommerce/categories',
      'GET /products?featured=true&limit=3',
      'GET /customer/bookings?status=in_progress,vendor_on_way',
      'GET /customer/notifications',
      'GET /customer/by-phone',
      'GET /reviews/pending/:customerId',
    ],
    serviceSelectionApiCalls: [
      'GET /service-catalog/categories',
      'GET /service-catalog/role/:roleId',
      'GET /customer/services?roleId=',
      'GET /customer/discover-services',
      'GET /customer/services/by-style',
      'GET /customer/vendors/search',
      'GET /search?q=',
    ],
    specializationSelectionApiCalls: [
      'GET /public/problem-grid',
      'GET /public/problem-grid/:roleId',
      'GET /customer/vendors/discover-by-problem',
    ],
    pngRerenderRisk: {
      component: 'apps/customer-web/components/shared/PresignableImage.tsx',
      behavior: 'On img onError for amazonaws.com URLs → GET /storage/refresh-url (extra Lambda + S3 head/get)',
      triggers: ['Expired presigned URL', 'src prop change resets state → re-fetch', 'Home profile/pet/banner images'],
    },
  };
}

async function main() {
  console.log(`\n🔍 Performance RCA master triage (${ENVIRONMENT}, last ${HOURS}h)\n`);

  const output = {
    generatedAt: new Date().toISOString(),
    environment: ENVIRONMENT,
    region: REGION,
    windowHours: HOURS,
    codeIntel: codeIntel(),
    rds: { ok: false },
    lambda: { ok: false },
    s3: { ok: false },
    errors: [],
  };

  try {
    await getClusterInfo();
    output.rds = { ok: true, ...(await auditRds()) };
    console.log('✅ RDS audit complete');
  } catch (err) {
    output.rds = { ok: false, error: err.message || String(err) };
    output.errors.push({ section: 'rds', error: err.message });
    console.error('❌ RDS audit failed:', err.message);
  }

  try {
    const logGroup = await findLambdaLogGroup();
    output.lambda = { ok: true, ...(await runLogsInsights(logGroup)) };
    console.log('✅ Lambda CloudWatch audit complete');
  } catch (err) {
    output.lambda = { ok: false, error: err.message || String(err) };
    output.errors.push({ section: 'lambda', error: err.message });
    console.error('❌ Lambda audit failed:', err.message);
  }

  try {
    output.s3 = { ok: true, ...(await auditS3()) };
    console.log('✅ S3 audit complete');
  } catch (err) {
    output.s3 = { ok: false, error: err.message || String(err) };
    output.errors.push({ section: 's3', error: err.message });
    console.error('❌ S3 audit failed:', err.message);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n📄 Report written: ${OUT_FILE}\n`);

  // Console summary
  if (output.rds.ok) {
    const tables = output.rds.tableInventory?.rows?.length || 0;
    const nulls = output.rds.highNullColumns?.rows?.length || 0;
    const orphans =
      (output.rds.orphanServiceCatalog?.rows?.length || 0) +
      (output.rds.orphanSpecializations?.rows?.length || 0);
    console.log(`RDS: ${tables} tables inventoried, ${nulls} high-null columns, ${orphans}+ orphan taxonomy rows sampled`);
  }
  if (output.lambda.ok) {
    console.log('Lambda top perf flows (24h):');
    for (const f of (output.lambda.flowSummary || []).slice(0, 8)) {
      if (f.hits > 0) console.log(`  ${f.label}: ${f.hits}`);
    }
  }
  if (output.s3.ok) {
    for (const [app, data] of Object.entries(output.s3.frontend || {})) {
      if (data.exists) console.log(`S3 frontend ${app}: ${data.totalMb}MB scanned (${data.pngCount} PNG)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
