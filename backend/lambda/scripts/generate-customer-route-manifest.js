#!/usr/bin/env node
/**
 * Generate customer route manifest from *.route.ts files.
 * Output: scripts/_customer-route-manifest.json
 */
const fs = require('fs');
const path = require('path');

const CUSTOMER = path.join(__dirname, '../src/endpoints/customer');
const OUT = path.join(__dirname, '_customer-route-manifest.json');

function walkRoutes(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkRoutes(p, acc);
    else if (e.name.endsWith('.route.ts')) acc.push(p);
  }
  return acc;
}

const entries = [];

for (const rp of walkRoutes(CUSTOMER)) {
  const c = fs.readFileSync(rp, 'utf8');
  const module = path.basename(path.dirname(path.dirname(rp)));
  const base = path.basename(rp, '.route.ts');
  const m = c.match(/app\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2\s*,\s*(\w+)\s*\)/);
  if (!m) continue;

  const handlerFn = m[4];
  const handlerPath = path.join(path.dirname(rp), '..', 'handlers', `${base}.handler.ts`);
  const servicePath = path.join(path.dirname(rp), '..', 'services', `${base}.service.ts`);
  const repoPath = path.join(path.dirname(rp), '..', 'repos', `${base}.repo.ts`);

  const pathStr = m[3];
  const params = [...pathStr.matchAll(/:([a-zA-Z0-9_]+)/g)].map((x) => x[1]);
  const needsAuth =
    /password|profile\/|account\/|orders|appointments|bookings\/|wallet|payments|cart|saved|notifications|paymentmethods|pets|customer\//i.test(
      pathStr
    ) && !/discovery|banners|articles|announcements|marketing|delivery-fee|discover|vendors\/search|problem-grid/i.test(pathStr);

  entries.push({
    id: `${m[1].toUpperCase()} ${pathStr}`,
    module,
    method: m[1].toUpperCase(),
    path: pathStr,
    routeFile: path.relative(path.join(__dirname, '..'), rp).replace(/\\/g, '/'),
    handlerFn,
    handlerFile: fs.existsSync(handlerPath)
      ? path.relative(path.join(__dirname, '..'), handlerPath).replace(/\\/g, '/')
      : null,
    serviceFile: fs.existsSync(servicePath)
      ? path.relative(path.join(__dirname, '..'), servicePath).replace(/\\/g, '/')
      : null,
    repoFile: fs.existsSync(repoPath)
      ? path.relative(path.join(__dirname, '..'), repoPath).replace(/\\/g, '/')
      : null,
    pathParams: params,
    needsAuth,
    isVendorPath: /\/vendor\//i.test(pathStr),
  });
}

entries.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  generatedAt: new Date().toISOString(),
  totalRoutes: entries.length,
  modules: [...new Set(entries.map((e) => e.module))].sort(),
  routes: entries,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${entries.length} routes to ${OUT}`);
