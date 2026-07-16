/**
 * Fix repo functions that reference free variables (customerId, etc.) without parameters,
 * and patch service call sites to pass those arguments.
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER_ROOT = path.join(__dirname, '../src/endpoints/customer');

const SKIP_IDENTIFIERS = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'DESC',
  'ASC',
  'Date',
  'query',
  'select',
  'insert',
  'update',
  'new',
  'await',
  'return',
  'async',
  'function',
  'export',
  'import',
  'from',
  'const',
  'let',
  'var',
  'if',
  'else',
  'try',
  'catch',
  'rows',
  'row',
  'length',
  'parseInt',
  'parseFloat',
  'String',
  'Number',
  'Array',
  'Object',
  'JSON',
  'Math',
  'Error',
  'console',
  'process',
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
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function inferParamsFromStmt(inner) {
  const params = new Set();

  const lastBracket = inner.lastIndexOf('[');
  if (lastBracket >= 0) {
    const open = inner.indexOf('[', lastBracket);
    const close = findBalancedEnd(inner, open, '[', ']');
    if (close >= 0) {
      inner
        .slice(open + 1, close)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && /^[a-zA-Z_$][\w$]*$/.test(s))
        .forEach((p) => params.add(p));
    }
  }

  for (const m of inner.matchAll(/:\s*([a-zA-Z_$][\w$]*)\b/g)) {
    if (!SKIP_IDENTIFIERS.has(m[1])) params.add(m[1]);
  }

  // Object shorthand: select('t', { phone }) or { customerId }
  for (const m of inner.matchAll(/\{\s*([a-zA-Z_$][\w$]*)\s*(?:,|\})/g)) {
    if (!SKIP_IDENTIFIERS.has(m[1])) params.add(m[1]);
  }

  // Bracket params with property access: [customer[0].id]
  for (const m of inner.matchAll(/\[\s*([a-zA-Z_$][\w$]*)(?:\[[^\]]+\])?(?:\.[a-zA-Z_$][\w$]*)*\s*\]/g)) {
    if (!SKIP_IDENTIFIERS.has(m[1])) params.add(m[1]);
  }

  for (const m of inner.matchAll(/\b([a-zA-Z_$][\w$]*)\.[a-zA-Z_$][\w$]*/g)) {
    if (!SKIP_IDENTIFIERS.has(m[1])) params.add(m[1]);
  }

  const firstParen = inner.indexOf('(');
  if (firstParen >= 0) {
    const close = findBalancedEnd(inner, firstParen);
    if (close >= 0) {
      inner
        .slice(firstParen + 1, close)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^[a-zA-Z_$][\w$]*$/.test(s))
        .forEach((p) => {
          if (!SKIP_IDENTIFIERS.has(p)) params.add(p);
        });
    }
  }

  return [...params];
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
    const existingParams = paramStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(':')[0].trim());

    const bodyOpen = repoContent.indexOf('{', paramsEnd);
    const bodyClose = findBalancedEnd(repoContent, bodyOpen, '{', '}');
    if (bodyOpen < 0 || bodyClose < 0) continue;

    const body = repoContent.slice(bodyOpen + 1, bodyClose);
    const returnMatch = body.match(/return await\s+([\s\S]+?);?\s*$/);
    const inner = returnMatch ? returnMatch[1].trim().replace(/;\s*$/, '') : body.trim();
    const needed = inferParamsFromStmt(inner);
    const fullMatch = repoContent.slice(m.index, bodyClose + 1);

    fns.push({
      name,
      fullMatch,
      existingParams,
      neededParams: needed,
      inner,
    });
  }
  return fns;
}

function rebuildRepoFunction(fn) {
  const params = fn.neededParams.join(', ');
  return `export async function ${fn.name}(${params}) {\n  return await ${fn.inner};\n}`;
}

function findServiceForRepo(repoPath) {
  const moduleDir = path.dirname(path.dirname(repoPath));
  const base = path.basename(repoPath, '.repo.ts');
  const candidates = [
    path.join(moduleDir, 'services', `${base}.service.ts`),
    path.join(moduleDir, 'services', 'handler-instances.service.ts'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function repoImportNamespace(serviceContent, repoBase) {
  if (serviceContent.includes('enhanced_base_handlersRepo')) return 'enhanced_base_handlersRepo';
  if (serviceContent.includes('appointment_base_handlersRepo')) return 'appointment_base_handlersRepo';
  if (serviceContent.includes('order_base_handlersRepo')) return 'order_base_handlersRepo';
  const ns = repoBase.replace(/[^a-zA-Z0-9_]/g, '_') + 'Repo';
  return ns;
}

let reposFixed = 0;
let callsFixed = 0;

for (const repoPath of walk(CUSTOMER_ROOT, /\.repo\.ts$/)) {
  let repoContent = fs.readFileSync(repoPath, 'utf8');
  const fns = parseRepoFunctions(repoContent);
  if (fns.length === 0) continue;

  let repoChanged = false;
  const fnMap = new Map();

  for (const fn of fns) {
    const existingSet = new Set(fn.existingParams);
    const needsFix =
      fn.neededParams.length > 0 &&
      (fn.existingParams.length === 0 || fn.neededParams.some((p) => !existingSet.has(p)));

    if (needsFix) {
      const rebuilt = rebuildRepoFunction(fn);
      repoContent = repoContent.replace(fn.fullMatch, rebuilt);
      fnMap.set(fn.name, fn.neededParams);
      repoChanged = true;
      reposFixed++;
    } else if (fn.existingParams.length > 0) {
      fnMap.set(fn.name, fn.existingParams);
    } else if (fn.neededParams.length > 0) {
      fnMap.set(fn.name, fn.neededParams);
    }
  }

  if (repoChanged) fs.writeFileSync(repoPath, repoContent);

  const repoBase = path.basename(repoPath, '.repo.ts');
  const servicePath = findServiceForRepo(repoPath);
  if (!servicePath) continue;

  let svc = fs.readFileSync(servicePath, 'utf8');
  const ns = repoImportNamespace(svc, repoBase);
  let svcChanged = false;

  for (const [fnName, params] of fnMap) {
    if (params.length === 0) continue;
    const callArgs = params.join(', ');
    const emptyCall = new RegExp(`${ns}\\.${fnName}\\(\\s*\\)`, 'g');

    if (emptyCall.test(svc)) {
      svc = svc.replace(emptyCall, `${ns}.${fnName}(${callArgs})`);
      svcChanged = true;
      callsFixed++;
    }
  }

  if (svcChanged) fs.writeFileSync(servicePath, svc);
}

console.log('fix-broken-repo-params — repo functions fixed:', reposFixed, 'service calls fixed:', callsFixed);
