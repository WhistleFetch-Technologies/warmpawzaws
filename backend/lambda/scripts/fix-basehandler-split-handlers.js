/**
 * Fix broken split handlers for BaseHandler modules (orders, appointments, enhanced).
 * Run once: node scripts/fix-basehandler-split-handlers.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../src/endpoints/customer');

const ORDER_HANDLERS = {
  customer_orders_post: {
    imports: `import type { Context } from 'hono';
import { HandlerContext } from '../../../../handler/base-handler';
import { createOrderHandler } from '../services/handler-instances.service';
`,
    body: `  try {
    const body = await c.req.json();
    const response = await createOrderHandler.handle({
      event: {
        body: JSON.stringify(body),
        queryStringParameters: c.req.query ? Object.fromEntries(Object.entries(c.req.query())) : {},
      } as any,
    } as HandlerContext);
    return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 500);
  } catch (error: any) {
    console.error('Error creating order:', error);
    return c.json({ error: error.message || 'Failed to create order' }, 500);
  }`,
  },
  customer_orders_get: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getOrdersHandler } from '../services/handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getOrdersHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_paymentresume_get: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { shopPaymentResumeHandler } from '../services/handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await shopPaymentResumeHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_get: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getDetailsHandler } from '../services/handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getDetailsHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_invoice_get: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getInvoiceHandler } from '../services/handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getInvoiceHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_return_post: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { returnOrderHandler } from '../services/handler-instances.service';
`,
    body: `  const body = await c.req.json().catch(() => ({}));
  const event = createOrdersApiGatewayEvent(c.req);
  event.body = JSON.stringify(body);
  const context = createEmptyLambdaContext();
  const result = await returnOrderHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
};

for (const [slug, spec] of Object.entries(ORDER_HANDLERS)) {
  const fn =
    slug
      .split('_')
      .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('') + 'Handler';
  const file = path.join(ROOT, 'orders/handlers', `${slug}.handler.ts`);
  fs.writeFileSync(
    file,
    `${spec.imports}
export async function ${fn}(c: Context) {
${spec.body}
}
`
  );
  console.log('fixed orders', slug);
}

// Appointments — read original bodies from git would be ideal; reconstruct from known patterns
const APPT_DIR = path.join(ROOT, 'appointments/handlers');
for (const f of fs.readdirSync(APPT_DIR)) {
  if (!f.endsWith('.handler.ts')) continue;
  const content = fs.readFileSync(path.join(APPT_DIR, f), 'utf8');
  if (!content.includes('createApiGatewayEvent') && !content.includes('runAppointmentHandler')) continue;

  const slug = f.replace('.handler.ts', '');
  const fn = slug
    .split('_')
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') + 'Handler';

  let imports = `import type { Context } from 'hono';
import {
  createAppointmentsApiGatewayEvent,
  createEmptyLambdaContext,
  mergeAllQueryFromHono,
} from '../../shared/hono-lambda-bridge.utils';
import {
  runAppointmentHandler,
  NOT_FOUND_FALLBACK,
  LIST_FALLBACK,
} from '../repos/appointment-runtime.repo';
import {
  getAppointmentsHandler,
  getDetailsHandler,
  rescheduleHandler,
  cancelHandler,
} from '../services/handler-instances.service';
`;

  let body = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/)?.[1] || '';
  body = body
    .replace(/\bcreateApiGatewayEvent\b/g, 'createAppointmentsApiGatewayEvent')
    .replace(/\bcreateLambdaContext\b/g, 'createEmptyLambdaContext');

  fs.writeFileSync(
    path.join(APPT_DIR, f),
    `${imports}
export async function ${fn}(c: Context) {${body}}
`
  );
  console.log('fixed appointments', slug);
}

// Enhanced handlers using createApiGatewayEvent
const ENH_DIR = path.join(ROOT, 'enhanced/handlers');
for (const f of fs.readdirSync(ENH_DIR)) {
  const fp = path.join(ENH_DIR, f);
  const content = fs.readFileSync(fp, 'utf8');
  if (!content.includes('createApiGatewayEvent')) continue;
  const slug = f.replace('.handler.ts', '');
  const fn = slug
    .split('_')
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') + 'Handler';
  let body = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/)?.[1] || '';
  body = body
    .replace(/\bcreateApiGatewayEvent\b/g, 'createEnhancedApiGatewayEvent')
    .replace(/\bcreateLambdaContext\b/g, 'createEnhancedLambdaContext');

  const imports = `import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
`;

  // preserve non-bridge imports from original header (utils, repos references)
  const origImports = content
    .split('\n')
    .filter(
      (l) =>
        l.startsWith('import ') &&
        !l.includes('hono') &&
        !l.includes('rds-connection') &&
        !l.includes('BaseHandler') &&
        !l.includes('HandlerContext') &&
        !l.includes('HandlerResponse')
    )
    .join('\n');

  fs.writeFileSync(fp, `${imports}${origImports ? origImports + '\n' : ''}
export async function ${fn}(c: Context) {${body}}
`);
  console.log('fixed enhanced', slug);
}

console.log('done');
