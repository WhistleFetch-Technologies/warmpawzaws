/**
 * Restore all customer services from 9199e456f handler bodies (pre-enforce, move-only).
 * Keeps thin handlers; overwrites services with verbatim logic from split commit.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GIT = path.join(ROOT, '..');
const GIT_REF = '9199e456f';
const CUSTOMER = path.join(ROOT, 'src/endpoints/customer');

const MODULES = fs
  .readdirSync(CUSTOMER, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !['_legacy', 'constants', 'customerEndpoint', 'shared'].includes(d.name))
  .map((d) => d.name);

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

const BRIDGE_MODULES = {
  enhanced: `import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';\n`,
};

const ENHANCED_BRIDGE = new Set([
  'customer_byphone_get',
  'customer_customerid_get',
  'customer_customerid_put',
  'customer_customerid_delete',
  'customer_customerid_pets_get',
  'customer_customerid_pets_post',
]);

let restored = 0;

for (const mod of MODULES) {
  const handlersDir = path.join(CUSTOMER, mod, 'handlers');
  const servicesDir = path.join(CUSTOMER, mod, 'services');
  if (!fs.existsSync(handlersDir)) continue;
  fs.mkdirSync(servicesDir, { recursive: true });

  for (const f of fs.readdirSync(handlersDir).filter((x) => x.endsWith('.handler.ts'))) {
    const base = f.replace('.handler.ts', '');
    if (mod === 'enhanced' && ENHANCED_BRIDGE.has(base)) continue;

    const rel = `backend/lambda/src/endpoints/customer/${mod}/handlers/${f}`;
    let content;
    try {
      content = execSync(`git show ${GIT_REF}:${rel}`, { cwd: GIT, encoding: 'utf8' });
    } catch {
      continue;
    }

    const fnMatch = content.match(/export async function (\w+)\(c: Context\)/);
    const bodyMatch = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/);
    if (!fnMatch || !bodyMatch) continue;

    let body = bodyMatch[1];
    if (mod === 'enhanced') {
      body = body
        .replace(/\bcreateApiGatewayEvent\b/g, 'createEnhancedApiGatewayEvent')
        .replace(/\bcreateLambdaContext\b/g, 'createEnhancedLambdaContext');
    }
    if (mod === 'orders') {
      body = body
        .replace(/\bcreateApiGatewayEvent\b/g, 'createOrdersApiGatewayEvent')
        .replace(/\bcreateLambdaContext\b/g, 'createEmptyLambdaContext');
    }
    if (mod === 'appointments') {
      body = body
        .replace(/\bcreateApiGatewayEvent\b/g, 'createAppointmentsApiGatewayEvent')
        .replace(/\bcreateLambdaContext\b/g, 'createEmptyLambdaContext');
    }

    const imports = extractImports(content);
    const bridge = BRIDGE_MODULES[mod] || '';
    if (mod === 'orders') {
      // orders handlers at split were thin - skip if body uses handler instances only
      if (/getOrdersHandler|getDetailsHandler|createOrderHandler/.test(body) && body.length < 400) continue;
    }
    if (mod === 'appointments') {
      if (/runAppointmentHandler|getDetailsHandler/.test(body) && !/await query/.test(body) && body.length < 500) continue;
    }

    fs.writeFileSync(
      path.join(servicesDir, `${base}.service.ts`),
      `import type { Context } from 'hono';
${bridge}${imports}

export async function ${serviceFn(fnMatch[1])}(c: Context) {${body}}
`
    );
    restored++;
  }
}

console.log('restored services:', restored);
