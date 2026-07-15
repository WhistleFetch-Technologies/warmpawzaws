/**
 * Enforce route → handler → service → repo for customer endpoints.
 *
 * Phase 1: Move handler bodies to services; thin handlers delegate.
 * Phase 2: Fix inline route handlers (password change-password).
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER_ROOT = path.join(__dirname, '../src/endpoints/customer');

function walk(dir, pattern, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, pattern, acc);
    else if (pattern.test(e.name)) acc.push(p);
  }
  return acc;
}

function serviceFnName(handlerFn) {
  return 'execute' + handlerFn.replace(/Handler$/, '');
}

function extractHandler(content) {
  // Already thin?
  if (/delegates to service layer/i.test(content)) return null;

  const m = content.match(
    /^(import[\s\S]*?)(\r?\n\r?\n)?export async function (\w+)\(c: Context\)\s*\{([\s\S]*)\}\s*$/
  );
  if (!m) return null;
  return { imports: (m[1] || '').trim(), fn: m[3], body: m[4] };
}

function relImport(fromDir, toFile) {
  const rel = path.relative(fromDir, toFile).replace(/\\/g, '/').replace(/\.ts$/, '');
  return rel.startsWith('.') ? rel : './' + rel;
}

let converted = 0;
let skipped = 0;

for (const handlerPath of walk(CUSTOMER_ROOT, /\.handler\.ts$/)) {
  const content = fs.readFileSync(handlerPath, 'utf8');
  const parsed = extractHandler(content);
  if (!parsed) {
    skipped++;
    continue;
  }

  const handlersDir = path.dirname(handlerPath);
  const moduleDir = path.dirname(handlersDir);
  const servicesDir = path.join(moduleDir, 'services');
  fs.mkdirSync(servicesDir, { recursive: true });

  const base = path.basename(handlerPath, '.handler.ts');
  const svcFn = serviceFnName(parsed.fn);
  const svcPath = path.join(servicesDir, `${base}.service.ts`);

  if (fs.existsSync(svcPath)) {
    skipped++;
    continue;
  }

  const serviceFile = `import type { Context } from 'hono';
${parsed.imports}

export async function ${svcFn}(c: Context) {${parsed.body}}
`;
  fs.writeFileSync(svcPath, serviceFile);

  const thinHandler = `import type { Context } from 'hono';
import { ${svcFn} } from '../services/${base}.service';

/** HTTP adapter — delegates to service layer. */
export async function ${parsed.fn}(c: Context) {
  return ${svcFn}(c);
}
`;
  fs.writeFileSync(handlerPath, thinHandler);
  converted++;
}

console.log('Phase 1 — converted:', converted, 'skipped:', skipped);

// Inline routes
for (const rp of walk(CUSTOMER_ROOT, /\.route\.ts$/)) {
  const rc = fs.readFileSync(rp, 'utf8');
  if (!/app\.\w+\([^,]+,\s*async\s*\(/.test(rc)) continue;

  const base = path.basename(rp, '.route.ts');
  const moduleDir = path.dirname(path.dirname(rp));
  const handlersDir = path.join(moduleDir, 'handlers');
  const servicesDir = path.join(moduleDir, 'services');
  fs.mkdirSync(handlersDir, { recursive: true });
  fs.mkdirSync(servicesDir, { recursive: true });

  const m = rc.match(/app\.(\w+)\(([^,]+),\s*async\s*\(c\)\s*=>\s*\{([\s\S]*)\}\s*\);/);
  if (!m) continue;

  const handlerFn =
    base
      .split('_')
      .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('') + 'Handler';
  const svcFn = serviceFnName(handlerFn);

  const imports = rc
    .split('\n')
    .filter((l) => l.startsWith('import ') && !l.includes("from 'hono'"))
    .join('\n');

  const svcPath = path.join(servicesDir, `${base}.service.ts`);
  const handlerPath = path.join(handlersDir, `${base}.handler.ts`);

  if (!fs.existsSync(svcPath)) {
    fs.writeFileSync(
      svcPath,
      `import type { Context } from 'hono';
${imports}

export async function ${svcFn}(c: Context) {${m[3]}}
`
    );
  }
  if (!fs.existsSync(handlerPath)) {
    fs.writeFileSync(
      handlerPath,
      `import type { Context } from 'hono';
import { ${svcFn} } from '../services/${base}.service';

export async function ${handlerFn}(c: Context) {
  return ${svcFn}(c);
}
`
    );
  }

  const regM = rc.match(/export function (register\w+)/);
  const regFn = regM ? regM[1] : 'registerRoute';
  const newRoute = `import type { Hono } from 'hono';
import { ${handlerFn} } from '../handlers/${base}.handler';

export function ${regFn}(app: Hono) {
  app.${m[1]}(${m[2]}, ${handlerFn});
}
`;
  fs.writeFileSync(rp, newRoute);
  console.log('Fixed inline route:', path.relative(CUSTOMER_ROOT, rp));
}
