#!/usr/bin/env node
/** Column reference scan (heuristic, read-only). */
const fs = require('fs');
const path = require('path');

const lambdaRoot = path.join(__dirname, '../backend/lambda/src');
const matrix = require('../docs/rds-v2/_dependency-matrix.json');
const outDir = path.join(__dirname, '../docs/rds-v2');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__') continue;
      walk(full, acc);
    } else if (/\.ts$/.test(ent.name) && !ent.name.endsWith('.test.ts')) acc.push(full);
  }
  return acc;
}

const files = walk(lambdaRoot);
const allContent = files.map((f) => ({ f, c: fs.readFileSync(f, 'utf8') }));

const activeTables = matrix
  .filter((r) => r.status === 'Active')
  .sort((a, b) => b.codeFiles - a.codeFiles)
  .slice(0, 80);

const columnUsage = {};

for (const { table } of activeTables) {
  const cols = new Set();
  const esc = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const { c } of allContent) {
    // select('table', filters, { columns: ['a','b'] })
    for (const m of c.matchAll(new RegExp(`select\\s*\\(\\s*['"]${esc}['"][^)]*columns:\\s*\\[([^\\]]+)\\]`, 'gi'))) {
      for (const col of m[1].match(/['"`]([^'"`]+)['"`]/g) || []) {
        cols.add(col.replace(/['"`]/g, ''));
      }
    }
    // insert('table', { col: val })
    for (const m of c.matchAll(new RegExp(`insert\\s*\\(\\s*['"]${esc}['"]\\s*,\\s*\\{([^}]{1,800})\\}`, 'gi'))) {
      for (const k of m[1].match(/([a-z_][a-z0-9_]*)\s*:/gi) || []) {
        cols.add(k.replace(':', '').trim());
      }
    }
    // update('table', { col: val })
    for (const m of c.matchAll(new RegExp(`update\\s*\\(\\s*['"]${esc}['"]\\s*,\\s*\\{([^}]{1,800})\\}`, 'gi'))) {
      for (const k of m[1].match(/([a-z_][a-z0-9_]*)\s*:/gi) || []) {
        cols.add(k.replace(':', '').trim());
      }
    }
    // SELECT a, b FROM table
    for (const m of c.matchAll(new RegExp(`SELECT\\s+([^;\\n]{5,300})\\s+FROM\\s+${esc}\\b`, 'gi'))) {
      const part = m[1];
      if (part.includes('*')) continue;
      for (const seg of part.split(',')) {
        const col = seg.trim().split(/\s+/).pop();
        if (/^[a-z_][a-z0-9_]*$/i.test(col)) cols.add(col);
      }
    }
    // row.field after common aliases - weak signal
    for (const m of c.matchAll(new RegExp(`\\b${esc}\\.[a-z_][a-z0-9_]*`, 'gi'))) {
      cols.add(m[0].split('.')[1]);
    }
  }
  columnUsage[table] = { referencedColumns: [...cols].sort(), count: cols.size };
}

// duplicate pair analysis from handover
const pairs = [
  ['coupon_usage', 'coupon_usages'],
  ['gst_configs', 'gst_configurations'],
  ['audit_logs', 'audit_trail'],
  ['tele_queue', 'tele_queues'],
  ['notification_templates', 'notification_templates_enhanced'],
  ['vendor_holidays', 'vendor_holidays_enhanced'],
];

const duplicateAnalysis = pairs.map(([a, b]) => {
  const ma = matrix.find((x) => x.table === a);
  const mb = matrix.find((x) => x.table === b);
  return {
    pair: [a, b],
    a: ma ? { status: ma.status, codeFiles: ma.codeFiles, migrations: ma.migrations } : null,
    b: mb ? { status: mb.status, codeFiles: mb.codeFiles, migrations: mb.migrations } : null,
  };
});

fs.writeFileSync(path.join(outDir, '_column-usage-top80.json'), JSON.stringify(columnUsage, null, 2));
fs.writeFileSync(path.join(outDir, '_duplicate-analysis.json'), JSON.stringify(duplicateAnalysis, null, 2));
console.log('Top tables column counts:', Object.entries(columnUsage).slice(0, 10).map(([t, v]) => `${t}:${v.count}`).join(', '));
