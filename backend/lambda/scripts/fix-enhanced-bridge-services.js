/**
 * Fix enhanced bridge services: minimal imports + handler-instances.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../src/endpoints/customer/enhanced/services');

const BRIDGE = {
  customer_byphone_get: {
    handlers: ['getByPhoneHandler'],
    extraImports: '',
    body: `    const startTime = Date.now();
    try {
      const phone = c.req.query('phone');
      
      if (!phone) {
        return c.json({ 
          success: false,
          error: { code: 'MISSING_PHONE', message: 'phone parameter is required' }
        }, 400);
      }

      const event = createEnhancedApiGatewayEvent(c.req);
      event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
      const context = createEnhancedLambdaContext();
      
      try {
        const result: any = await getByPhoneHandler.execute(event, context);
        const body = JSON.parse(result.body);
        const duration = Date.now() - startTime;
        if (duration > 2000) {
          console.warn(\`[by-phone] Slow response: \${duration}ms for phone \${phone.substring(0, 4)}****\`);
        }
        return c.json(body, result.statusCode);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorMessage = error?.message || String(error);
        console.error(\`[by-phone] Error after \${duration}ms:\`, errorMessage);
        if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
          console.error('[by-phone] ⚠️ Connection pool exhausted');
        }
        return c.json({ success: false, customer: null }, 200);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(\`[by-phone] Error after \${duration}ms:\`, error?.message || error);
      return c.json({ success: false, customer: null }, 200);
    }`,
  },
  customer_customerid_get: {
    handlers: ['getHandler'],
    body: `    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);`,
  },
  customer_customerid_put: {
    handlers: ['updateHandler'],
    body: `    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await updateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);`,
  },
  customer_customerid_delete: {
    handlers: ['deactivateHandler'],
    body: `    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await deactivateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);`,
  },
  customer_customerid_pets_get: {
    handlers: ['getPetsHandler'],
    body: `    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await getPetsHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);`,
  },
  customer_customerid_pets_post: {
    handlers: ['addPetHandler'],
    body: `    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await addPetHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);`,
  },
};

for (const [base, spec] of Object.entries(BRIDGE)) {
  const fn = 'execute' + base.split('_').map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  const handlerImport = `import { ${spec.handlers.join(', ')} } from './handler-instances.service';\n`;
  const content = `import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
${handlerImport}
export async function ${fn}(c: Context) {
${spec.body}
}
`;
  fs.writeFileSync(path.join(DIR, `${base}.service.ts`), content);
  console.log('fixed bridge', base);
}
