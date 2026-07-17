/**
 * Rebuild enhanced services from split-commit handlers (9199e456f) with full multiline imports.
 * Skips bridge services (fixed separately).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GIT = path.join(ROOT, '..');
const GIT_REF = '9199e456f';
const HANDLERS = path.join(ROOT, 'src/endpoints/customer/enhanced/handlers');
const SERVICES = path.join(ROOT, 'src/endpoints/customer/enhanced/services');

const SKIP = new Set([
  'customer_byphone_get',
  'customer_customerid_get',
  'customer_customerid_put',
  'customer_customerid_delete',
  'customer_customerid_pets_get',
  'customer_customerid_pets_post',
]);

function extractImports(content) {
  const lines = content.split('\n');
  const imports = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith('import ')) {
      if (/^export async function/.test(line)) break;
      i++;
      continue;
    }
    const block = [line];
    i++;
    while (i < lines.length && !/from ['"]/.test(block[block.length - 1])) {
      block.push(lines[i]);
      i++;
    }
    const joined = block.join('\n');
    if (!joined.includes("from 'hono'") || !joined.includes('Context')) {
      imports.push(joined);
    }
  }
  return imports.join('\n');
}

function serviceFn(handlerFn) {
  return 'execute' + handlerFn.replace(/Handler$/, '');
}

for (const f of fs.readdirSync(HANDLERS).filter((x) => x.endsWith('.handler.ts'))) {
  const base = f.replace('.handler.ts', '');
  if (SKIP.has(base)) continue;

  const rel = `backend/lambda/src/endpoints/customer/enhanced/handlers/${f}`;
  let content;
  try {
    content = execSync(`git show ${GIT_REF}:${rel}`, { cwd: GIT, encoding: 'utf8' });
  } catch (e) {
    console.warn('skip', base, e.message);
    continue;
  }

  const fnMatch = content.match(/export async function (\w+)\(c: Context\)/);
  const bodyMatch = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/);
  if (!fnMatch || !bodyMatch) continue;

  const imports = extractImports(content);
  let body = bodyMatch[1]
    .replace(/\bcreateApiGatewayEvent\b/g, 'createEnhancedApiGatewayEvent')
    .replace(/\bcreateLambdaContext\b/g, 'createEnhancedLambdaContext');

  let repoImport = '';
  const repoPath = path.join(ROOT, `src/endpoints/customer/enhanced/repos/${base}.repo.ts`);
  if (fs.existsSync(repoPath)) {
    repoImport = `import * as ${base.replace(/[^a-zA-Z0-9_]/g, '_')}Repo from '../repos/${base}.repo';\n`;
  }

  const cleaned = imports
    .replace(/import \{[^}]*\} from ['"][^'"]*database\/rds-connection['"];\s*\n?/g, '')
    .replace(/import \{ query, select, insert, update \}[^\n]*\n?/g, '');

  fs.writeFileSync(
    path.join(SERVICES, `${base}.service.ts`),
    `import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
${repoImport}${cleaned}

export async function ${serviceFn(fnMatch[1])}(c: Context) {${body}}
`
  );
  console.log('rebuilt enhanced', base);
}

console.log('done');
