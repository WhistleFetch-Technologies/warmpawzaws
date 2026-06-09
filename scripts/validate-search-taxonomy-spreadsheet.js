#!/usr/bin/env node
/**
 * Dry-run validation: Category | Subcategory | Keyword | Resolved Hub
 * Does NOT write to the database.
 *
 * Usage:
 *   node scripts/validate-search-taxonomy-spreadsheet.js
 *   node scripts/validate-search-taxonomy-spreadsheet.js --file db/seed/search-taxonomy.csv
 *   node scripts/validate-search-taxonomy-spreadsheet.js --json
 */

const fs = require('fs');
const path = require('path');
const { resolveTaxonomyRow, normalizePhrase } = require('./lib/search-taxonomy-import-rules');

const DEFAULT_FILE = path.join(__dirname, '..', 'db', 'seed', 'search-taxonomy.csv');
const REPORT_DIR = path.join(__dirname, 'reports');

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
    if (!category && !keyword) continue;
    rows.push({
      line: i + 1,
      category: category || '',
      subcategory: idx.subcategory >= 0 ? cols[idx.subcategory] || '' : '',
      keyword: keyword || '',
    });
  }
  return rows;
}

function pad(s, n) {
  const t = String(s ?? '');
  return t.length >= n ? t.slice(0, n - 1) + '…' : t.padEnd(n);
}

function main() {
  const fileArg = process.argv.find((a, i) => process.argv[i - 1] === '--file');
  const filePath = fileArg || DEFAULT_FILE;
  const asJson = process.argv.includes('--json');

  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${filePath}`);
    console.error('Add spreadsheet export before validation (see db/seed/search-taxonomy.README.md).');
    process.exit(2);
  }

  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const resolved = [];
  const unmapped = [];
  const skipped = [];

  const UNMAPPED_REASON =
    'No matching keyword, subcategory, or category-level hub rule (multi-hub categories require keyword/subcategory mapping)';

  for (const row of parsed) {
    const result = resolveTaxonomyRow(row);
    const entry = {
      line: row.line,
      category: row.category,
      subcategory: row.subcategory || null,
      keyword: row.keyword,
      keywordNormalized: normalizePhrase(row.keyword),
      ...result,
    };
    if (result.status === 'ok') {
      entry.resolvedHub = result.hub;
      resolved.push(entry);
    } else if (result.status === 'unmapped') {
      entry.reason = UNMAPPED_REASON;
      unmapped.push(entry);
    } else {
      entry.skipReason = result.reason;
      skipped.push(entry);
    }
  }

  const hubCounts = {};
  for (const r of resolved) {
    hubCounts[r.resolvedHub] = (hubCounts[r.resolvedHub] || 0) + 1;
  }
  const hubSummary = Object.entries(hubCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([resolvedHub, keywordCount]) => ({ resolvedHub, keywordCount }));

  const categoryStats = {};
  for (const row of parsed) {
    const cat = row.category || '(empty)';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { category: cat, totalKeywords: 0, mappedKeywords: 0, unmappedKeywords: 0, skippedKeywords: 0 };
    }
    categoryStats[cat].totalKeywords += 1;
  }
  for (const r of resolved) {
    const cat = r.category || '(empty)';
    if (categoryStats[cat]) categoryStats[cat].mappedKeywords += 1;
  }
  for (const r of unmapped) {
    const cat = r.category || '(empty)';
    if (categoryStats[cat]) categoryStats[cat].unmappedKeywords += 1;
  }
  for (const r of skipped) {
    const cat = r.category || '(empty)';
    if (categoryStats[cat]) categoryStats[cat].skippedKeywords += 1;
  }
  const categoryCoverage = Object.values(categoryStats).sort((a, b) =>
    a.category.localeCompare(b.category)
  );

  const summary = {
    file: filePath,
    totalRows: parsed.length,
    resolved: resolved.length,
    unmapped: unmapped.length,
    skipped: skipped.length,
    hubSummary,
    categoryCoverage,
    unmappedKeywords: unmapped.map((r) => ({
      line: r.line,
      category: r.category,
      subcategory: r.subcategory,
      keyword: r.keyword,
      reason: r.reason,
    })),
    skippedKeywords: skipped.map((r) => ({
      line: r.line,
      category: r.category,
      subcategory: r.subcategory,
      keyword: r.keyword,
      skipReason: r.skipReason,
    })),
    resolvedRows: resolved.map((r) => ({
      category: r.category,
      subcategory: r.subcategory,
      keyword: r.keyword,
      resolvedHub: r.resolvedHub,
      via: r.via,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('\n=== A) Validation summary ===\n');
    console.log(`File:           ${filePath}`);
    console.log(`Total rows:     ${summary.totalRows}`);
    console.log(`Resolved rows:  ${summary.resolved}`);
    console.log(`Unmapped rows:  ${summary.unmapped}`);
    console.log(`Skipped rows:   ${summary.skipped}`);

    console.log('\n=== B) Unmapped keywords ===\n');
    if (!unmapped.length) {
      console.log('(none)');
    } else {
      const w = { c: 28, s: 22, k: 32, r: 20 };
      console.log(
        `${pad('Category', w.c)} | ${pad('Subcategory', w.s)} | ${pad('Keyword', w.k)} | ${pad('Reason', w.r)}`
      );
      console.log('-'.repeat(110));
      for (const r of unmapped) {
        console.log(
          `${pad(r.category, w.c)} | ${pad(r.subcategory || '', w.s)} | ${pad(r.keyword, w.k)} | ${pad(r.reason, w.r)}`
        );
      }
    }

    console.log('\n=== C) Skipped keywords ===\n');
    if (!skipped.length) {
      console.log('(none)');
    } else {
      const w = { c: 28, s: 22, k: 32, r: 24 };
      console.log(
        `${pad('Category', w.c)} | ${pad('Subcategory', w.s)} | ${pad('Keyword', w.k)} | ${pad('Skip Reason', w.r)}`
      );
      console.log('-'.repeat(110));
      for (const r of skipped) {
        console.log(
          `${pad(r.category, w.c)} | ${pad(r.subcategory || '', w.s)} | ${pad(r.keyword, w.k)} | ${pad(r.skipReason, w.r)}`
        );
      }
    }

    console.log('\n=== D) Resolution summary (by hub) ===\n');
    if (!hubSummary.length) {
      console.log('(none)');
    } else {
      console.log(`${pad('Resolved Hub', 18)} | Keyword Count`);
      console.log('-'.repeat(36));
      for (const h of hubSummary) {
        console.log(`${pad(h.resolvedHub, 18)} | ${h.keywordCount}`);
      }
    }

    console.log('\n=== E) Category coverage ===\n');
    const w = { c: 32, t: 8, m: 8, u: 10, s: 8 };
    console.log(
      `${pad('Category', w.c)} | ${pad('Total', w.t)} | ${pad('Mapped', w.m)} | ${pad('Unmapped', w.u)} | ${pad('Skipped', w.s)}`
    );
    console.log('-'.repeat(72));
    for (const c of categoryCoverage) {
      console.log(
        `${pad(c.category, w.c)} | ${pad(c.totalKeywords, w.t)} | ${pad(c.mappedKeywords, w.m)} | ${pad(c.unmappedKeywords, w.u)} | ${pad(c.skippedKeywords, w.s)}`
      );
    }
  }

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, 'search-taxonomy-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\nReport written: ${reportPath}`);

  if (unmapped.length > 0) process.exit(1);
  process.exit(0);
}

main();
