/**
 * Remove all per-endpoint *.repo.ts files (keep shared repos only).
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER = path.join(__dirname, '../src/endpoints/customer');
const KEEP = [
  'module-helpers.repo.ts',
  'legacy-helpers.repo.ts',
  'appointment-runtime.repo.ts',
  'customer-auth.repo.ts',
  'change-password-base-handler.repo.ts',
  'order-base-handlers.repo.ts',
  'appointment-base-handlers.repo.ts',
  'enhanced-base-handlers.repo.ts',
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.repo.ts') && !KEEP.includes(e.name)) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const p of walk(CUSTOMER)) {
  fs.unlinkSync(p);
  n++;
}
console.log('removed per-endpoint repos:', n);
