#!/usr/bin/env node
/**
 * Import search taxonomy from business spreadsheet export (CSV).
 *
 * Spreadsheet columns only: Category, Subcategory, Keyword
 *
 * Usage:
 *   node scripts/import-search-taxonomy-spreadsheet.js
 *   node scripts/import-search-taxonomy-spreadsheet.js --file db/seed/search-taxonomy.csv
 *   ENVIRONMENT=dev node scripts/import-search-taxonomy-spreadsheet.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const {
  normalizePhrase,
  slugifyLabel,
  resolveTaxonomyRow,
} = require('./lib/search-taxonomy-import-rules');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DEFAULT_FILE = path.join(__dirname, '..', 'db', 'seed', 'search-taxonomy.csv');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const idx = {
    category: header.findIndex((h) => h === 'category' || h === 'categories'),
    subcategory: header.findIndex((h) => h === 'subcategory' || h === 'sub_category'),
    keyword: header.findIndex((h) => h === 'keyword' || h === 'keywords'),
  };
  if (idx.category < 0 || idx.keyword < 0) {
    throw new Error('CSV must have Category and Keyword columns');
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const category = cols[idx.category];
    const keyword = cols[idx.keyword];
    if (!category || !keyword) continue;
    const subcategory = idx.subcategory >= 0 ? cols[idx.subcategory] || null : null;
    rows.push({
      category_display_name: category.trim(),
      category_slug: slugifyLabel(category),
      subcategory: subcategory && subcategory.trim() ? subcategory.trim() : null,
      keyword: keyword.trim(),
      keyword_normalized: normalizePhrase(keyword),
    });
  }
  return rows;
}

async function getPool() {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.TARGET_DATABASE_URL;
  if (DATABASE_URL) {
    return new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('rds.') ? { rejectUnauthorized: false } : undefined,
    });
  }
  const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : 'warmpawz-dev-rds-master-20260106164510791100000002';
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;
  return new Pool({
    host: cluster.Endpoint,
    port: 5432,
    database: cluster.DatabaseName || 'warmpawz',
    user: cluster.MasterUsername || 'warmpawz_admin',
    password,
    ssl: { rejectUnauthorized: false },
  });
}

async function main() {
  const fileArg = process.argv.find((a, i) => process.argv[i - 1] === '--file');
  const filePath = fileArg || DEFAULT_FILE;
  if (!fs.existsSync(filePath)) {
    console.error(`Missing taxonomy file: ${filePath}`);
    console.error('Export spreadsheet to db/seed/search-taxonomy.csv (see db/seed/search-taxonomy.README.md)');
    process.exit(1);
  }

  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  if (!parsed.length) {
    console.error('No rows parsed from CSV');
    process.exit(1);
  }

  let unmapped = 0;
  for (const row of parsed) {
    const resolution = resolveTaxonomyRow({
      category: row.category_display_name,
      subcategory: row.subcategory,
      keyword: row.keyword,
    });
    if (resolution.status === 'unmapped') unmapped++;
  }
  if (unmapped > 0) {
    console.error(`${unmapped} unmapped keyword(s). Run validate script first:`);
    console.error('  node scripts/validate-search-taxonomy-spreadsheet.js');
    process.exit(1);
  }

  const pool = await getPool();
  let inserted = 0;
  let skipped = 0;

  try {
    for (const row of parsed) {
      const resolution = resolveTaxonomyRow({
        category: row.category_display_name,
        subcategory: row.subcategory,
        keyword: row.keyword,
      });
      if (resolution.status === 'skip') {
        skipped++;
        continue;
      }
      if (resolution.status !== 'ok') {
        skipped++;
        continue;
      }
      const hub_slug = resolution.hub;
      if (!row.keyword_normalized || row.keyword_normalized.length < 2) {
        skipped++;
        continue;
      }
      await pool.query(
        `INSERT INTO search_taxonomy_keywords (
           category_slug, category_display_name, subcategory, keyword, keyword_normalized,
           hub_slug, weight, is_active, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 100, true, NOW())
         ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
           category_slug = EXCLUDED.category_slug,
           category_display_name = EXCLUDED.category_display_name,
           subcategory = EXCLUDED.subcategory,
           keyword = EXCLUDED.keyword,
           is_active = true,
           updated_at = NOW()`,
        [
          row.category_slug,
          row.category_display_name,
          row.subcategory,
          row.keyword,
          row.keyword_normalized,
          hub_slug,
        ]
      );
      inserted++;
    }
    console.log(`Import complete: ${inserted} upserted, ${skipped} skipped`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
