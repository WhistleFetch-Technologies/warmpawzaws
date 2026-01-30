#!/usr/bin/env node
/**
 * E2E verification: single-repo structure and endpoints.
 * Run from repo root: node scripts/verify-endpoints-structure.js
 * - Lists files with hardcoded API URLs (should use api-config getApiBaseUrl() or env).
 * - Lists files that use key endpoint paths (/config/roles, vendor/status, etc.).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', 'build', 'dist_backup', 'dist-export',
  '.cursor', 'mdfiles', 'wi', 'reports', 'migrations-ready', 'migrations'
]);

const HARDCODED_PATTERNS = [
  /supabase\.co\/functions\/v1\/make-server/,
  /make-server-3dd53475/,
  /execute-api\.ap-south-1\.amazonaws\.com/g
];

const ENDPOINT_PATTERNS = [
  { name: '/config/roles', re: /['"`]\/config\/roles['"`\/]|config\/roles\b/ },
  { name: '/vendor/status', re: /vendor\/status\// },
  { name: '/admin/vendors/active', re: /admin\/vendors\/active/ },
  { name: 'configRolesUrl|getApiBaseUrl|ENDPOINTS', re: /configRolesUrl|getApiBaseUrl|ENDPOINTS\./ }
];

function walkDir(dir, ext, callback) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walkDir(full, ext, callback);
    } else if (e.isFile() && (ext === null || e.name.endsWith(ext))) {
      callback(full);
    }
  }
}

function getAllFiles(dir, ext) {
  const out = [];
  walkDir(dir, ext, (file) => out.push(file));
  return out;
}

function relative(p) {
  return path.relative(ROOT, p);
}

function main() {
  const hardcoded = [];
  const endpointUsage = {};
  ENDPOINT_PATTERNS.forEach(p => { endpointUsage[p.name] = []; });

  const exts = ['.ts', '.tsx', '.js', '.jsx'];
  const files = new Set();
  exts.forEach(ext => getAllFiles(ROOT, ext).forEach(f => files.add(f)));

  for (const file of files) {
    const rel = relative(file);
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (_) {
      continue;
    }
    const lines = content.split('\n');

    for (const pattern of HARDCODED_PATTERNS) {
      if (pattern.test(content)) {
        const lineNum = lines.findIndex(l => pattern.test(l));
        hardcoded.push({ file: rel, line: lineNum >= 0 ? lineNum + 1 : 0 });
        break;
      }
    }

    for (const ep of ENDPOINT_PATTERNS) {
      if (ep.re.test(content)) {
        endpointUsage[ep.name].push(rel);
      }
    }
  }

  console.log('=== Single-repo endpoint structure verification ===\n');

  console.log('1. Files with hardcoded API URLs (prefer getApiBaseUrl() from api-config or env):');
  if (hardcoded.length === 0) {
    console.log('   (none found)\n');
  } else {
    const byFile = {};
    hardcoded.forEach(({ file, line }) => {
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push(line);
    });
    Object.entries(byFile).forEach(([f, lines]) => console.log('   ', f, lines.filter(Boolean).length ? `lines: ${[...new Set(lines)].join(',')}` : ''));
    console.log('');
  }

  console.log('2. Key endpoint path usage (should use same base URL):');
  for (const [name, files] of Object.entries(endpointUsage)) {
    const uniq = [...new Set(files)];
    console.log(`   ${name}: ${uniq.length} file(s)`);
    uniq.slice(0, 8).forEach(f => console.log('     -', f));
    if (uniq.length > 8) console.log('     ...', uniq.length - 8, 'more');
    console.log('');
  }

  console.log('See docs/REPO_STRUCTURE_AND_ENDPOINTS.md for canonical structure and base URL.');
}

main();
