/**
 * Split customer endpoint monolith -> routes/ + handlers/ + repos/
 * Uses line-based route end detection (first `  });` after app line).
 */
const fs = require('fs');
const path = require('path');

const [, , moduleDir, sourceRel, registerName] = process.argv;
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, sourceRel);
const OUT = path.join(ROOT, 'src/endpoints/customer', moduleDir);
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const registerIdx = lines.findIndex((l) => l.includes(`export function ${registerName}`));
if (registerIdx < 0) throw new Error(`Missing ${registerName}`);

let importEnd = 0;
for (let i = 0; i < registerIdx; i++) {
  if (lines[i].startsWith('import ')) {
    importEnd = i + 1;
    while (importEnd < registerIdx && !/from ['"]/.test(lines[importEnd - 1])) importEnd++;
  }
}
const importsOnly = lines.slice(0, importEnd).join('\n');
const helpersOnly = lines.slice(importEnd, registerIdx).join('\n');
let helpersFixed = helpersOnly;
if (helpersFixed.trim()) {
  helpersFixed = helpersFixed.replace(/\n(async )?function /g, '\nexport $1function ');
  helpersFixed = helpersFixed.replace(/\nexport export /g, '\nexport ');
  helpersFixed = helpersFixed.replace(/^const (SQL_[A-Z_]+)/gm, 'export const $1');
  helpersFixed = helpersFixed.replace(/^class /gm, 'export class ');
}

const fixPath = (s) =>
  s
    .replace(/from '\.\.\/\.\.\/\.\.\//g, "from '../../../../")
    .replace(/from "\.\.\/\.\.\/\.\.\//g, 'from "../../../../')
    .replace(/from '\.\/customer-password'/g, "from '../../password'");

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
rmrf(path.join(OUT, 'handlers'));
rmrf(path.join(OUT, 'routes'));
rmrf(path.join(OUT, 'repos'));
fs.mkdirSync(path.join(OUT, 'handlers'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'routes'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'repos'), { recursive: true });

if (helpersFixed.trim()) {
  fs.writeFileSync(
    path.join(OUT, 'repos', 'module-helpers.repo.ts'),
    `${fixPath(importsOnly)}\n\n/** Module helpers (move-only). */\n${fixPath(helpersFixed)}\n`
  );
}

function findRouteEnd(start) {
  for (let j = start + 1; j < lines.length; j++) {
    if (/^  \}\);?\s*$/.test(lines[j])) return j;
  }
  return lines.length - 1;
}

const routes = [];
for (let j = registerIdx; j < lines.length; j++) {
  if (!/^  app\.(get|post|put|patch|delete)\(/.test(lines[j])) continue;
  const method = lines[j].match(/app\.(\w+)/)[1];
  const isAsync = /async\s*\(/.test(lines[j]);
  if (!isAsync && /\);?\s*$/.test(lines[j].trim())) {
    const block = lines[j];
    const pathM = block.match(/app\.\w+\(\s*(['"`][^'"`]+['"`])/);
    const pathExpr = pathM ? pathM[1] : `'route-${j}'`;
    routes.push({ method, pathExpr, block, isAsync: false, isDelegate: true, j, close: j });
    continue;
  }
  const close = findRouteEnd(j);
  const block = lines.slice(j, close + 1).join('\n');
  const pathM = block.match(/app\.\w+\(\s*(['"`][^'"`]+['"`])/);
  const pathExpr = pathM ? pathM[1] : `'route-${j}'`;
  routes.push({ method, pathExpr, block, isAsync: true, isDelegate: false, j, close });
  j = close;
}

function slug(p, idx, method) {
  const base = p
    .replace(/['"`]/g, '')
    .replace(/^\//, '')
    .replace(/[:]/g, '')
    .replace(/[^a-zA-Z0-9/]/g, '')
    .replace(/\//g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  return (base || `route${idx}`) + '_' + method;
}

function camelHandler(s) {
  const parts = s.split('_').filter(Boolean);
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('') +
    'Handler'
  );
}

function pascalRegister(s) {
  const parts = s.split('_').filter(Boolean);
  return (
    'register' +
    parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('') +
    'Route'
  );
}

const importsForHandlers = fixPath(importsOnly);
const regFns = [];

routes.forEach((r, idx) => {
  const s = slug(r.pathExpr, idx, r.method);
  const hFn = camelHandler(s);
  const rFn = pascalRegister(s);
  regFns.push({ slug: s, hFn, rFn, method: r.method, pathExpr: r.pathExpr });

  if (r.isDelegate) {
    const extra =
      r.block.includes('handleCustomerAccountStatus') || r.block.includes('handleCustomerSetPassword')
        ? "import { handleCustomerAccountStatus, handleCustomerSetPassword } from '../../password';\n"
        : '';
    fs.writeFileSync(
      path.join(OUT, 'routes', `${s}.route.ts`),
      `import type { Hono } from 'hono';
${extra}
export function ${rFn}(app: Hono) {
${r.block}
}
`
    );
    return;
  }

  const openBrace = lines[r.j].indexOf('async (c)');
  const line = lines[r.j];
  const arrowPos = line.indexOf('=>', openBrace);
  let bodyLines = [];
  if (arrowPos >= 0) {
    const after = line.slice(arrowPos + 2).trim();
    if (after === '{') {
      bodyLines = lines.slice(r.j + 1, r.close);
    }
  }
  const body = bodyLines.join('\n');

  fs.writeFileSync(
    path.join(OUT, 'handlers', `${s}.handler.ts`),
    `import type { Context } from 'hono';
${importsForHandlers}

export async function ${hFn}(c: Context) {
${body}
}
`
  );

  fs.writeFileSync(
    path.join(OUT, 'routes', `${s}.route.ts`),
    `import type { Hono } from 'hono';
import { ${hFn} } from '../handlers/${s}.handler';

export function ${rFn}(app: Hono) {
  app.${r.method}(${r.pathExpr}, ${hFn});
}
`
  );
});

fs.writeFileSync(
  path.join(OUT, 'index.ts'),
  `import type { Hono } from 'hono';
${regFns.map(({ rFn, slug: s }) => `import { ${rFn} } from './routes/${s}.route';`).join('\n')}

export function ${registerName}(app: Hono) {
${regFns.map(({ rFn }) => `  ${rFn}(app);`).join('\n')}
}
`
);

console.log('OK', moduleDir, routes.length);
