#!/usr/bin/env node
/**
 * Read-only application dependency scan for Phase 0 handover.
 * No AWS, no DB writes.
 */
const fs = require('fs');
const path = require('path');

const tablesFile = process.env.TABLES_FILE || 'd:/dd/tables(dev).txt';
const rowsFile = process.env.ROWS_FILE || 'd:/dd/tables row count(dev).txt';
const lambdaRoot = path.join(__dirname, '../backend/lambda/src');
const migrationDir = path.join(__dirname, '../db/migrations');
const outDir = path.join(__dirname, '../docs/rds-v2');

function parseTables(p) {
  const lines = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((l) => l.split(',')[1]?.trim()).filter(Boolean);
}

function parseRowCounts(p) {
  const m = new Map();
  for (const line of fs.readFileSync(p, 'utf8').trim().split(/\r?\n/).slice(1)) {
    const parts = line.split(',');
    const name = parts[1]?.trim();
    const cnt = Number(parts[2]);
    if (name) m.set(name, Number.isFinite(cnt) ? cnt : 0);
  }
  return m;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__') continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.test.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

function classify(name) {
  const n = name.toLowerCase();
  if (n.startsWith('v_')) return 'View';
  if (/_backup$|_dedupe_backup/.test(n)) return 'Backup';
  if (/_enhanced$|_v2$/.test(n)) return 'Enhanced/Versioned';
  if (['coupon_usages', 'audit_trail', 'tele_queues', 'gst_configurations'].includes(n)) return 'Duplicate-candidate';
  if (/^dating_/.test(n)) return 'Experimental/Dating';
  if (/^analytics_/.test(n)) return 'Analytics';
  return null;
}

function tablePatterns(table, content) {
  const patterns = [];
  const esc = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`insert\\s*\\(\\s*['"]${esc}['"]`, 'i').test(content)) patterns.push('insert()');
  if (new RegExp(`select\\s*\\(\\s*['"]${esc}['"]`, 'i').test(content)) patterns.push('select()');
  if (new RegExp(`update\\s*\\(\\s*['"]${esc}['"]`, 'i').test(content)) patterns.push('update()');
  if (new RegExp(`deleteRows\\s*\\(\\s*['"]${esc}['"]`, 'i').test(content)) patterns.push('deleteRows()');
  if (new RegExp(`\\bFROM\\s+${esc}\\b`, 'i').test(content)) patterns.push('FROM');
  if (new RegExp(`\\bINTO\\s+${esc}\\b`, 'i').test(content)) patterns.push('INTO');
  if (new RegExp(`\\bJOIN\\s+${esc}\\b`, 'i').test(content)) patterns.push('JOIN');
  if (patterns.length === 0 && new RegExp(`['"]${esc}['"]`, 'i').test(content)) patterns.push('string-ref');
  return patterns;
}

const tables = parseTables(tablesFile).filter((t) => t !== 'spatial_ref_sys');
const rowCounts = parseRowCounts(rowsFile);
const files = walk(lambdaRoot);

const tableHits = new Map();
for (const t of tables) tableHits.set(t, { files: new Set(), patterns: new Set() });

const endpointRegs = [];
const jobs = [];
const sqsSns = [];

for (const file of files) {
  const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  if (rel.includes('/jobs/')) jobs.push(rel);
  if (/sqs|sendToSQS|sns|eventbridge|scheduler/i.test(content)) sqsSns.push(rel);

  for (const m of content.matchAll(/app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
    endpointRegs.push({ method: m[1].toUpperCase(), path: m[2], file: rel });
  }

  for (const t of tables) {
    const patterns = tablePatterns(t, content);
    if (patterns.length) {
      const rec = tableHits.get(t);
      rec.files.add(rel);
      patterns.forEach((p) => rec.patterns.add(p));
    }
  }
}

const migRefs = new Map();
for (const t of tables) migRefs.set(t, []);
if (fs.existsSync(migrationDir)) {
  for (const mf of fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql'))) {
    const c = fs.readFileSync(path.join(migrationDir, mf), 'utf8').toLowerCase();
    for (const t of tables) {
      if (c.includes(t.toLowerCase())) migRefs.get(t).push(mf);
    }
  }
}

const active = [];
const legacy = [];
const unknown = [];

for (const t of tables) {
  const hits = tableHits.get(t);
  const codeFiles = [...hits.files];
  const mig = migRefs.get(t) || [];
  const rows = rowCounts.get(t) ?? -1;
  const entry = {
    table: t,
    rows,
    codeFileCount: codeFiles.length,
    migrations: mig.length,
    patterns: [...hits.patterns],
    tag: classify(t),
    sampleFiles: codeFiles.slice(0, 5),
  };
  if (codeFiles.length > 0) active.push(entry);
  else if (mig.length > 0) legacy.push(entry);
  else unknown.push(entry);
}

active.sort((a, b) => b.codeFileCount - a.codeFileCount);

const epByPrefix = {};
for (const e of endpointRegs) {
  const parts = e.path.split('/').filter(Boolean);
  const key = parts.slice(0, 2).join('/') || e.path;
  if (!epByPrefix[key]) epByPrefix[key] = { count: 0, files: new Set(), examples: [] };
  epByPrefix[key].count++;
  epByPrefix[key].files.add(e.file);
  if (epByPrefix[key].examples.length < 3) epByPrefix[key].examples.push(`${e.method} ${e.path}`);
}

// Feature domain mapping
const domains = {
  Booking: ['bookings', 'booking_', 'package_sessions', 'package_purchases', 'appointment_reminders'],
  Discovery: ['service_catalog', 'service_categories', 'vendor_services', 'vendor_specializations', 'specialization_', 'problem_grid', 'search_index', 'discovery_rules'],
  Vendor: ['vendors', 'vendor_'],
  Customer: ['customers', 'customer_', 'pets'],
  Payments: ['payments', 'refunds', 'razorpay', 'payout', 'settlements'],
  Ecommerce: ['orders', 'order_', 'products', 'cart', 'ecommerce_', 'wishlist'],
  Notifications: ['notification', 'device_tokens', 'push'],
  Staff: ['staff'],
  Tele: ['tele_', 'video_call', 'instant_tele'],
  Pharmacy: ['pharmacy_', 'medicine_'],
  Diagnostics: ['diagnostic_'],
  Loyalty: ['loyalty_', 'rewards', 'coupon'],
  Support: ['support_'],
  Admin: ['admin_', 'platform_', 'rbac_'],
  Analytics: ['analytics_'],
  Dating: ['dating_'],
  Delivery: ['delivery_', 'pidge_', 'meal_'],
  Insurance: ['insurance_'],
  AI: ['ai_', 'bedrock'],
};

function domainForTable(t) {
  const hits = [];
  for (const [d, prefixes] of Object.entries(domains)) {
    if (prefixes.some((p) => t === p.replace(/_$/, '') || t.startsWith(p))) hits.push(d);
  }
  return hits.length ? hits : ['Other'];
}

const featureTableMap = {};
for (const t of tables) {
  const ds = domainForTable(t);
  for (const d of ds) {
    if (!featureTableMap[d]) featureTableMap[d] = { active: 0, total: 0, tables: [] };
    featureTableMap[d].total++;
    const hasCode = tableHits.get(t).files.size > 0;
    if (hasCode) featureTableMap[d].active++;
    if (hasCode) featureTableMap[d].tables.push(t);
  }
}

const out = {
  meta: {
    tables: tables.length,
    filesScanned: files.length,
    endpointsFound: endpointRegs.length,
    jobs: jobs.length,
    generatedAt: new Date().toISOString(),
    source: 'dev handover + codebase scan (read-only)',
  },
  summary: {
    activeTableCount: active.length,
    migrationOnlyNoCode: legacy.length,
    unknownNoCodeNoMig: unknown.length,
    duplicateCandidates: tables.filter((t) => classify(t) === 'Duplicate-candidate'),
    backupTables: tables.filter((t) => classify(t) === 'Backup'),
    enhancedTables: tables.filter((t) => classify(t) === 'Enhanced/Versioned'),
    viewObjects: tables.filter((t) => classify(t) === 'View'),
  },
  topActiveTables: active.slice(0, 50),
  migrationOnlySample: legacy.slice(0, 40),
  unknownSample: unknown.slice(0, 40),
  topEndpointPrefixes: Object.entries(epByPrefix)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 40)
    .map(([k, v]) => ({ prefix: '/' + k, routes: v.count, examples: v.examples, files: [...v.files].slice(0, 2) })),
  backgroundWorkers: { jobs, sqsSnsFiles: [...new Set(sqsSns)].slice(0, 30) },
  featureTableMap,
};

const matrix = tables.map((t) => {
  const h = tableHits.get(t);
  return {
    table: t,
    rows: rowCounts.get(t) ?? 0,
    codeFiles: h.files.size,
    migrations: (migRefs.get(t) || []).length,
    status: h.files.size > 0 ? 'Active' : migRefs.get(t).length > 0 ? 'Migration-only' : 'Unknown',
    tag: classify(t),
    domains: domainForTable(t),
    files: [...h.files].slice(0, 8),
  };
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '_dependency-scan.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(outDir, '_dependency-matrix.json'), JSON.stringify(matrix, null, 2));

// endpoint -> tables via file co-occurrence (heuristic)
const fileToTables = new Map();
for (const t of tables) {
  for (const f of tableHits.get(t).files) {
    if (!fileToTables.has(f)) fileToTables.set(f, new Set());
    fileToTables.get(f).add(t);
  }
}
const endpointTableMap = [];
for (const e of endpointRegs) {
  const tbls = fileToTables.get(e.file);
  if (tbls && tbls.size) {
    endpointTableMap.push({ method: e.method, path: e.path, file: e.file, tables: [...tbls].sort() });
  }
}
fs.writeFileSync(path.join(outDir, '_endpoint-table-map.json'), JSON.stringify(endpointTableMap, null, 2));

console.log('Summary:', JSON.stringify(out.summary, null, 2));
console.log(`Wrote ${outDir}/_dependency-scan.json, _dependency-matrix.json, _endpoint-table-map.json`);
