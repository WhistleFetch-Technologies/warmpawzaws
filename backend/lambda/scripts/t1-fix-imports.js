/**
 * T1 Wave 1: add missing helper imports in profile + convenience services.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../src/endpoints/customer');

const PROFILE_HELPERS = new Set(['resolveCustomerId', 'normalizePhone', 'withProfileAddressFields', 'syncDefaultCustomerAddressFromProfile']);
const CONVENIENCE_HELPERS = new Set([
  'resolveCustomerIdFromPhone',
  'getWalletLedgerTotalsByCustomerId',
  'decodePhoneParam',
  'firstProductImageUrl',
  'isPaymentMethodRowVisible',
  'mapPaymentMethodRowForCustomerWeb',
]);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.service.ts')) acc.push(p);
  }
  return acc;
}

function usedHelpers(content, helperSet) {
  const used = [];
  for (const h of helperSet) {
    const re = new RegExp(`\\b${h}\\s*\\(`);
    if (re.test(content)) used.push(h);
  }
  return used;
}

function hasImport(content, helper) {
  return new RegExp(`import\\s*\\{[^}]*\\b${helper}\\b`).test(content);
}

function addImport(content, helpers, fromPath) {
  const missing = helpers.filter((h) => !hasImport(content, h));
  if (missing.length === 0) return content;
  const importLine = `import { ${missing.join(', ')} } from '${fromPath}';\n`;
  if (/^import type \{ Context \} from 'hono';\n/.test(content)) {
    return content.replace(/^import type \{ Context \} from 'hono';\n/, `$&${importLine}`);
  }
  const firstImport = content.match(/^import[\s\S]*?;\n/);
  if (firstImport) {
    return content.replace(firstImport[0], firstImport[0] + importLine);
  }
  return importLine + content;
}

let fixed = 0;

for (const mod of ['profile', 'convenience']) {
  const dir = path.join(ROOT, mod, 'services');
  if (!fs.existsSync(dir)) continue;
  const helperSet = mod === 'profile' ? PROFILE_HELPERS : CONVENIENCE_HELPERS;
  const fromPath = '../repos/module-helpers.repo';
  for (const fp of walk(dir)) {
    let content = fs.readFileSync(fp, 'utf8');
    const used = usedHelpers(content, helperSet);
    if (used.length === 0) continue;
    const next = addImport(content, used, fromPath);
    if (next !== content) {
      fs.writeFileSync(fp, next);
      fixed++;
      console.log('imports:', path.relative(ROOT, fp), '->', used.join(', '));
    }
  }
}

console.log('t1-fix-imports done:', fixed, 'files');
