/**
 * Extract inline handlers from discovery route files into handlers/.
 */
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../src/endpoints/customer/discovery/routes');
const HANDLERS_DIR = path.join(__dirname, '../src/endpoints/customer/discovery/handlers');

fs.mkdirSync(HANDLERS_DIR, { recursive: true });

for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.route.ts'))) {
  const full = path.join(ROUTES_DIR, file);
  let content = fs.readFileSync(full, 'utf8');
  const regM = content.match(/export function (register\w+)\(app: Hono\)/);
  if (!regM) continue;

  const appM = content.match(/app\.(get|post|put|patch|delete)\(([^,]+),\s*async\s*\(c\)\s*=>\s*\{/);
  if (!appM) continue;

  const method = appM[1];
  const pathExpr = appM[2].trim();
  const start = content.indexOf(appM[0]) + appM[0].length;
  let end = content.length;
  const tail = content.slice(start);
  const closeIdx = tail.lastIndexOf('});');
  if (closeIdx < 0) continue;
  const body = tail.slice(0, closeIdx).trimEnd();
  if (body.endsWith('}')) {
    // ok
  }

  const base = file.replace('.route.ts', '');
  const hFn = base.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Handler';

  const imports = content
    .split('\n')
    .filter((l) => l.startsWith('import ') || (l.trim().startsWith('} from')))
    .join('\n');

  fs.writeFileSync(
    path.join(HANDLERS_DIR, `${base}.handler.ts`),
    `${imports.replace(/from '\.\.\/routes/g, "from '").replace(/from '\.\.\/shared/g, "from '../shared")}

import type { Context } from 'hono';

export async function ${hFn}(c: Context) {
${body}
}
`
  );

  const regFn = regM[1];
  fs.writeFileSync(
    full,
    `import type { Hono } from 'hono';
import { ${hFn} } from '../handlers/${base}.handler';

export function ${regFn}(app: Hono) {
  app.${method}(${pathExpr}, ${hFn});
}
`
  );
  console.log('discovery handler', base);
}
