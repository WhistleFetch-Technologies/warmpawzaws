/**
 * Validate customer endpoint layer compliance.
 * Exit 1 on violations.
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER_ROOT = path.join(__dirname, '../src/endpoints/customer');
const violations = [];

const PASSWORD_CROSS_MODULE = new Set([
  'customer_profile_passwordstatus_get',
  'customer_profile_setpassword_post',
  'customer_account_status_get',
  'customer_account_password_post',
]);

function walk(dir, pattern, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, pattern, acc);
    else if (pattern.test(e.name)) acc.push(p);
  }
  return acc;
}

const DB_RE = /\bawait\s+(query|select|insert|update)\s*\(|from\s+['"][^'"]*database\/rds-connection['"]/;
const INLINE_ROUTE = /app\.\w+\([^,]+,\s*async\s*\(/;
const EMPTY_IMPORT = /import\s*\{\s*\}\s*from/;

for (const rp of walk(CUSTOMER_ROOT, /\.route\.ts$/)) {
  const c = fs.readFileSync(rp, 'utf8');
  const base = path.basename(rp, '.route.ts');
  if (INLINE_ROUTE.test(c)) violations.push(`ROUTE inline handler: ${rp}`);
  if (DB_RE.test(c)) violations.push(`ROUTE has DB import/call: ${rp}`);
  if (PASSWORD_CROSS_MODULE.has(base)) {
    if (!/from ['"]\.\.\/\.\.\/password['"]/.test(c)) {
      violations.push(`ROUTE profile→password delegate missing: ${rp}`);
    }
    continue;
  }
  if (!/from ['"]\.\.\/handlers\//.test(c)) {
    violations.push(`ROUTE must import handler from ../handlers/: ${rp}`);
  }
}

for (const hp of walk(CUSTOMER_ROOT, /\.handler\.ts$/)) {
  const c = fs.readFileSync(hp, 'utf8');
  if (DB_RE.test(c)) violations.push(`HANDLER has DB: ${hp}`);
  if (EMPTY_IMPORT.test(c)) violations.push(`HANDLER empty import block: ${hp}`);
  const isPasswordNamed = /^export async function handleCustomer/.test(c);
  const isThin =
    /delegates to service layer/i.test(c) ||
    /return \w+\(c\)/.test(c) ||
    isPasswordNamed;
  if (!isThin) {
    const loc = c.split('\n').filter((l) => l.trim() && !l.startsWith('import')).length;
    if (loc > 12) violations.push(`HANDLER not thin delegate (${loc} lines): ${hp}`);
  }
  const base = path.basename(hp, '.handler.ts');
  const svc = path.join(path.dirname(path.dirname(hp)), 'services', `${base}.service.ts`);
  if (!fs.existsSync(svc) && !isPasswordNamed) {
    violations.push(`HANDLER missing service: ${hp}`);
  }
}

for (const sp of walk(CUSTOMER_ROOT, /\.service\.ts$/)) {
  const c = fs.readFileSync(sp, 'utf8');
  if (EMPTY_IMPORT.test(c)) violations.push(`SERVICE empty import block: ${sp}`);
  if (/\bawait\s+(query|select|insert|update)\s*\(/.test(c)) {
    violations.push(`SERVICE has DB call: ${sp}`);
  } else if (/from\s+['"][^'"]*database\/rds-connection['"]/.test(c)) {
    violations.push(`SERVICE imports rds-connection: ${sp}`);
  }
}

for (const rp of walk(CUSTOMER_ROOT, /\.repo\.ts$/)) {
  const c = fs.readFileSync(rp, 'utf8');
  if (/extends BaseHandler/.test(c)) violations.push(`REPO has BaseHandler class: ${rp}`);
  if (EMPTY_IMPORT.test(c)) violations.push(`REPO empty import block: ${rp}`);
}

if (fs.existsSync(path.join(CUSTOMER_ROOT, 'discovery/shared/legacy-helpers.ts'))) {
  violations.push('DUPLICATE discovery/shared/legacy-helpers.ts still exists');
}

if (violations.length) {
  console.error('Layer violations:', violations.length);
  violations.slice(0, 50).forEach((v) => console.error(' -', path.relative(CUSTOMER_ROOT, v)));
  if (violations.length > 50) console.error(` ... and ${violations.length - 50} more`);
  process.exit(1);
}
console.log('Layer compliance OK');
