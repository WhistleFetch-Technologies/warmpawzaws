/**
 * Sanity check: every /images/...webp or ${BASE}/file.webp referenced in
 * customer-web (+ shared admin/backend paths) must exist under public/.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const PUBLIC = path.join(REPO, 'apps/customer-web/public');

const SCAN_ROOTS = [
  path.join(REPO, 'apps/customer-web'),
  path.join(REPO, 'apps/admin-web/lib/banner-admin.ts'),
  path.join(REPO, 'backend/lambda/src/endpoints/customer-content.ts'),
  path.join(REPO, 'backend/lambda/src/endpoints/customer/customerEndpoint/customer-content.ts'),
];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'android', '__tests__']);
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);

function collectFiles(target, out) {
  if (!fs.existsSync(target)) return;
  const st = fs.statSync(target);
  if (st.isFile()) {
    out.push(target);
    return;
  }
  for (const ent of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      collectFiles(full, out);
    } else if (EXT.has(path.extname(ent.name))) {
      out.push(full);
    }
  }
}

function extractBases(content) {
  const bases = {};
  for (const m of content.matchAll(/(?:export )?const\s+(\w+)\s*=\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g)) {
    bases[m[1]] = m[3].replace(/\\'/g, "'");
  }
  return bases;
}

const IGNORE_REFS = new Set(['/images/home/hero-pet.webp']);

const refs = new Set();
const files = [];
for (const root of SCAN_ROOTS) collectFiles(root, files);
files.push(path.join(PUBLIC, 'firebase-messaging-sw.js'));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const bases = extractBases(content);

  for (const m of content.matchAll(/(['"`])(\/[^'"`\s]+?\.webp)\1/g)) {
    refs.add(m[2]);
  }
  for (const m of content.matchAll(/\$\{(\w+)\}(\/[^'"`\s]+?\.webp)/g)) {
    const base = bases[m[1]];
    if (base) refs.add(base + m[2]);
    else refs.add(`UNRESOLVED:${m[0]} in ${path.relative(REPO, file)}`);
  }
}

const missing = [];
for (const ref of refs) {
  if (IGNORE_REFS.has(ref)) continue;
  if (ref.startsWith('UNRESOLVED:')) {
    missing.push(ref);
    continue;
  }
  const disk = path.join(PUBLIC, ref.replace(/^\//, ''));
  if (!fs.existsSync(disk)) missing.push(ref);
}

console.log(`Scanned ${files.length} files, ${refs.size} unique .webp references`);
if (missing.length) {
  console.error(`FAIL: ${missing.length} missing/unresolved:`);
  missing.sort().forEach((r) => console.error('  ', r));
  process.exit(1);
}
console.log('OK: all referenced .webp assets exist under apps/customer-web/public');
