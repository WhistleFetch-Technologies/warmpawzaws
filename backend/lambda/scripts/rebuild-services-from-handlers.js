/**
 * Rebuild corrupted service files from committed handler bodies (move-only).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [, , moduleName] = process.argv;
if (!moduleName) throw new Error('usage: rebuild-services-from-handlers.js <module>');

const ROOT = path.join(__dirname, '..');
const HANDLERS = path.join(ROOT, `src/endpoints/customer/${moduleName}/handlers`);
const SERVICES = path.join(ROOT, `src/endpoints/customer/${moduleName}/services`);
const GIT = path.join(ROOT, '..');

fs.mkdirSync(SERVICES, { recursive: true });

function serviceFn(handlerFn) {
  return 'execute' + handlerFn.replace(/Handler$/, '');
}

for (const f of fs.readdirSync(HANDLERS).filter((x) => x.endsWith('.handler.ts'))) {
  const rel = `backend/lambda/src/endpoints/customer/${moduleName}/handlers/${f}`;
  let content;
  try {
    content = execSync(`git show HEAD:${rel}`, { cwd: GIT, encoding: 'utf8' });
  } catch {
    console.warn('skip no HEAD', f);
    continue;
  }

  const fnMatch = content.match(/export async function (\w+)\(c: Context\)/);
  if (!fnMatch) continue;
  const handlerFn = fnMatch[1];
  const bodyMatch = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/);
  if (!bodyMatch) continue;

  const imports = content
    .split('\n')
    .filter((l) => {
      if (!l.startsWith('import ') && !l.trim().startsWith('} from')) return false;
      if (l.includes("from 'hono'") && l.includes('Context')) return false;
      return true;
    })
    .join('\n');

  const base = f.replace('.handler.ts', '');
  const svcFn = serviceFn(handlerFn);
  const svcPath = path.join(SERVICES, `${base}.service.ts`);

  // preserve repo import if repo exists
  let repoImport = '';
  const repoPath = path.join(ROOT, `src/endpoints/customer/${moduleName}/repos/${base}.repo.ts`);
  if (fs.existsSync(repoPath)) {
    repoImport = `import * as ${base.replace(/[^a-zA-Z0-9_]/g, '_')}Repo from '../repos/${base}.repo';\n`;
  }

  let body = bodyMatch[1];
  if (moduleName === 'enhanced') {
    body = body
      .replace(/\bcreateApiGatewayEvent\b/g, 'createEnhancedApiGatewayEvent')
      .replace(/\bcreateLambdaContext\b/g, 'createEnhancedLambdaContext');
  }

  const bridge =
    moduleName === 'enhanced'
      ? `import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';\n`
      : '';

  fs.writeFileSync(
    svcPath,
    `import type { Context } from 'hono';
${bridge}${repoImport}${imports}

export async function ${svcFn}(c: Context) {${body}}
`
  );
  console.log('rebuilt', moduleName, base);
}

console.log('done');
