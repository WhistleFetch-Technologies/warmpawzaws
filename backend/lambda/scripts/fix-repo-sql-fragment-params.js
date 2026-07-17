/**
 * Strip SQL-alias false positives from repo function signatures left by fix-broken-repo-params.js.
 * Infers runtime params only from bind arrays [$1,...] and insert/update value objects;
 * excludes identifiers that appear only inside SQL template literals.
 *
 * Usage (T2 modules only):
 *   node scripts/fix-repo-sql-fragment-params.js backend/lambda/src/endpoints/customer/bookings
 *   node scripts/fix-repo-sql-fragment-params.js backend/lambda/src/endpoints/customer/appointments
 *   node scripts/fix-repo-sql-fragment-params.js backend/lambda/src/endpoints/customer/orders
 *   node scripts/fix-repo-sql-fragment-params.js backend/lambda/src/endpoints/customer/addresses
 */
const fs = require('fs');
const path = require('path');

const SQL_ALIAS_PARAMS = new Set([
  'text', 'interval', 'v', 'c', 'o', 'b', 's', 'p', 'oi', 'st', 'vs', 'br_svc',
  'name', 'species', 'breed', 'age_years', 'weight_kg',
  'SQL_BOOKING_SERVICE_LATERAL', 'SQL_PACKAGE_PURCHASE_JOIN', 'SQL_PACKAGE_PURCHASE_SELECT',
  'SQL_PRODUCT_IMAGE_SELECT',
  'action', 'previous_date', 'previous_time', 'new_date', 'new_time',
  'order_status', 'customer_id', 'vendor_id', 'delivered_at',
  'uuid', 'date', 'time',
  '$2', '$3', '$4', '$5', '$6',
]);

const SKIP_IDENTIFIERS = new Set([
  'true', 'false', 'null', 'undefined', 'DESC', 'ASC', 'Date', 'query', 'select',
  'insert', 'update', 'new', 'await', 'return', 'async', 'function', 'export',
  'import', 'from', 'const', 'let', 'var', 'if', 'else', 'try', 'catch',
  'rows', 'row', 'length', 'parseInt', 'parseFloat', 'String', 'Number',
  'Array', 'Object', 'JSON', 'Math', 'Error', 'console', 'process',
]);

function walk(dir, pattern, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, pattern, acc);
    else if (e.isFile() && pattern.test(e.name)) acc.push(p);
  }
  return acc;
}

function findBalancedEnd(src, openIdx, openCh = '(', closeCh = ')') {
  let depth = 0;
  let inStr = null;
  let escape = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function stripSqlLiterals(inner) {
  return inner.replace(/`[\s\S]*?`/g, '``').replace(/'(?:\\'|[^'])*'/g, "''");
}

function inferBindParams(inner) {
  const params = [];
  const stripped = stripSqlLiterals(inner);
  const lastBracket = stripped.lastIndexOf('[');
  if (lastBracket >= 0) {
    const open = stripped.indexOf('[', lastBracket);
    const close = findBalancedEnd(stripped, open, '[', ']');
    if (close >= 0) {
      stripped.slice(open + 1, close).split(',').map((s) => s.trim()).filter(Boolean).forEach((p) => {
        const base = p.replace(/\[[^\]]+\]/g, '').split('.')[0].trim();
        if (/^[a-zA-Z_$][\w$]*$/.test(base) && !SKIP_IDENTIFIERS.has(base) && !SQL_ALIAS_PARAMS.has(base)) {
          if (!params.includes(base)) params.push(base);
        }
      });
    }
  }
  return params;
}

function inferObjectParams(inner) {
  const params = [];
  const stripped = stripSqlLiterals(inner);
  for (const m of stripped.matchAll(/:\s*([a-zA-Z_$][\w$]*)\b/g)) {
    const p = m[1];
    if (!SKIP_IDENTIFIERS.has(p) && !SQL_ALIAS_PARAMS.has(p) && !params.includes(p)) params.push(p);
  }
  for (const m of stripped.matchAll(/\{\s*([a-zA-Z_$][\w$]*)\s*(?:,|\})/g)) {
    const p = m[1];
    if (!SKIP_IDENTIFIERS.has(p) && !SQL_ALIAS_PARAMS.has(p) && !params.includes(p)) params.push(p);
  }
  return params;
}

function parseRepoFunctions(repoContent) {
  const fns = [];
  const sigRe = /export async function (db\w+)\(/g;
  let m;
  while ((m = sigRe.exec(repoContent)) !== null) {
    const name = m[1];
    const paramsStart = m.index + m[0].length;
    const paramsEnd = findBalancedEnd(repoContent, paramsStart - 1);
    if (paramsEnd < 0) continue;
    const paramStr = repoContent.slice(paramsStart, paramsEnd);
    const existingParams = paramStr.split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean);
    const bodyOpen = repoContent.indexOf('{', paramsEnd);
    const bodyClose = findBalancedEnd(repoContent, bodyOpen, '{', '}');
    if (bodyOpen < 0 || bodyClose < 0) continue;
    const body = repoContent.slice(bodyOpen + 1, bodyClose);
    const returnMatch = body.match(/return await\s+([\s\S]+?);?\s*$/);
    const inner = returnMatch ? returnMatch[1].trim().replace(/;\s*$/, '') : body.trim();
    const bindParams = inferBindParams(inner);
    const objParams = inferObjectParams(inner);
    const needed = bindParams.length > 0 ? bindParams : objParams;
    fns.push({ name, existingParams, neededParams: needed, fullMatch: repoContent.slice(m.index, bodyClose + 1), inner });
  }
  return fns;
}

function rebuildRepoFunction(fn) {
  const params = fn.neededParams.join(', ');
  return `export async function ${fn.name}(${params}) {\n  return await ${fn.inner};\n}`;
}

const targets = process.argv.slice(2);
const roots = targets.length > 0
  ? targets.map((t) => path.resolve(t))
  : [
      path.join(__dirname, '../src/endpoints/customer/bookings'),
      path.join(__dirname, '../src/endpoints/customer/appointments'),
      path.join(__dirname, '../src/endpoints/customer/orders'),
      path.join(__dirname, '../src/endpoints/customer/addresses'),
    ];

let reposFixed = 0;
for (const root of roots) {
  for (const repoPath of walk(root, /\.repo\.ts$/)) {
    let content = fs.readFileSync(repoPath, 'utf8');
    const fns = parseRepoFunctions(content);
    let changed = false;
    for (const fn of fns) {
      const hasSqlAliasParam = fn.existingParams.some((p) => SQL_ALIAS_PARAMS.has(p));
      const paramMismatch = fn.neededParams.length > 0 &&
        (fn.existingParams.length !== fn.neededParams.length ||
          fn.neededParams.some((p, i) => fn.existingParams[i] !== p));
      if (hasSqlAliasParam || (paramMismatch && fn.neededParams.length > 0)) {
        const rebuilt = rebuildRepoFunction(fn);
        content = content.replace(fn.fullMatch, rebuilt);
        changed = true;
        reposFixed++;
      }
    }
    if (changed) {
      fs.writeFileSync(repoPath, content);
      console.log('fixed:', path.relative(process.cwd(), repoPath));
    }
  }
}
console.log('fix-repo-sql-fragment-params — repo functions fixed:', reposFixed);
