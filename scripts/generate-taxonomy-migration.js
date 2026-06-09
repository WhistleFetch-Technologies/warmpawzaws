#!/usr/bin/env node
/**
 * Generates db/migrations/1030_seed_search_taxonomy_keywords.sql
 * from the validated db/seed/search-taxonomy.csv.
 * Run: node scripts/generate-taxonomy-migration.js
 */
const fs = require('fs');
const path = require('path');
const {
  normalizePhrase,
  slugifyLabel,
  resolveTaxonomyRow,
} = require('./lib/search-taxonomy-import-rules.js');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function esc(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

const csvPath = path.join(__dirname, '..', 'db', 'seed', 'search-taxonomy.csv');
const outPath = path.join(__dirname, '..', 'db', 'migrations', '1031_seed_search_taxonomy_keywords.sql');

const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const category = cols[0] ? cols[0].trim() : '';
  const subcategory = cols[1] ? cols[1].trim() : null;
  const keyword = cols[2] ? cols[2].trim() : '';
  if (!category || !keyword) continue;
  rows.push({ category, subcategory, keyword });
}

let sql = `-- ============================================================================
-- MIGRATION 1030: SEED SEARCH TAXONOMY KEYWORDS
-- ============================================================================
-- Auto-generated from db/seed/search-taxonomy.csv via scripts/generate-taxonomy-migration.js
-- Idempotent: safe to re-run (ON CONFLICT DO UPDATE on hub_slug + keyword_normalized).
-- Run: ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1030_seed_search_taxonomy_keywords.sql
-- ============================================================================

`;

let count = 0;
const skipped = [];

for (const row of rows) {
  const resolution = resolveTaxonomyRow({
    category: row.category,
    subcategory: row.subcategory,
    keyword: row.keyword,
  });
  if (resolution.status !== 'ok') {
    skipped.push({ keyword: row.keyword, reason: resolution.status });
    continue;
  }
  const categorySlug = slugifyLabel(row.category.replace(/&/g, ' and '));
  const keywordNorm = normalizePhrase(row.keyword);

  sql += `INSERT INTO search_taxonomy_keywords\n`;
  sql += `  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)\n`;
  sql += `VALUES\n`;
  sql += `  (${esc(categorySlug)}, ${esc(row.category)}, ${esc(row.subcategory)}, ${esc(row.keyword)}, ${esc(keywordNorm)}, ${esc(resolution.hub)}, 100, true, NOW())\n`;
  sql += `ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET\n`;
  sql += `  category_slug         = EXCLUDED.category_slug,\n`;
  sql += `  category_display_name = EXCLUDED.category_display_name,\n`;
  sql += `  subcategory           = EXCLUDED.subcategory,\n`;
  sql += `  keyword               = EXCLUDED.keyword,\n`;
  sql += `  hub_slug              = EXCLUDED.hub_slug,\n`;
  sql += `  is_active             = true,\n`;
  sql += `  updated_at            = NOW();\n\n`;
  count++;
}

sql += `-- Total inserted/upserted: ${count} rows\n`;
if (skipped.length > 0) {
  sql += `-- Skipped (${skipped.length}): ${skipped.map((s) => s.keyword).join(', ')}\n`;
}

fs.writeFileSync(outPath, sql, 'utf8');
console.log('Generated: db/migrations/1030_seed_search_taxonomy_keywords.sql');
console.log('Rows: ' + count + ' upserts, ' + skipped.length + ' skipped');
if (skipped.length > 0) console.log('Skipped:', skipped);
