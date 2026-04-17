/**
 * Keeps `include` aligned with `distDir` for `next dev` so TypeScript sees generated route types.
 * Safe to run on every `npm run dev` (idempotent).
 */
const fs = require('fs');
const path = require('path');
const { getDevTypesIncludeEntry } = require('./dev-cache-path.cjs');

const appRoot = path.resolve(__dirname, '..');
const tsconfigPath = path.join(appRoot, 'tsconfig.json');
const desired = getDevTypesIncludeEntry(appRoot);

const raw = fs.readFileSync(tsconfigPath, 'utf8');
const tsconfig = JSON.parse(raw);

if (!Array.isArray(tsconfig.include)) {
  tsconfig.include = [];
}

const isStaleGenerated = (entry) =>
  typeof entry === 'string' &&
  (entry.includes('admin-web-next/types') ||
    entry.includes('AppData\\Local\\warmpawz') ||
    entry.includes('AppData/Local/warmpawz'));

tsconfig.include = tsconfig.include.filter((e) => !isStaleGenerated(e));

if (!tsconfig.include.includes(desired)) {
  tsconfig.include.push(desired);
}

fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
