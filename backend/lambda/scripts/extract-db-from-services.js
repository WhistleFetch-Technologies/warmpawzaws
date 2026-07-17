/**
 * Extract await query/select/insert/update from services into per-endpoint repos.
 * Move-only: identical SQL strings and param arrays, wrapped as named repo functions.
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER_ROOT = path.join(__dirname, '../src/endpoints/customer');

function walk(dir, pattern, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'repos') walk(p, pattern, acc);
    else if (e.isFile() && pattern.test(e.name)) acc.push(p);
  }
  return acc;
}

function pascal(s) {
  return s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function findBalancedEnd(src, openIdx) {
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
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractDbStatements(body) {
  const results = [];
  const re = /\bawait\s+(query|select|insert|update)\s*\(/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const fn = m[1];
    const open = body.indexOf('(', m.index);
    const close = findBalancedEnd(body, open);
    if (close < 0) continue;
    const fullStart = m.index;
    const fullEnd = close + 1;
    // include trailing semicolon
    let end = fullEnd;
    while (end < body.length && /[\s;]/.test(body[end])) {
      if (body[end] === ';') {
        end++;
        break;
      }
      end++;
    }
    const stmt = body.slice(fullStart, end);
    const inner = body.slice(m.index + 'await '.length, end).trim();
    results.push({ fn, stmt, inner, start: fullStart, end });
  }
  return results;
}

function inferParams(inner) {
  const params = new Set();
  const skip = new Set(['true', 'false', 'null', 'undefined', 'DESC', 'ASC']);

  const lastBracket = inner.lastIndexOf('[');
  if (lastBracket >= 0) {
    const open = inner.indexOf('[', lastBracket);
    const close = findBalancedEnd(inner, open);
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
    if (!skip.has(m[1])) params.add(m[1]);
  }
  for (const m of inner.matchAll(/\b([a-zA-Z_$][\w$]*)\.[a-zA-Z_$][\w$]*/g)) {
    if (!skip.has(m[1])) params.add(m[1]);
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
        .forEach((p) => params.add(p));
    }
  }

  return [...params];
}

let processed = 0;
let reposCreated = 0;

for (const svcPath of walk(CUSTOMER_ROOT, /\.service\.ts$/)) {
  let content = fs.readFileSync(svcPath, 'utf8');
  if (!/\bawait\s+(query|select|insert|update)\s*\(/.test(content)) continue;

  const moduleDir = path.dirname(path.dirname(svcPath));
  const reposDir = path.join(moduleDir, 'repos');
  fs.mkdirSync(reposDir, { recursive: true });

  const base = path.basename(svcPath, '.service.ts');
  const repoPath = path.join(reposDir, `${base}.repo.ts`);

  const bodyMatch = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/);
  let body = null;
  if (bodyMatch) {
    body = bodyMatch[1];
  } else if (/export class /.test(content)) {
    const classIdx = content.indexOf('export class');
    body = content.slice(classIdx);
  } else {
    continue;
  }

  const stmts = extractDbStatements(body);
  if (stmts.length === 0) continue;

  let repoContent = '';
  if (fs.existsSync(repoPath)) {
    repoContent = fs.readFileSync(repoPath, 'utf8');
  } else {
    repoContent = `import { query, select, insert, update } from '../../../../database/rds-connection';\n\n`;
  }

  let offset = 0;
  const replacements = [];

  stmts.forEach((s, idx) => {
    const fnName = `db${pascal(base)}${idx}`;
    const params = inferParams(s.inner);
    const paramList = params.join(', ');
    const callArgs = params.length ? paramList : '';

    if (!repoContent.includes(`export async function ${fnName}`)) {
      repoContent += `export async function ${fnName}(${paramList}) {\n  return await ${s.inner}\n}\n\n`;
      reposCreated++;
    }

    replacements.push({
      start: s.start + offset,
      end: s.end + offset,
      replacement: `await ${fnName}(${callArgs})`,
      fnName,
    });
  });

  // Replace from end
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    body = body.slice(0, r.start) + r.replacement + body.slice(r.end);
  }

  // Remove rds-connection import from service
  content = content.replace(
    /import\s*\{[^}]*\}\s*from\s*['"][^'"]*database\/rds-connection['"];\s*\n?/g,
    ''
  );
  const repoImport = `import * as ${base.replace(/[^a-zA-Z0-9_]/g, '_')}Repo from '../repos/${base}.repo';\n`;
  if (!content.includes(`${base}.repo`)) {
    if (/^import type \{ Context \} from 'hono';/m.test(content)) {
      content = content.replace(/^(import type \{ Context \} from 'hono';\n)/, `$1${repoImport}`);
    } else {
      const m = content.match(/^import[\s\S]*?;\n/m);
      if (m) {
        content = content.replace(m[0], m[0] + repoImport);
      } else {
        content = repoImport + content;
      }
    }
  }

  // Fix repo calls to use namespace
  const ns = base.replace(/[^a-zA-Z0-9_]/g, '_') + 'Repo';
  replacements.forEach((r, idx) => {
    const fnName = `db${pascal(base)}${idx}`;
    const params = inferParams(stmts[idx].inner);
    const callArgs = params.length ? params.join(', ') : '';
    body = body.replace(`await ${fnName}(${callArgs})`, `await ${ns}.${fnName}(${callArgs})`);
  });

  content = content.replace(
    /export async function (\w+)\(c: Context\)\s*\{[\s\S]*\}\s*$/,
    `export async function $1(c: Context) {${body}}`
  );
  if (!/export async function \w+\(c: Context\)/.test(content)) {
    // class-based service: replace DB calls in full file
    const classIdx = content.indexOf('export class');
    if (classIdx >= 0) {
      content = content.slice(0, classIdx) + body;
    }
  }

  fs.writeFileSync(repoPath, repoContent);
  fs.writeFileSync(svcPath, content);
  processed++;
}

console.log('DB extract — services processed:', processed, 'repo functions added:', reposCreated);
