/**
 * Update customer-web (and shared static path refs) from .png to .webp after conversion.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

const EXTRA_FILES = [
  'backend/lambda/src/endpoints/customer-content.ts',
  'backend/lambda/src/endpoints/customer/customerEndpoint/customer-content.ts',
  'apps/admin-web/lib/banner-admin.ts',
  'apps/admin-web/lib/__tests__/banner-admin-core.test.ts',
];

const EXT = new Set(['.ts', '.tsx', '.js', '.css', '.json', '.html', '.md']);

function patchContent(content) {
  let next = content;
  next = next.replace(/\/logo\.png\b/g, '/logo.webp');
  next = next.replace(/\/icons\/icon-192x192\.png\b/g, '/icons/icon-192x192.webp');
  next = next.replace(/\/icons\/badge-72x72\.png\b/g, '/icons/badge-72x72.webp');
  // Static asset paths under /images/
  next = next.replace(/(\/images\/[^'"\s`]+)\.png\b/g, '$1.webp');
  // Template literals: `${BASE}/filename.png`
  next = next.replace(/(\$\{[^}]+\}\/[^'"\s`]+)\.png\b/g, '$1.webp');
  // encodeURIComponent('...png')
  next = next.replace(
    /encodeURIComponent\(\s*'([^']+)\.png'\s*\)/g,
    (_, inner) => `encodeURIComponent('${inner}.webp')`,
  );
  next = next.replace(
    /encodeURIComponent\(\s*"([^"]+)\.png"\s*\)/g,
    (_, inner) => `encodeURIComponent("${inner}.webp")`,
  );
  return next;
}

function walkDir(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.next', 'dist', 'android'].includes(ent.name)) continue;
      walkDir(full, out);
      continue;
    }
    const ext = path.extname(ent.name);
    if (EXT.has(ext)) out.push(full);
  }
}

const files = [];
walkDir(path.join(REPO_ROOT, 'apps/customer-web'), files);
for (const rel of EXTRA_FILES) {
  const full = path.join(REPO_ROOT, rel);
  if (fs.existsSync(full)) files.push(full);
}

let changed = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const patched = patchContent(raw);
  if (patched !== raw) {
    fs.writeFileSync(file, patched, 'utf8');
    changed++;
    console.log('updated', path.relative(REPO_ROOT, file));
  }
}

console.log(`Patched ${changed} files`);
