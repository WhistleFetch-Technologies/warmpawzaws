/**
 * Remove unused database/rds-connection imports from service files.
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER_ROOT = path.join(__dirname, '../src/endpoints/customer');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.service.ts')) acc.push(p);
  }
  return acc;
}

let cleaned = 0;
for (const fp of walk(CUSTOMER_ROOT)) {
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('database/rds-connection')) continue;
  if (/\bawait\s+(query|select|insert|update)\s*\(/.test(c)) continue;
  const next = c.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*database\/rds-connection['"];\s*\n?/g, '');
  if (next !== c) {
    fs.writeFileSync(fp, next);
    cleaned++;
    console.log('cleaned', path.relative(CUSTOMER_ROOT, fp));
  }
}
console.log('total cleaned', cleaned);
