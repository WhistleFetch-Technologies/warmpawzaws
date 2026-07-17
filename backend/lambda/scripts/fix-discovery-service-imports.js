/**
 * Restore multiline imports in discovery services from pre-extract route files (commit 543022184).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVICES_DIR = path.join(ROOT, 'src/endpoints/customer/discovery/services');
const GIT_REF = '543022184';

function routeImports(routeFile) {
  try {
    const rel = `backend/lambda/src/endpoints/customer/discovery/routes/${routeFile}`;
    const content = execSync(`git show ${GIT_REF}:${rel}`, { cwd: path.join(ROOT, '..'), encoding: 'utf8' });
    const lines = content.split('\n');
    const imports = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('import ')) {
        const block = [line];
        i++;
        while (i < lines.length && !/from ['"]/.test(block[block.length - 1])) {
          block.push(lines[i]);
          i++;
        }
        imports.push(block.join('\n'));
        continue;
      }
      if (line.trim().startsWith('} from')) {
        imports.push(line);
      }
      if (/export function register/.test(line)) break;
      i++;
    }
    return imports.join('\n');
  } catch (e) {
    console.warn('skip', routeFile, e.message);
    return null;
  }
}

function routeBaseFromService(serviceFile) {
  // discover-services.service.ts -> discover-services.route.ts
  return serviceFile.replace('.service.ts', '.route.ts');
}

for (const f of fs.readdirSync(SERVICES_DIR).filter((x) => x.endsWith('.service.ts'))) {
  const routeFile = routeBaseFromService(f);
  const imports = routeImports(routeFile);
  if (!imports) continue;

  const svcPath = path.join(SERVICES_DIR, f);
  let content = fs.readFileSync(svcPath, 'utf8');
  const fnMatch = content.match(/export async function (\w+)\(c: Context\)/);
  if (!fnMatch) continue;
  const bodyMatch = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/);
  const body = bodyMatch ? bodyMatch[1] : '';

  // Keep repo import if present
  const repoImport = content.match(/^import \* as \w+Repo from '\.\.\/repos\/[^']+';\n/m)?.[0] || '';

  const cleanedImports = imports
    .split('\n')
    .filter((l) => !l.includes('hono') || l.includes('type'))
    .join('\n')
    .replace(/from '\.\.\/handlers/g, "from '../handlers")
    .replace(/from '\.\.\/shared/g, "from '../shared");

  const newFile = `import type { Context } from 'hono';
${repoImport}${cleanedImports}

export async function ${fnMatch[1]}(c: Context) {${body}}
`;
  fs.writeFileSync(svcPath, newFile);
  console.log('fixed imports', f);
}

console.log('done');
