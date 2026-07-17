/**
 * Restore thin bridge services for orders + appointments (not handlers).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../src/endpoints/customer');

const ORDER_SERVICES = {
  customer_orders_post: {
    imports: `import type { Context } from 'hono';
import { HandlerContext } from '../../../../handler/base-handler';
import { createOrderHandler } from './handler-instances.service';
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
import { getOrdersHandler } from './handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getOrdersHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_paymentresume_get: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { shopPaymentResumeHandler } from './handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await shopPaymentResumeHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_get: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getDetailsHandler } from './handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getDetailsHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_invoice_get: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getInvoiceHandler } from './handler-instances.service';
`,
    body: `  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getInvoiceHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
  customer_orders_id_return_post: {
    imports: `import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { returnOrderHandler } from './handler-instances.service';
`,
    body: `  const body = await c.req.json().catch(() => ({}));
  const event = createOrdersApiGatewayEvent(c.req);
  event.body = JSON.stringify(body);
  const context = createEmptyLambdaContext();
  const result = await returnOrderHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);`,
  },
};

function svcFn(slug) {
  return (
    'execute' +
    slug
      .split('_')
      .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('')
  );
}

for (const [slug, spec] of Object.entries(ORDER_SERVICES)) {
  fs.writeFileSync(
    path.join(ROOT, 'orders/services', `${slug}.service.ts`),
    `${spec.imports}
export async function ${svcFn(slug)}(c: Context) {
${spec.body}
}
`
  );
  console.log('fixed orders service', slug);
}

const APPT_DIR = path.join(ROOT, 'appointments/services');
const apptImports = `import type { Context } from 'hono';
import {
  createAppointmentsApiGatewayEvent,
  createEmptyLambdaContext,
  mergeAllQueryFromHono,
} from '../../shared/hono-lambda-bridge.utils';
import { runAppointmentHandler, NOT_FOUND_FALLBACK, LIST_FALLBACK } from '../repos/appointment-runtime.repo';
import {
  getAppointmentsHandler,
  getDetailsHandler,
  rescheduleHandler,
  cancelHandler,
} from './handler-instances.service';
`;

for (const f of fs.readdirSync(APPT_DIR)) {
  if (!f.endsWith('.service.ts') || f.includes('handler-instances') || f.includes('base-handlers')) continue;
  const content = fs.readFileSync(path.join(APPT_DIR, f), 'utf8');
  if (!/createAppointmentsApiGatewayEvent|runAppointmentHandler/.test(content) && !/getDetailsHandler|getAppointmentsHandler/.test(content)) {
    continue;
  }
  const slug = f.replace('.service.ts', '');
  const body = content.match(/export async function \w+\(c: Context\)\s*\{([\s\S]*)\}\s*$/)?.[1];
  if (!body) continue;
  const fixedBody = body
    .replace(/\bcreateApiGatewayEvent\b/g, 'createAppointmentsApiGatewayEvent')
    .replace(/\bcreateLambdaContext\b/g, 'createEmptyLambdaContext');
  fs.writeFileSync(
    path.join(APPT_DIR, f),
    `${apptImports}
export async function ${svcFn(slug)}(c: Context) {${fixedBody}}
`
  );
  console.log('fixed appointments service', slug);
}

console.log('done');
