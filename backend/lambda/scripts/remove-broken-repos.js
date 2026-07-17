/**
 * Delete broken per-endpoint repos and re-extract DB from services (improved param inference).
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER = path.join(__dirname, '../src/endpoints/customer');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (
      e.name.endsWith('.repo.ts') &&
      !e.name.includes('module-helpers') &&
      !e.name.includes('legacy-helpers') &&
      !e.name.includes('base-handler') &&
      !e.name.includes('appointment-runtime') &&
      !e.name.includes('customer-auth') &&
      !e.name.includes('change-password-base')
    ) {
      acc.push(p);
    }
  }
  return acc;
}

let removed = 0;
for (const p of walk(CUSTOMER)) {
  const c = fs.readFileSync(p, 'utf8');
  if (/export async function db\w+\(\) \{/.test(c)) {
    fs.unlinkSync(p);
    removed++;
  }
}
console.log('removed broken repos:', removed);
